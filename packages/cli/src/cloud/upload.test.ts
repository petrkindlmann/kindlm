import { describe, it, expect, vi } from "vitest";
import type { CloudClient } from "./client.js";
import type { RunnerResult, AggregatedTestResult } from "@kindlm/core";
import { uploadResults, mapAggregatedResults } from "./upload.js";

function makeAggregated(overrides: Partial<AggregatedTestResult> = {}): AggregatedTestResult {
  return {
    testCaseName: "test-1",
    modelId: "openai:gpt-4o",
    runCount: 3,
    passed: true,
    passRate: 1.0,
    assertionScores: { tool_called: { mean: 1, min: 1, max: 1 } },
    failureCodes: [],
    latencyAvgMs: 450,
    totalCostUsd: 0.05,
    totalTokens: 1200,
    runs: [
      {
        testCaseName: "test-1",
        modelId: "openai:gpt-4o",
        runIndex: 0,
        outputText: "response text",
        assertions: [{ assertionType: "tool_called", label: "tool_called: lookup", passed: true, score: 1 }],
        latencyMs: 450,
        tokenUsage: { inputTokens: 400, outputTokens: 800, totalTokens: 1200 },
        costEstimateUsd: 0.05,
      },
    ],
    ...overrides,
  };
}

function makeRunnerResult(aggregated: AggregatedTestResult[]): RunnerResult {
  return {
    runResult: {
      suites: [{ name: "suite-1", status: "passed", tests: [] }],
      totalTests: aggregated.length,
      passed: aggregated.filter((a) => a.passed).length,
      failed: aggregated.filter((a) => !a.passed).length,
      errored: 0,
      skipped: 0,
      durationMs: 1000,
    },
    aggregated,
  };
}

function createMockClient(): CloudClient & { calls: Array<{ method: string; path: string; body?: unknown }> } {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];

  const getMock = vi.fn(async (path: string) => {
    calls.push({ method: "GET", path });
    if (path === "/v1/projects") return { projects: [] };
    if (path.includes("/suites")) return { suites: [] };
    return {};
  });

  const postMock = vi.fn(async (path: string, body: unknown) => {
    calls.push({ method: "POST", path, body });
    if (path === "/v1/projects") return { id: "proj-1", name: "test-project" };
    if (path.includes("/suites")) return { id: "suite-1", name: "test-suite" };
    if (path.includes("/runs")) return { id: "run-1" };
    return { count: 1 };
  });

  const patchMock = vi.fn(async (path: string, body: unknown) => {
    calls.push({ method: "PATCH", path, body });
    return {};
  });

  const deleteMock = vi.fn(async (path: string) => {
    calls.push({ method: "DELETE", path });
  });

  return {
    baseUrl: "https://api.test.com",
    calls,
    get: getMock as CloudClient["get"],
    post: postMock as CloudClient["post"],
    patch: patchMock as CloudClient["patch"],
    delete: deleteMock as CloudClient["delete"],
  };
}

describe("uploadResults", () => {
  it("creates project → suite → run → results → finalizes run", async () => {
    const client = createMockClient();
    const runnerResult = makeRunnerResult([makeAggregated()]);

    const result = await uploadResults(client, runnerResult, {
      projectName: "test-project",
      suiteName: "test-suite",
      configHash: "abc123",
      commitSha: "sha1",
      branch: "main",
    });

    expect(result.runId).toBe("run-1");
    expect(result.projectId).toBe("proj-1");

    // Verify call sequence
    const methods = client.calls.map((c) => c.method);
    expect(methods).toEqual(["GET", "POST", "GET", "POST", "POST", "POST", "PATCH"]);

    // Verify run was finalized with status completed
    const patchCall = client.calls.find((c) => c.method === "PATCH");
    expect(patchCall?.body).toMatchObject({ status: "completed" });
  });

  it("batches results in chunks of 50", async () => {
    const client = createMockClient();
    // Create 120 aggregated results
    const aggregated = Array.from({ length: 120 }, (_, i) =>
      makeAggregated({ testCaseName: `test-${i}` }),
    );
    const runnerResult = makeRunnerResult(aggregated);

    await uploadResults(client, runnerResult, {
      projectName: "test-project",
      suiteName: "test-suite",
      configHash: "abc123",
    });

    // Should have 3 POST calls for results (50 + 50 + 20)
    const resultPosts = client.calls.filter(
      (c) => c.method === "POST" && c.path.includes("/results"),
    );
    expect(resultPosts).toHaveLength(3);

    const batchSizes = resultPosts.map(
      (c) => (c.body as { results: unknown[] }).results.length,
    );
    expect(batchSizes).toEqual([50, 50, 20]);
  });

  it("reuses existing project and suite", async () => {
    const client = createMockClient();
    // Override to return existing project/suite
    const getMock = vi.fn(async (path: string) => {
      client.calls.push({ method: "GET", path });
      if (path === "/v1/projects") {
        return { projects: [{ id: "existing-proj", name: "test-project" }] };
      }
      if (path.includes("/suites")) {
        return { suites: [{ id: "existing-suite", name: "test-suite" }] };
      }
      return {};
    });
    client.get = getMock as CloudClient["get"];

    const runnerResult = makeRunnerResult([makeAggregated()]);

    await uploadResults(client, runnerResult, {
      projectName: "test-project",
      suiteName: "test-suite",
      configHash: "abc123",
    });

    // No POST for project or suite creation
    const postCalls = client.calls.filter((c) => c.method === "POST");
    expect(postCalls).toHaveLength(2); // Only run + results
  });
});

describe("mapAggregatedResults", () => {
  it("maps AggregatedTestResult to Cloud format", () => {
    const agg = makeAggregated({
      failureCodes: ["TOOL_CALL_MISSING"],
      runs: [
        {
          testCaseName: "test-1",
          modelId: "openai:gpt-4o",
          runIndex: 0,
          outputText: "text",
          assertions: [
            { assertionType: "tool_called", label: "tool_called: lookup", passed: false, score: 0, failureCode: "TOOL_CALL_MISSING", failureMessage: "Expected tool_called: lookup" },
          ],
          latencyMs: 200,
          tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          costEstimateUsd: 0.01,
        },
      ],
      passed: false,
      passRate: 0,
    });

    const results = mapAggregatedResults([agg]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      testCaseName: "test-1",
      modelId: "openai:gpt-4o",
      passed: 0,
      passRate: 0,
      failureCodes: JSON.stringify(["TOOL_CALL_MISSING"]),
    });
    expect(results[0]?.failureMessages).not.toBeNull();
  });
});
