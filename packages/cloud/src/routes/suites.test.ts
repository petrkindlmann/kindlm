import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project, Suite } from "../types.js";
import { suiteRoutes } from "./suites.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg();
const token = mockToken();

const project: Project = {
  id: "proj-1",
  orgId: "org-1",
  name: "Test Project",
  description: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const sampleSuite: Suite = {
  id: "suite-1",
  projectId: "proj-1",
  name: "Test Suite",
  description: null,
  configHash: "abc123",
  tags: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/suites", suiteRoutes);
  return app;
}

describe("suite routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /:projectId/suites", () => {
    it("creates a suite under a project", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(project),
        createSuite: vi.fn().mockResolvedValue(sampleSuite),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Suite", configHash: "abc123" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.id).toBe("suite-1");
      expect(body.name).toBe("Test Suite");
      expect(body.projectId).toBe("proj-1");
    });

    it("returns 404 when project belongs to another org", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Suite", configHash: "abc123" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when project does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/nonexistent/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Suite", configHash: "abc123" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 when name is missing", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(project),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configHash: "abc123" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when configHash is missing", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(project),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Suite" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when suite name already exists", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(project),
        createSuite: vi.fn().mockRejectedValue(new Error("UNIQUE constraint failed")),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Suite", configHash: "abc123" }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("already exists");
    });
  });

  describe("GET /:projectId/suites", () => {
    it("lists suites for a project", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(project),
        listSuites: vi.fn().mockResolvedValue([sampleSuite]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const suites = body.suites as Record<string, unknown>[];
      expect(suites).toHaveLength(1);
      expect(suites[0]?.id).toBe("suite-1");
    });

    it("returns 404 when project belongs to another org", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/proj-1/suites");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /:suiteId", () => {
    it("returns suite details", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(sampleSuite),
        getProject: vi.fn().mockResolvedValue(project),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/suite-1");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.id).toBe("suite-1");
      expect(body.name).toBe("Test Suite");
    });

    it("returns 404 when suite does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/nonexistent");

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(sampleSuite),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/suites/suite-1");

      expect(res.status).toBe(404);
    });
  });
});
