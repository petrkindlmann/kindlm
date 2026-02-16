import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { parseIntBounded, validateBody, uploadResultsBody } from "../validation.js";

export const resultRoutes = new Hono<AppEnv>();

// POST /:runId/results — Batch insert results
resultRoutes.post("/:runId/results", async (c) => {
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

  const raw = await c.req.json();
  const parsed = validateBody(uploadResultsBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  await queries.createResults(runId, body.results);

  return c.json({ count: body.results.length }, 201);
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
