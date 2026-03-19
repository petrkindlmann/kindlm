import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project, Suite, Run, Baseline } from "../types.js";
import { baselineRoutes } from "./baselines.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

vi.mock("./audit-helper.js", () => ({
  auditLog: vi.fn(),
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

const suite: Suite = {
  id: "suite-1",
  projectId: "proj-1",
  name: "Test Suite",
  description: null,
  configHash: "abc123",
  tags: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const run: Run = {
  id: "run-1",
  projectId: "proj-1",
  suiteId: "suite-1",
  status: "completed",
  commitSha: "abc",
  branch: "main",
  environment: null,
  triggeredBy: null,
  passRate: 0.95,
  driftScore: null,
  schemaFailCount: 0,
  piiFailCount: 0,
  keywordFailCount: 0,
  judgeAvgScore: null,
  costEstimateUsd: null,
  latencyAvgMs: null,
  testCount: 10,
  modelCount: 1,
  gatePassed: null,
  startedAt: "2025-01-01T00:00:00.000Z",
  finishedAt: "2025-01-01T00:01:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const sampleBaseline: Baseline = {
  id: "bl-1",
  suiteId: "suite-1",
  runId: "run-1",
  label: "v1.0",
  isActive: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  activatedAt: null,
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/baselines", baselineRoutes);
  return app;
}

describe("baseline routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /:suiteId/baselines", () => {
    it("creates a baseline", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        getRun: vi.fn().mockResolvedValue(run),
        createBaseline: vi.fn().mockResolvedValue(sampleBaseline),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1", label: "v1.0" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.id).toBe("bl-1");
      expect(body.label).toBe("v1.0");
      expect(body.suiteId).toBe("suite-1");
    });

    it("returns 404 when suite does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/nonexistent/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1", label: "v1.0" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1", label: "v1.0" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when run does not belong to suite", async () => {
      const otherRun = { ...run, suiteId: "other-suite" };
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        getRun: vi.fn().mockResolvedValue(otherRun),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1", label: "v1.0" }),
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("Run not found");
    });

    it("returns 400 when label is missing", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when runId is missing", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "v1.0" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:suiteId/baselines", () => {
    it("lists baselines for a suite", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        listBaselines: vi.fn().mockResolvedValue([sampleBaseline]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const baselines = body.baselines as Record<string, unknown>[];
      expect(baselines).toHaveLength(1);
      expect(baselines[0]?.id).toBe("bl-1");
    });

    it("returns 404 when suite does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/nonexistent/baselines");

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/suite-1/baselines");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /:baselineId/activate", () => {
    it("activates a baseline", async () => {
      const activated = { ...sampleBaseline, isActive: 1, activatedAt: "2025-01-02T00:00:00.000Z" };
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn()
          .mockResolvedValueOnce(sampleBaseline)
          .mockResolvedValueOnce(activated),
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        activateBaseline: vi.fn().mockResolvedValue(true),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/bl-1/activate", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.isActive).toBe(1);
    });

    it("returns 404 when baseline does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/nonexistent/activate", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(sampleBaseline),
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/bl-1/activate", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });

    it("returns 500 when activation fails", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(sampleBaseline),
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        activateBaseline: vi.fn().mockResolvedValue(false),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/bl-1/activate", {
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("Failed to activate");
    });
  });

  describe("DELETE /:baselineId", () => {
    it("deletes a baseline", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(sampleBaseline),
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(project),
        deleteBaseline: vi.fn().mockResolvedValue(true),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/bl-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("returns 404 when baseline does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getBaseline: vi.fn().mockResolvedValue(sampleBaseline),
        getSuite: vi.fn().mockResolvedValue(suite),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/baselines/bl-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
