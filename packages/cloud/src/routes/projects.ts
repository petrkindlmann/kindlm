import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { getLimits } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { createProjectBody, validateBody } from "../validation.js";

export const projectRoutes = new Hono<AppEnv>();

// POST / — Create project
projectRoutes.post("/", async (c) => {
  const auth = c.get("auth");
  const raw = await c.req.json();
  const parsed = validateBody(createProjectBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const queries = getQueries(c.env.DB);
  const limits = getLimits(auth.org.plan);
  const count = await queries.countProjects(auth.org.id);

  if (count >= limits.projects) {
    return c.json(
      { error: `Plan limit reached: ${limits.projects} project(s). Please upgrade.` },
      403,
    );
  }

  try {
    const project = await queries.createProject(
      auth.org.id,
      body.name,
      body.description ?? null,
    );
    auditLog(c, "project.create", "project", project.id, { name: project.name });
    return c.json(project, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return c.json({ error: "A project with this name already exists" }, 409);
    }
    throw err;
  }
});

// GET / — List projects
projectRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const projects = await queries.listProjects(auth.org.id);
  return c.json({ projects });
});

// GET /:projectId — Get project
projectRoutes.get("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const project = await queries.getProject(projectId);

  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// DELETE /:projectId — Delete project
projectRoutes.delete("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const deleted = await queries.deleteProject(projectId, auth.org.id);

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  auditLog(c, "project.delete", "project", projectId);
  return c.body(null, 204);
});
