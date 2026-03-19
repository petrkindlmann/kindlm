import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project } from "../types.js";
import { projectRoutes } from "./projects.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg();
const token = mockToken();

const sampleProject: Project = {
  id: "proj-1",
  orgId: "org-1",
  name: "My Project",
  description: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/projects", projectRoutes);
  return app;
}

describe("project routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST / creates project", async () => {
    vi.mocked(getQueries).mockReturnValue({
      countProjects: vi.fn().mockResolvedValue(0),
      createProject: vi.fn().mockResolvedValue(sampleProject),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Project" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("My Project");
  });

  it("POST / enforces plan limit", async () => {
    vi.mocked(getQueries).mockReturnValue({
      countProjects: vi.fn().mockResolvedValue(5),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "One Too Many" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toMatch(/Plan limit/);
  });

  it("GET / lists projects for org", async () => {
    vi.mocked(getQueries).mockReturnValue({
      listProjects: vi.fn().mockResolvedValue([sampleProject]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.projects).toHaveLength(1);
  });

  it("GET /:projectId returns 404 for other org's project", async () => {
    const otherProject = { ...sampleProject, orgId: "other-org" };
    vi.mocked(getQueries).mockReturnValue({
      getProject: vi.fn().mockResolvedValue(otherProject),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects/proj-1");

    expect(res.status).toBe(404);
  });

  it("DELETE /:projectId deletes project", async () => {
    vi.mocked(getQueries).mockReturnValue({
      deleteProject: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects/proj-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("PATCH /:projectId updates project name", async () => {
    const updated = { ...sampleProject, name: "Renamed Project" };
    vi.mocked(getQueries).mockReturnValue({
      updateProject: vi.fn().mockResolvedValue(updated),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects/proj-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed Project" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe("Renamed Project");
  });

  it("PATCH /:projectId updates project description", async () => {
    const updated = { ...sampleProject, description: "New description" };
    vi.mocked(getQueries).mockReturnValue({
      updateProject: vi.fn().mockResolvedValue(updated),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects/proj-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "New description" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.description).toBe("New description");
  });

  it("PATCH /:projectId returns 404 for non-existent project", async () => {
    vi.mocked(getQueries).mockReturnValue({
      updateProject: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/projects/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    });

    expect(res.status).toBe(404);
  });

  it("PATCH /:projectId returns 400 when no fields provided", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/projects/proj-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
