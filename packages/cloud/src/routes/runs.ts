import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import type { WebhookEvent } from "../types.js";
import { getQueries } from "../db/queries.js";
import { dispatchWebhooks } from "../webhooks/dispatch.js";
import { parseIntBounded, validateBody, createRunBody, updateRunBody } from "../validation.js";

// Project-scoped run routes — mounted at /v1/projects
export const projectRunRoutes = new Hono<AppEnv>();

// Run-scoped routes — mounted at /v1/runs
export const runRoutes = new Hono<AppEnv>();

// POST /:projectId/runs — Create run
projectRunRoutes.post("/:projectId/runs", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const project = await queries.getProject(projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  // CI-scoped tokens can only create runs in their scoped project
  if (auth.token.projectId && auth.token.projectId !== projectId) {
    return c.json({ error: "Token not scoped to this project" }, 403);
  }

  const raw = await c.req.json();
  const parsed = validateBody(createRunBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const suite = await queries.getSuite(body.suiteId);
  if (!suite || suite.projectId !== projectId) {
    return c.json({ error: "Suite not found in this project" }, 404);
  }

  const run = await queries.createRun(projectId, body.suiteId, {
    commitSha: body.commitSha,
    branch: body.branch,
    environment: body.environment,
    triggeredBy: body.triggeredBy,
  });

  return c.json(run, 201);
});

// GET /:projectId/runs/trends — Day-bucketed pass rate and cost trends
projectRunRoutes.get("/:projectId/runs/trends", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const project = await queries.getProject(projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  const limit = parseIntBounded(c.req.query("limit"), 30, 1, 90);
  const trends = await queries.getRunTrends(projectId, limit);
  return c.json({ trends });
});

// GET /:projectId/runs — List runs with optional filters
projectRunRoutes.get("/:projectId/runs", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const project = await queries.getProject(projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  const suiteId = c.req.query("suiteId") ?? undefined;
  const branch = c.req.query("branch") ?? undefined;
  const dateFrom = c.req.query("dateFrom") ?? undefined;
  const dateTo = c.req.query("dateTo") ?? undefined;
  const limit = parseIntBounded(c.req.query("limit"), 50, 1, 100);
  const offset = parseIntBounded(c.req.query("offset"), 0, 0, 100_000);

  const result = await queries.listRuns(projectId, { suiteId, branch, dateFrom, dateTo, limit, offset });
  return c.json(result);
});

// GET /:runId — Get run
runRoutes.get("/:runId", async (c) => {
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

  return c.json(run);
});

// PATCH /:runId — Update run
runRoutes.patch("/:runId", async (c) => {
  const runId = c.req.param("runId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const existing = await queries.getRun(runId);
  if (!existing) {
    return c.json({ error: "Run not found" }, 404);
  }

  const project = await queries.getProject(existing.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Run not found" }, 404);
  }

  // CI-scoped tokens can only update runs belonging to their scoped project
  if (auth.token.projectId && auth.token.projectId !== existing.projectId) {
    return c.json({ error: "Token not scoped to this project" }, 403);
  }

  const raw = await c.req.json();
  const parsed = validateBody(updateRunBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const updated = await queries.updateRun(runId, body);
  if (!updated) {
    return c.json({ error: "Run not found" }, 404);
  }

  // Dispatch webhooks on status change to completed/failed
  if (
    body.status === "completed" ||
    body.status === "failed"
  ) {
    const event: WebhookEvent =
      body.status === "completed" ? "run.completed" : "run.failed";
    const webhooks = await queries.listWebhooksByEvent(auth.org.id, event);
    if (webhooks.length > 0) {
      c.executionCtx.waitUntil(dispatchWebhooks(webhooks, event, updated));
    }
  }

  return c.json(updated);
});

// GET /:runId/compliance — Get stored compliance report for a run
runRoutes.get("/:runId/compliance", async (c) => {
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

  if (!run.complianceReport) {
    return c.json({ error: "No compliance report stored for this run" }, 404);
  }

  return c.json({
    runId: run.id,
    complianceReport: run.complianceReport,
    complianceHash: run.complianceHash,
  });
});
