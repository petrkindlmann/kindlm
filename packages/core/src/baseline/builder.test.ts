import { describe, it, expect } from "vitest";
import { buildBaselineData } from "./builder.js";
import { BASELINE_VERSION } from "./store.js";
import type { AggregatedTestResult } from "../engine/aggregator.js";
import type { TestCaseRunResult } from "../engine/aggregator.js";
import type { AssertionResult } from "../assertions/interface.js";

function makeAssertion(overrides: Partial<AssertionResult> = {}): AssertionResult {
  return {
    assertionType: "tool_called",
    label: "tool_called:lookup_order",
    passed: true,
    score: 1,
    ...overrides,
  };
}

function makeRun(overrides: Partial<TestCaseRunResult> = {}): TestCaseRunResult {
  return {
    testCaseName: "happy-path",
    modelId: "openai:gpt-4o",
    runIndex: 0,
    outputText: "Hello from run",
    assertions: [makeAssertion()],
    latencyMs: 100,
    tokenUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
    costEstimateUsd: 0.01,
    ...overrides,
  };
}

function makeAggregated(overrides: Partial<AggregatedTestResult> = {}): AggregatedTestResult {
  return {
    testCaseName: "happy-path",
    modelId: "openai:gpt-4o",
    runCount: 3,
    passed: true,
    passRate: 1,
    assertionScores: {},
    failureCodes: [],
    latencyAvgMs: 150,
    totalCostUsd: 0.03,
    totalTokens: 300,
    runs: [
      makeRun({ runIndex: 0, outputText: "Passing output" }),
      makeRun({ runIndex: 1, outputText: "Second output" }),
      makeRun({ runIndex: 2, outputText: "Third output" }),
    ],
    ...overrides,
  };
}

describe("buildBaselineData", () => {
  it("creates baseline with correct structure", () => {
    const agg = [makeAggregated()];
    const result = buildBaselineData("refund-agent", agg, "2026-01-15T10:00:00.000Z");

    expect(result.version).toBe(BASELINE_VERSION);
    expect(result.suiteName).toBe("refund-agent");
    expect(result.createdAt).toBe("2026-01-15T10:00:00.000Z");

    const entry = result.results["happy-path::openai:gpt-4o"];
    expect(entry).toBeDefined();
    expect(entry?.passRate).toBe(1);
    expect(entry?.runCount).toBe(3);
    expect(entry?.latencyAvgMs).toBe(150);
    expect(entry?.costUsd).toBe(0.03);
    expect(entry?.failureCodes).toEqual([]);
  });

  it("picks passing run output as representative", () => {
    const failingRun = makeRun({
      runIndex: 0,
      outputText: "Failed output",
      assertions: [makeAssertion({ passed: false, failureCode: "TOOL_CALL_MISSING" })],
    });
    const passingRun = makeRun({ runIndex: 1, outputText: "Good output" });

    const agg = [
      makeAggregated({
        passRate: 0.5,
        passed: false,
        runs: [failingRun, passingRun],
      }),
    ];

    const result = buildBaselineData("suite", agg, "2026-01-15T10:00:00.000Z");
    const entry = result.results["happy-path::openai:gpt-4o"];
    expect(entry?.outputText).toBe("Good output");
  });

  it("handles multiple tests and models", () => {
    const agg = [
      makeAggregated({ testCaseName: "test-a", modelId: "openai:gpt-4o" }),
      makeAggregated({ testCaseName: "test-a", modelId: "anthropic:claude-sonnet" }),
      makeAggregated({ testCaseName: "test-b", modelId: "openai:gpt-4o" }),
    ];

    const result = buildBaselineData("suite", agg, "2026-01-15T10:00:00.000Z");

    expect(Object.keys(result.results)).toHaveLength(3);
    expect(result.results["test-a::openai:gpt-4o"]).toBeDefined();
    expect(result.results["test-a::anthropic:claude-sonnet"]).toBeDefined();
    expect(result.results["test-b::openai:gpt-4o"]).toBeDefined();
  });
});
