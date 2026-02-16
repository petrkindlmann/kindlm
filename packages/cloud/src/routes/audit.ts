import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { requirePlan } from "../middleware/plan-gate.js";

export const auditRoutes = new Hono<AppEnv>();

// GET / — List audit log entries (enterprise only)
auditRoutes.get("/", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const action = c.req.query("action");
  const resourceType = c.req.query("resourceType");
  const since = c.req.query("since");
  const until = c.req.query("until");
  const limit = c.req.query("limit") ? parseInt(c.req.query("limit") ?? "", 10) : undefined;
  const offset = c.req.query("offset") ? parseInt(c.req.query("offset") ?? "", 10) : undefined;

  const { entries, total } = await queries.listAuditLog(auth.org.id, {
    action: action ?? undefined,
    resourceType: resourceType ?? undefined,
    since: since ?? undefined,
    until: until ?? undefined,
    limit,
    offset,
  });

  return c.json({ entries, total });
});
