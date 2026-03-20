import type { Context, Next } from "hono";
import type { AppEnv } from "../types.js";
import { getLimits } from "./plan-gate.js";

const WINDOW_SECONDS = 60;
const CLEANUP_PROBABILITY = 0.01; // ~1 in 100 requests

const UNAUTHENTICATED_RATE_LIMIT = 30; // per minute per IP for public endpoints

export async function rateLimitMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | void> {
  const auth = c.get("auth");

  // For unauthenticated requests (e.g. /auth/*), rate-limit by IP
  const rateLimitKey = auth
    ? auth.org.id
    : (c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown");
  const limit = auth ? getLimits(auth.org.plan).rateLimit : UNAUTHENTICATED_RATE_LIMIT;
  const db = c.env?.DB;
  if (!db) return next();
  const now = new Date().toISOString().slice(0, 16); // minute-level: "2026-03-20T14:30"

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

    // Atomic upsert: increment count if within the same window, otherwise reset.
    // This prevents race conditions where concurrent requests could read the same
    // count and both pass the limit check.
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start)
         VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE
             WHEN window_start = excluded.window_start THEN count + 1
             ELSE 1
           END,
           window_start = excluded.window_start`,
      )
      .bind(rateLimitKey, now)
      .run();

    // Read the current count after atomic increment
    const row = await db
      .prepare("SELECT count FROM rate_limits WHERE key = ?")
      .bind(rateLimitKey)
      .first<{ count: number }>();

    if (row && row.count > limit) {
      return c.json(
        { error: "Rate limit exceeded. Try again later." },
        429,
      );
    }
    return next();
  } catch {
    // Fail closed: if D1 is unreachable, reject rather than allow unbounded requests
    return c.json({ error: "Service temporarily unavailable" }, 503);
  }
}
