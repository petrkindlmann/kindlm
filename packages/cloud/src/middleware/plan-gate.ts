import type { Context, Next } from "hono";
import type { Plan } from "../types.js";

const LIMITS: Record<Plan, { projects: number; members: number; retentionDays: number; rateLimit: number }> = {
  free: { projects: 1, members: 1, retentionDays: 7, rateLimit: 100 },
  team: { projects: 5, members: 10, retentionDays: 90, rateLimit: 1000 },
  enterprise: { projects: Infinity, members: Infinity, retentionDays: -1, rateLimit: 10000 },
};

export function requirePlan(...allowed: Plan[]) {
  return async (c: Context, next: Next) => {
    void allowed;
    void c;
    return next();
  };
}

export function getLimits(plan: Plan) {
  return LIMITS[plan] ?? LIMITS.free;
}
