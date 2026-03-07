import type { Context, Next } from "hono";
import type { AppEnv } from "../types.js";
import { getLimits } from "./plan-gate.js";

const WINDOW_SECONDS = 60;
const CLEANUP_PROBABILITY = 0.01; // ~1 in 100 requests

export async function rateLimitMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | void> {
  const auth = c.get("auth");
  if (!auth) return next();

  const orgId = auth.org.id;
  const limit = getLimits(auth.org.plan).rateLimit;
  const db = c.env.DB;
  const now = new Date().toISOString();

  try {
    // Probabilistic cleanup of stale entries
    if (Math.random() < CLEANUP_PROBABILITY) {
      c.executionCtx.waitUntil(
        db
          .prepare(
            "DELETE FROM rate_limits WHERE window_start < datetime('now', '-' || ? || ' seconds')",
          )
          .bind(WINDOW_SECONDS * 2)
          .run()
          .catch(() => {}),
      );
    }

    const row = await db
      .prepare(
        "SELECT count, window_start FROM rate_limits WHERE key = ?",
      )
      .bind(orgId)
      .first<{ count: number; window_start: string }>();

    if (!row) {
      // First request — insert new window
      await db
        .prepare(
          "INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)",
        )
        .bind(orgId, now)
        .run();
      return next();
    }

    const windowStart = new Date(row.window_start).getTime();
    const windowEnd = windowStart + WINDOW_SECONDS * 1000;
    const currentTime = Date.now();

    if (currentTime >= windowEnd) {
      // Window expired — reset
      await db
        .prepare(
          "UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?",
        )
        .bind(now, orgId)
        .run();
      return next();
    }

    // Within window — increment
    const newCount = row.count + 1;
    if (newCount > limit) {
      return c.json(
        { error: "Rate limit exceeded. Try again later." },
        429,
      );
    }

    await db
      .prepare("UPDATE rate_limits SET count = ? WHERE key = ?")
      .bind(newCount, orgId)
      .run();
    return next();
  } catch {
    // Fail closed: if D1 is unreachable, reject rather than allow unbounded requests
    return c.json({ error: "Service temporarily unavailable" }, 503);
  }
}
