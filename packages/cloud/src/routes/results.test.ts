import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project, Run, TestResult } from "../types.js";
import { resultRoutes } from "./results.js";
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

const run: Run = {
  id: "run-1",
  projectId: "proj-1",
  suiteId: "suite-1",
  status: "running",
  commitSha: null,
  branch: null,
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
  complianceReport: null,
  complianceHash: null,
  startedAt: "2025-01-01T00:00:00.000Z",
  finishedAt: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};

const sampleResult: TestResult = {
  id: "res-1",
  runId: "run-1",
  testCaseName: "happy-path",
  modelId: "gpt-4o",
  passed: 1,
  passRate: 1.0,
  runCount: 3,
  judgeAvg: 0.9,
  driftScore: null,
  latencyAvgMs: 450,
  costUsd: 0.003,
  totalTokens: 500,
  failureCodes: null,
  failureMessages: null,
  assertionScores: null,
  createdAt: "2025-01-01T00:00:00.000Z",
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/runs", resultRoutes);
  return app;
}

describe("result routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /:runId/results batch inserts results", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getRun: vi.fn().mockResolvedValue(run),
      getProject: vi.fn().mockResolvedValue(project),
      createResults: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/run-1/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: [
          { testCaseName: "test-1", modelId: "gpt-4o", passed: 1, passRate: 1.0, runCount: 3 },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.count).toBe(1);
  });

  it("GET /:runId/results lists results for run", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getRun: vi.fn().mockResolvedValue(run),
      getProject: vi.fn().mockResolvedValue(project),
      listResults: vi.fn().mockResolvedValue([sampleResult]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/run-1/results");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const results = body.results as Record<string, unknown>[];
    expect(results).toHaveLength(1);
    const first = results[0];
    expect(first).toBeDefined();
    expect((first as Record<string, unknown>).testCaseName).toBe("happy-path");
  });

  it("GET /:runId/results returns 404 for other org's run", async () => {
    const otherProject = { ...project, orgId: "other-org" };
    vi.mocked(getQueries).mockReturnValue({
      getRun: vi.fn().mockResolvedValue(run),
      getProject: vi.fn().mockResolvedValue(otherProject),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/runs/run-1/results");

    expect(res.status).toBe(404);
  });
});
