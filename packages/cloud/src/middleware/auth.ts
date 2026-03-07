import type { Context, Next } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | void> {
  const header = c.req.header("Authorization");
  if (!header) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return c.json({ error: "Invalid Authorization format. Expected: Bearer <token>" }, 401);
  }

  const rawToken = parts[1] as string;
  if (!rawToken.startsWith("klm_")) {
    return c.json({ error: "Invalid token format" }, 401);
  }

  const hash = await hashToken(rawToken);
  const queries = getQueries(c.env.DB);
  const token = await queries.getTokenByHash(hash);

  if (!token) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Check scope: readonly tokens can only GET
  if (token.scope === "readonly" && c.req.method !== "GET") {
    return c.json({ error: "Readonly token cannot perform write operations" }, 403);
  }

  // Check scope: ci tokens can GET and POST but not DELETE
  if (token.scope === "ci" && c.req.method === "DELETE") {
    return c.json({ error: "CI token cannot perform delete operations" }, 403);
  }

  const org = await queries.getOrg(token.orgId);
  if (!org) {
    return c.json({ error: "Organization not found" }, 401);
  }

  const user = token.userId ? await queries.getUser(token.userId) : null;

  c.set("auth", { org, token, user });

  // Fire-and-forget last_used update
  c.executionCtx.waitUntil(queries.updateTokenLastUsed(token.id));

  return next();
}

export { hashToken };
