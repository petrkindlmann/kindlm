import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Project, Run, Baseline, TestResult } from "../types.js";
import { compareRoutes } from "./compare.js";
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

const currentRun: Run = {
  id: "run-2",
  projectId: "proj-1",
  suiteId: "suite-1",
  status: "completed",
  commitSha: "def456",
  branch: "main",
  environment: null,
  triggeredBy: null,
  passRate: 0.9,
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
  complianceReport: null,
  complianceHash: null,
  complianceSignature: null,
  complianceSignedAt: null,
  startedAt: "2025-01-02T00:00:00.000Z",
  finishedAt: "2025-01-02T00:01:00.000Z",
  createdAt: "2025-01-02T00:00:00.000Z",
};

const activeBaseline: Baseline = {
  id: "bl-1",
  suiteId: "suite-1",
  runId: "run-1",
  label: "v1.0",
  isActive: 1,
  createdAt: "2025-01-01T00:00:00.000Z",
  activatedAt: "2025-01-01T00:00:00.000Z",
};

function makeResult(overrides: Partial<TestResult>): TestResult {
  return {
    id: "res-1",
    runId: "run-1",
    testCaseName: "test-case-1",
    modelId: "gpt-4o",
    passed: 3,
    passRate: 1.0,
    runCount: 3,
    judgeAvg: null,
    driftScore: null,
    latencyAvgMs: null,
    costUsd: null,
    totalTokens: null,
    failureCodes: null,
    failureMessages: null,
    assertionScores: null,
    responseText: null,
    toolCallsJson: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/compare", compareRoutes);
  return app;
}

describe("compare routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /:runId/compare", () => {
    it("returns comparison data with diffs", async () => {
      const baselineResult = makeResult({
        id: "res-1",
        runId: "run-1",
        testCaseName: "refund-test",
        modelId: "gpt-4o",
        passRate: 1.0,
      });
      const currentResult = makeResult({
        id: "res-2",
        runId: "run-2",
        testCaseName: "refund-test",
        modelId: "gpt-4o",
        passRate: 0.8,
      });

      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(project),
        getActiveBaseline: vi.fn().mockResolvedValue(activeBaseline),
        listResults: vi.fn()
          .mockResolvedValueOnce([baselineResult])   // baseline results
          .mockResolvedValueOnce([currentResult]),    // current results
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.hasBaseline).toBe(true);

      const baseline = body.baseline as Record<string, unknown>;
      expect(baseline.id).toBe("bl-1");
      expect(baseline.label).toBe("v1.0");

      const summary = body.summary as Record<string, number>;
      expect(summary.regressions).toBe(1);
      expect(summary.improvements).toBe(0);
      expect(summary.unchanged).toBe(0);

      const diffs = body.diffs as Array<Record<string, unknown>>;
      expect(diffs).toHaveLength(1);
      expect(diffs[0]?.status).toBe("regression");
      expect(diffs[0]?.baselinePassRate).toBe(1.0);
      expect(diffs[0]?.currentPassRate).toBe(0.8);
    });

    it("detects improvements", async () => {
      const baselineResult = makeResult({
        runId: "run-1",
        testCaseName: "test-1",
        modelId: "gpt-4o",
        passRate: 0.5,
      });
      const currentResult = makeResult({
        runId: "run-2",
        testCaseName: "test-1",
        modelId: "gpt-4o",
        passRate: 0.9,
      });

      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(project),
        getActiveBaseline: vi.fn().mockResolvedValue(activeBaseline),
        listResults: vi.fn()
          .mockResolvedValueOnce([baselineResult])
          .mockResolvedValueOnce([currentResult]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const summary = body.summary as Record<string, number>;
      expect(summary.improvements).toBe(1);
      expect(summary.regressions).toBe(0);
    });

    it("detects new and removed tests", async () => {
      const baselineResult = makeResult({
        runId: "run-1",
        testCaseName: "removed-test",
        modelId: "gpt-4o",
        passRate: 1.0,
      });
      const currentResult = makeResult({
        runId: "run-2",
        testCaseName: "new-test",
        modelId: "gpt-4o",
        passRate: 0.9,
      });

      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(project),
        getActiveBaseline: vi.fn().mockResolvedValue(activeBaseline),
        listResults: vi.fn()
          .mockResolvedValueOnce([baselineResult])
          .mockResolvedValueOnce([currentResult]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const summary = body.summary as Record<string, number>;
      expect(summary.new).toBe(1);
      expect(summary.removed).toBe(1);

      const diffs = body.diffs as Array<Record<string, unknown>>;
      const newDiff = diffs.find((d) => d.status === "new");
      const removedDiff = diffs.find((d) => d.status === "removed");
      expect(newDiff).toBeDefined();
      expect(newDiff?.testCaseName).toBe("new-test");
      expect(newDiff?.baselinePassRate).toBeNull();
      expect(removedDiff).toBeDefined();
      expect(removedDiff?.testCaseName).toBe("removed-test");
      expect(removedDiff?.currentPassRate).toBeNull();
    });

    it("returns hasBaseline: false when no active baseline exists", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(project),
        getActiveBaseline: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.hasBaseline).toBe(false);
      expect(body.diffs).toBeUndefined();
    });

    it("returns 404 when run does not exist", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/nonexistent/compare");

      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-org access", async () => {
      const otherProject = { ...project, orgId: "other-org" };
      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(otherProject),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(404);
    });

    it("handles unchanged results with delta near zero", async () => {
      const baselineResult = makeResult({
        runId: "run-1",
        testCaseName: "stable-test",
        modelId: "gpt-4o",
        passRate: 0.95,
      });
      const currentResult = makeResult({
        runId: "run-2",
        testCaseName: "stable-test",
        modelId: "gpt-4o",
        passRate: 0.95,
      });

      vi.mocked(getQueries).mockReturnValue({
        getRun: vi.fn().mockResolvedValue(currentRun),
        getProject: vi.fn().mockResolvedValue(project),
        getActiveBaseline: vi.fn().mockResolvedValue(activeBaseline),
        listResults: vi.fn()
          .mockResolvedValueOnce([baselineResult])
          .mockResolvedValueOnce([currentResult]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/compare/run-2/compare");

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      const summary = body.summary as Record<string, number>;
      expect(summary.unchanged).toBe(1);
      expect(summary.regressions).toBe(0);
      expect(summary.improvements).toBe(0);
    });
  });
});
