import { describe, it, expect } from "vitest";
import { aggregateRuns } from "./aggregator.js";
import type { TestCaseRunResult } from "./aggregator.js";
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
    outputText: "Hello",
    assertions: [makeAssertion()],
    latencyMs: 100,
    tokenUsage: { inputTokens: 50, outputTokens: 50, totalTokens: 100 },
    costEstimateUsd: 0.01,
    ...overrides,
  };
}

describe("aggregateRuns", () => {
  it("returns error on empty array", () => {
    const result = aggregateRuns([]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("at least one run");
    }
  });

  it("aggregates a single passing run", () => {
    const result = aggregateRuns([makeRun()]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.runCount).toBe(1);
    expect(result.data.passed).toBe(true);
    expect(result.data.passRate).toBe(1);
    expect(result.data.testCaseName).toBe("happy-path");
    expect(result.data.modelId).toBe("openai:gpt-4o");
  });

  it("computes pass rate across multiple runs", () => {
    const runs = [
      makeRun({ runIndex: 0 }),
      makeRun({
        runIndex: 1,
        assertions: [makeAssertion({ passed: false, failureCode: "TOOL_CALL_MISSING" })],
      }),
      makeRun({ runIndex: 2 }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.runCount).toBe(3);
    expect(result.data.passRate).toBeCloseTo(2 / 3);
    expect(result.data.passed).toBe(false);
  });

  it("computes assertion scores by type", () => {
    const runs = [
      makeRun({
        runIndex: 0,
        assertions: [
          makeAssertion({ assertionType: "judge", score: 0.8 }),
          makeAssertion({ assertionType: "schema", score: 1.0 }),
        ],
      }),
      makeRun({
        runIndex: 1,
        assertions: [
          makeAssertion({ assertionType: "judge", score: 0.6 }),
          makeAssertion({ assertionType: "schema", score: 1.0 }),
        ],
      }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const judgeScores = result.data.assertionScores["judge"];
    expect(judgeScores).toBeDefined();
    expect(judgeScores?.mean).toBeCloseTo(0.7);
    expect(judgeScores?.min).toBe(0.6);
    expect(judgeScores?.max).toBe(0.8);
    const schemaScores = result.data.assertionScores["schema"];
    expect(schemaScores?.mean).toBe(1.0);
  });

  it("collects unique failure codes", () => {
    const runs = [
      makeRun({
        runIndex: 0,
        assertions: [makeAssertion({ passed: false, failureCode: "PII_DETECTED" })],
      }),
      makeRun({
        runIndex: 1,
        assertions: [
          makeAssertion({ passed: false, failureCode: "PII_DETECTED" }),
          makeAssertion({ passed: false, failureCode: "SCHEMA_INVALID" }),
        ],
      }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.failureCodes).toContain("PII_DETECTED");
    expect(result.data.failureCodes).toContain("SCHEMA_INVALID");
    expect(result.data.failureCodes).toHaveLength(2);
  });

  it("computes average latency", () => {
    const runs = [
      makeRun({ runIndex: 0, latencyMs: 100 }),
      makeRun({ runIndex: 1, latencyMs: 200 }),
      makeRun({ runIndex: 2, latencyMs: 300 }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.latencyAvgMs).toBe(200);
  });

  it("sums cost and tokens", () => {
    const runs = [
      makeRun({
        runIndex: 0,
        costEstimateUsd: 0.05,
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      }),
      makeRun({
        runIndex: 1,
        costEstimateUsd: 0.03,
        tokenUsage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
      }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalCostUsd).toBeCloseTo(0.08);
    expect(result.data.totalTokens).toBe(270);
  });

  it("handles null cost estimates", () => {
    const runs = [
      makeRun({ runIndex: 0, costEstimateUsd: null }),
      makeRun({ runIndex: 1, costEstimateUsd: 0.02 }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalCostUsd).toBeCloseTo(0.02);
  });

  it("preserves original runs in result", () => {
    const runs = [makeRun({ runIndex: 0 }), makeRun({ runIndex: 1 })];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.runs).toHaveLength(2);
    expect(result.data.runs).toBe(runs);
  });
});
