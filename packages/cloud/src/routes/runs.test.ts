import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project, Suite, Run } from "../types.js";
import { runRoutes } from "./runs.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

vi.mock("../webhooks/dispatch.js", () => ({
  dispatchWebhooks: vi.fn().mockResolvedValue(undefined),
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

const sampleRun: Run = {
  id: "run-1",
  projectId: "proj-1",
  suiteId: "suite-1",
  status: "running",
  commitSha: "abc",
  branch: "main",
  environment: null,
  triggeredBy: null,
  passRate: null,
  driftScore: null,
  schemaFailCount: 0,
  piiFailCount: 0,
  keywordFailCount: 0,
  judgeAvgScore: null,
  costEstimateUsd: null,
  latencyAvgMs: null,
  testCount: 0,
  modelCount: 0,
  gatePassed: null,
  startedAt: "2025-01-01T00:00:00.000Z",
  finishedAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/runs", runRoutes);
  return app;
}

describe("run routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /:projectId/runs creates run with running status", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getProject: vi.fn().mockResolvedValue(project),
      getSuite: vi.fn().mockResolvedValue(suite),
      createRun: vi.fn().mockResolvedValue(sampleRun),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/proj-1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suiteId: "suite-1", commitSha: "abc", branch: "main" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("running");
  });

  it("PATCH /:runId updates run with metrics", async () => {
    const updated = { ...sampleRun, status: "completed" as const, passRate: 0.95 };
    vi.mocked(getQueries).mockReturnValue({
      getRun: vi.fn().mockResolvedValue(sampleRun),
      getProject: vi.fn().mockResolvedValue(project),
      updateRun: vi.fn().mockResolvedValue(updated),
      listWebhooksByEvent: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/run-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", passRate: 0.95 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("completed");
    expect(body.passRate).toBe(0.95);
  });

  it("GET /:projectId/runs lists runs with pagination", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getProject: vi.fn().mockResolvedValue(project),
      listRuns: vi.fn().mockResolvedValue({ runs: [sampleRun], total: 1 }),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/proj-1/runs?limit=10&offset=0");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.runs).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("GET /:runId returns 404 for other org's run", async () => {
    const otherProject = { ...project, orgId: "other-org" };
    vi.mocked(getQueries).mockReturnValue({
      getRun: vi.fn().mockResolvedValue(sampleRun),
      getProject: vi.fn().mockResolvedValue(otherProject),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/run-1");

    expect(res.status).toBe(404);
  });
});
