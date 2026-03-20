import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { parseIntBounded, validateBody, uploadResultsBody } from "../validation.js";

export const resultRoutes = new Hono<AppEnv>();

const IDEMPOTENCY_TTL_HOURS = 24;

// POST /:runId/results — Batch insert results
resultRoutes.post("/:runId/results", async (c) => {
  const runId = c.req.param("runId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const db = c.env.DB;

  // Check for idempotency key
  const idempotencyKey = c.req.header("Idempotency-Key");
  if (idempotencyKey) {
    const existing = await db
      .prepare("SELECT response FROM idempotency_keys WHERE key = ? AND org_id = ? AND expires_at > datetime('now')")
      .bind(idempotencyKey, auth.org.id)
      .first<{ response: string }>();
    if (existing) {
      const cached = JSON.parse(existing.response) as { body: unknown; status: number };
      return c.json(cached.body, cached.status as 200 | 201);
    }
  }

  const run = await queries.getRun(runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const project = await queries.getProject(run.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Run not found" }, 404);
  }

  const raw = await c.req.json();
  const parsed = validateBody(uploadResultsBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  await queries.createResults(runId, body.results);

  const responseBody = { count: body.results.length };

  // Store idempotency key if provided
  if (idempotencyKey) {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000).toISOString();
    await db
      .prepare("INSERT INTO idempotency_keys (key, org_id, response, expires_at) VALUES (?, ?, ?, ?)")
      .bind(idempotencyKey, auth.org.id, JSON.stringify({ body: responseBody, status: 201 }), expiresAt)
      .run()
      .catch(() => {
        // Ignore duplicate key errors (race condition — another request stored it first)
      });
  }

  return c.json(responseBody, 201);
});

// GET /:runId/results — Get results for run (paginated)
resultRoutes.get("/:runId/results", async (c) => {
  const runId = c.req.param("runId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const run = await queries.getRun(runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const project = await queries.getProject(run.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Run not found" }, 404);
  }

  const limit = parseIntBounded(c.req.query("limit"), 100, 1, 1000);
  const offset = parseIntBounded(c.req.query("offset"), 0, 0, 100_000);

  const results = await queries.listResults(runId, { limit, offset });
  return c.json({ results });
});
