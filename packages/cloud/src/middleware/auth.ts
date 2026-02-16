import type { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  void c;
  return next();
}
