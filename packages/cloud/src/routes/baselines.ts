import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { auditLog } from "./audit-helper.js";
import { createBaselineBody, validateBody } from "../validation.js";

export const baselineRoutes = new Hono<AppEnv>();

// POST /:suiteId/baselines — Create baseline
baselineRoutes.post("/:suiteId/baselines", async (c) => {
  const suiteId = c.req.param("suiteId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const suite = await queries.getSuite(suiteId);
  if (!suite) {
    return c.json({ error: "Suite not found" }, 404);
  }

  const project = await queries.getProject(suite.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Suite not found" }, 404);
  }

  const raw = await c.req.json();
  const parsed = validateBody(createBaselineBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const run = await queries.getRun(body.runId);
  if (!run || run.suiteId !== suiteId) {
    return c.json({ error: "Run not found for this suite" }, 404);
  }

  const baseline = await queries.createBaseline(
    suiteId,
    body.runId,
    body.label,
  );

  auditLog(c, "baseline.create", "baseline", baseline.id, { suiteId, label: body.label });
  return c.json(baseline, 201);
});

// GET /:suiteId/baselines — List baselines
baselineRoutes.get("/:suiteId/baselines", async (c) => {
  const suiteId = c.req.param("suiteId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const suite = await queries.getSuite(suiteId);
  if (!suite) {
    return c.json({ error: "Suite not found" }, 404);
  }

  const project = await queries.getProject(suite.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Suite not found" }, 404);
  }

  const baselines = await queries.listBaselines(suiteId);
  return c.json({ baselines });
});

// POST /:baselineId/activate — Activate baseline
baselineRoutes.post("/:baselineId/activate", async (c) => {
  const baselineId = c.req.param("baselineId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const baseline = await queries.getBaseline(baselineId);
  if (!baseline) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  const suite = await queries.getSuite(baseline.suiteId);
  if (!suite) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  const project = await queries.getProject(suite.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  const activated = await queries.activateBaseline(baselineId, baseline.suiteId);
  if (!activated) {
    return c.json({ error: "Failed to activate baseline" }, 500);
  }

  auditLog(c, "baseline.activate", "baseline", baselineId, { suiteId: baseline.suiteId });
  const updated = await queries.getBaseline(baselineId);
  return c.json(updated);
});

// DELETE /:baselineId — Delete baseline
baselineRoutes.delete("/:baselineId", async (c) => {
  const baselineId = c.req.param("baselineId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const baseline = await queries.getBaseline(baselineId);
  if (!baseline) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  const suite = await queries.getSuite(baseline.suiteId);
  if (!suite) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  const project = await queries.getProject(suite.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Baseline not found" }, 404);
  }

  await queries.deleteBaseline(baselineId, baseline.suiteId);
  auditLog(c, "baseline.delete", "baseline", baselineId);
  return c.body(null, 204);
});
