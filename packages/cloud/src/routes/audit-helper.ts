import type { Context } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";

export function auditLog(
  c: Context<AppEnv>,
  action: string,
  resourceType: string,
  resourceId?: string | null,
  metadata?: Record<string, unknown> | null,
): void {
  try {
    const auth = c.get("auth");
    const queries = getQueries(c.env.DB);

    // Fire-and-forget — don't block the response
    const work = queries.logAudit(
      auth.org.id,
      action,
      resourceType,
      resourceId,
      auth.token.id,
      "token",
      metadata,
    ).catch(() => {});

    // Use waitUntil if available (Cloudflare Workers), otherwise just let it run
    if (c.executionCtx && "waitUntil" in c.executionCtx) {
      c.executionCtx.waitUntil(work);
    }
  } catch {
    // Audit logging is best-effort — never fail the request
  }
}
