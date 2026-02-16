import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { hashToken } from "../middleware/auth.js";
import { auditLog } from "./audit-helper.js";
import { createTokenBody, validateBody } from "../validation.js";

export const authRoutes = new Hono<AppEnv>();

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
  const token = await queries.createToken(
    orgId,
    body.name,
    tokenHash,
    scope,
    body.projectId ?? null,
    body.expiresAt ?? null,
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
