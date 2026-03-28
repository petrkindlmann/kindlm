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
  const actorId = c.req.query("actorId");
  const since = c.req.query("since");
  const until = c.req.query("until");
  const cursor = c.req.query("cursor");
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") ?? "50", 10) || 50, 1), 1000);
  const offset = Math.max(parseInt(c.req.query("offset") ?? "0", 10) || 0, 0);

  const { entries, total, nextCursor } = await queries.listAuditLog(auth.org.id, {
    action: action ?? undefined,
    resourceType: resourceType ?? undefined,
    actorId: actorId ?? undefined,
    since: since ?? undefined,
    until: until ?? undefined,
    cursor: cursor ?? undefined,
    limit,
    offset,
  });

  return c.json({ entries, total, nextCursor });
});

// GET /export — Export audit log as CSV (enterprise only)
auditRoutes.get("/export", requirePlan("enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const action = c.req.query("action");
  const resourceType = c.req.query("resourceType");
  const actorId = c.req.query("actorId");
  const since = c.req.query("since");
  const until = c.req.query("until");

  // Export up to 10,000 rows
  const { entries } = await queries.listAuditLog(auth.org.id, {
    action: action ?? undefined,
    resourceType: resourceType ?? undefined,
    actorId: actorId ?? undefined,
    since: since ?? undefined,
    until: until ?? undefined,
    limit: 10000,
    offset: 0,
  });

  const header = "id,orgId,actorId,actorType,action,resourceType,resourceId,createdAt";
  const rows = entries.map((e) => {
    const escape = (v: string | null) => {
      if (v === null || v === undefined) return "";
      // Wrap in quotes if value contains comma, quote, or newline
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    return [
      escape(e.id),
      escape(e.orgId),
      escape(e.actorId),
      escape(e.actorType),
      escape(e.action),
      escape(e.resourceType),
      escape(e.resourceId),
      escape(e.createdAt),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
