import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { hashToken } from "../middleware/auth.js";
import { auditLog } from "./audit-helper.js";
import { createTokenBody, validateBody } from "../validation.js";

export const authRoutes = new Hono<AppEnv>();

// GET /me — Return current user + org membership
authRoutes.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.user) {
    return c.json({ error: "Token is not associated with a user" }, 404);
  }

  const queries = getQueries(c.env.DB);
  const membership = await queries.getOrgMember(auth.org.id, auth.user.id);

  return c.json({
    id: auth.user.id,
    github_id: auth.user.githubId,
    github_login: auth.user.githubLogin,
    email: auth.user.email,
    avatar_url: auth.user.avatarUrl,
    org_id: auth.org.id,
    role: membership?.role ?? "member",
    created_at: auth.user.createdAt,
  });
});

// POST /tokens — Create API token
authRoutes.post("/tokens", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json();
  const parsed = validateBody(createTokenBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const orgId = body.orgId ?? auth.org.id;

  // Only allow creating tokens for own org
  if (orgId !== auth.org.id) {
    return c.json({ error: "Cannot create tokens for another organization" }, 403);
  }

  const scope = body.scope ?? "full";

  // Generate plaintext token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `klm_${hex}`;

  const tokenHash = await hashToken(plaintext);

  const queries = getQueries(c.env.DB);

  // Apply org default TTL if no explicit expiresAt provided
  let expiresAt = body.expiresAt ?? null;
  if (!expiresAt) {
    const ttlHours = await queries.getOrgTokenTtl(orgId);
    if (ttlHours !== null && ttlHours > 0) {
      const expiry = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      expiresAt = expiry.toISOString();
    }
  }

  const token = await queries.createToken(
    orgId,
    body.name,
    tokenHash,
    scope,
    body.projectId ?? null,
    expiresAt,
  );

  auditLog(c, "token.create", "token", token.id, { name: token.name, scope });
  return c.json(
    {
      token: plaintext,
      id: token.id,
      name: token.name,
      scope: token.scope,
      projectId: token.projectId,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt,
    },
    201,
  );
});

// GET /tokens — List org tokens (no hash)
authRoutes.get("/tokens", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const tokens = await queries.listTokens(auth.org.id);

  return c.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      projectId: t.projectId,
      expiresAt: t.expiresAt,
      lastUsed: t.lastUsed,
      createdAt: t.createdAt,
    })),
  });
});

// DELETE /tokens/:id — Revoke token
authRoutes.delete("/tokens/:id", async (c) => {
  const id = c.req.param("id");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const revoked = await queries.revokeToken(id, auth.org.id);

  if (!revoked) {
    return c.json({ error: "Token not found" }, 404);
  }

  auditLog(c, "token.revoke", "token", id);
  return c.body(null, 204);
});

// POST /tokens/:id/rotate — Revoke old token and issue a replacement with same config
authRoutes.post("/tokens/:id/rotate", async (c) => {
  const id = c.req.param("id");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  // Find the existing token
  const existing = await queries.getTokenById(id, auth.org.id);
  if (!existing) {
    return c.json({ error: "Token not found" }, 404);
  }

  // Revoke the old token
  await queries.revokeToken(id, auth.org.id);

  // Generate new plaintext token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `klm_${hex}`;
  const tokenHash = await hashToken(plaintext);

  // Recompute expiry: apply org default TTL if original had no expiry
  let expiresAt = existing.expiresAt;
  if (!expiresAt) {
    const ttlHours = await queries.getOrgTokenTtl(auth.org.id);
    if (ttlHours !== null && ttlHours > 0) {
      expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    }
  }

  const newToken = await queries.createToken(
    auth.org.id,
    existing.name,
    tokenHash,
    existing.scope,
    existing.projectId,
    expiresAt,
    existing.userId,
  );

  auditLog(c, "token.rotate", "token", newToken.id, {
    previousTokenId: id,
    name: newToken.name,
    scope: newToken.scope,
  });

  return c.json(
    {
      token: plaintext,
      id: newToken.id,
      name: newToken.name,
      scope: newToken.scope,
      projectId: newToken.projectId,
      expiresAt: newToken.expiresAt,
      createdAt: newToken.createdAt,
      previousTokenId: id,
    },
    201,
  );
});

// POST /tokens/refresh — Refresh the calling token (issue new token, revoke current)
authRoutes.post("/tokens/refresh", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const current = auth.token;

  // Revoke current token
  await queries.revokeToken(current.id, auth.org.id);

  // Generate new plaintext token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const plaintext = `klm_${hex}`;
  const tokenHash = await hashToken(plaintext);

  // Apply org default TTL
  let expiresAt = current.expiresAt;
  if (!expiresAt) {
    const ttlHours = await queries.getOrgTokenTtl(auth.org.id);
    if (ttlHours !== null && ttlHours > 0) {
      expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    }
  }

  const newToken = await queries.createToken(
    auth.org.id,
    current.name,
    tokenHash,
    current.scope,
    current.projectId,
    expiresAt,
    current.userId,
  );

  auditLog(c, "token.refresh", "token", newToken.id, {
    previousTokenId: current.id,
  });

  return c.json(
    {
      token: plaintext,
      id: newToken.id,
      name: newToken.name,
      scope: newToken.scope,
      projectId: newToken.projectId,
      expiresAt: newToken.expiresAt,
      createdAt: newToken.createdAt,
      previousTokenId: current.id,
    },
    201,
  );
});

// GET /tokens/settings — Get org token TTL settings
authRoutes.get("/tokens/settings", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const ttlHours = await queries.getOrgTokenTtl(auth.org.id);

  return c.json({ tokenDefaultTtlHours: ttlHours });
});

// PUT /tokens/settings — Update org token TTL settings
authRoutes.put("/tokens/settings", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json();

  const ttlHours = (raw as Record<string, unknown>).tokenDefaultTtlHours;
  if (ttlHours !== null && (typeof ttlHours !== "number" || ttlHours < 1 || ttlHours > 8760)) {
    return c.json({ error: "tokenDefaultTtlHours must be null or a number between 1 and 8760" }, 400);
  }

  const queries = getQueries(c.env.DB);
  const updated = await queries.updateOrgTokenTtl(auth.org.id, ttlHours as number | null);

  if (!updated) {
    return c.json({ error: "Organization not found" }, 404);
  }

  auditLog(c, "org.update_token_ttl", "org", auth.org.id, {
    tokenDefaultTtlHours: ttlHours,
  });

  return c.json({ tokenDefaultTtlHours: ttlHours as number | null });
});
