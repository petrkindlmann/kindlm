import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { createSuiteBody, validateBody } from "../validation.js";

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
