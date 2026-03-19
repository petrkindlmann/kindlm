import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { createSuiteBody, updateSuiteBody, validateBody } from "../validation.js";
import { auditLog } from "./audit-helper.js";

export const suiteRoutes = new Hono<AppEnv>();

// POST /:projectId/suites — Create suite
suiteRoutes.post("/:projectId/suites", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const project = await queries.getProject(projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  const raw = await c.req.json();
  const parsed = validateBody(createSuiteBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  try {
    const suite = await queries.createSuite(
      projectId,
      body.name,
      body.configHash,
      body.description ?? null,
      body.tags ?? null,
    );
    return c.json(suite, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return c.json({ error: "A suite with this name already exists in this project" }, 409);
    }
    throw err;
  }
});

// GET /:projectId/suites — List suites for project
suiteRoutes.get("/:projectId/suites", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const project = await queries.getProject(projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  const suites = await queries.listSuites(projectId);
  return c.json({ suites });
});

// GET /:suiteId — Get suite
suiteRoutes.get("/:suiteId", async (c) => {
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

  return c.json(suite);
});

// DELETE /:suiteId — Delete suite
suiteRoutes.delete("/:suiteId", async (c) => {
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

  const deleted = await queries.deleteSuite(suiteId);
  if (!deleted) {
    return c.json({ error: "Suite not found" }, 404);
  }

  auditLog(c, "suite.delete", "suite", suiteId, { name: suite.name });
  return c.body(null, 204);
});

// PATCH /:suiteId — Update suite name
suiteRoutes.patch("/:suiteId", async (c) => {
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
  const parsed = validateBody(updateSuiteBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  if (body.name === undefined) {
    return c.json({ error: "At least one field (name) is required" }, 400);
  }

  try {
    const updated = await queries.updateSuite(suiteId, body);
    if (!updated) {
      return c.json({ error: "Suite not found" }, 404);
    }

    auditLog(c, "suite.update", "suite", suiteId, { name: body.name });
    return c.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return c.json({ error: "A suite with this name already exists in this project" }, 409);
    }
    throw err;
  }
});
