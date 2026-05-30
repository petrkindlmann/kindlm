import { describe, it, expect } from "vitest";
import { aggregateRuns } from "./aggregator.js";
import type { TestCaseRunResult } from "./aggregator.js";
import type { AssertionResult } from "../assertions/interface.js";

function makeAssertion(overrides: Partial<AssertionResult> = {}): AssertionResult {
  return {
    assertionType: "output_contains",
    label: "contains hello",
    passed: true,
    score: 1,
    ...overrides,
  };
}

function makeRun(overrides: Partial<TestCaseRunResult> = {}): TestCaseRunResult {
  return {
    testCaseName: "test-1",
    modelId: "gpt-4o",
    runIndex: 0,
    outputText: "hello world",
    assertions: [makeAssertion()],
    latencyMs: 100,
    tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    costEstimateUsd: 0.001,
    ...overrides,
  };
}

/** Build N runs alternating pass/fail to reach `passing` passing runs. */
function makeRuns(passing: number, total: number): TestCaseRunResult[] {
  return Array.from({ length: total }, (_, i) =>
    makeRun({
      runIndex: i,
      assertions: [
        makeAssertion({ passed: i < passing, score: i < passing ? 1 : 0 }),
      ],
    }),
  );
}

describe("aggregateRuns", () => {
  it("aggregates a single passing run", () => {
    const result = aggregateRuns([makeRun()]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRate).toBe(1);
    expect(result.data.passed).toBe(true);
    expect(result.data.runCount).toBe(1);
  });

  it("computes pass rate across multiple runs", () => {
    const runs = [
      makeRun({ runIndex: 0, assertions: [makeAssertion({ passed: true, score: 1 })] }),
      makeRun({ runIndex: 1, assertions: [makeAssertion({ passed: false, score: 0 })] }),
      makeRun({ runIndex: 2, assertions: [makeAssertion({ passed: true, score: 1 })] }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRate).toBeCloseTo(0.667, 2);
    expect(result.data.passed).toBe(false);
  });

  it("collects unique failure codes", () => {
    const runs = [
      makeRun({
        assertions: [
          makeAssertion({ passed: false, failureCode: "TOOL_CALL_MISSING" }),
        ],
      }),
    ];
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.failureCodes).toContain("TOOL_CALL_MISSING");
  });
});

describe("passK and passAtK", () => {
  it("2/3 runs passing: passK ≈ 0.296, passAtK ≈ 0.963", () => {
    const result = aggregateRuns(makeRuns(2, 3));
    expect(result.success).toBe(true);
    if (!result.success) return;
    // p = 2/3, k = 3 → p^3 = 0.2963, 1-(1-p)^3 = 0.9630
    expect(result.data.passK).toBeCloseTo(0.2963, 3);
    expect(result.data.passAtK).toBeCloseTo(0.963, 3);
  });

  it("all passing: passK = passAtK = 1", () => {
    const result = aggregateRuns(makeRuns(3, 3));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passK).toBe(1);
    expect(result.data.passAtK).toBe(1);
  });

  it("none passing: passK = passAtK = 0", () => {
    const result = aggregateRuns(makeRuns(0, 3));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passK).toBe(0);
    expect(result.data.passAtK).toBe(0);
  });

  it("single run (repeat=1): runCount=1 and passK = passRate (p^1)", () => {
    const result = aggregateRuns([makeRun()]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.runCount).toBe(1);
    expect(result.data.passK).toBe(result.data.passRate);
    expect(result.data.passAtK).toBe(result.data.passRate);
  });
});

describe("passRateCI", () => {
  it("lo <= hi always", () => {
    const result = aggregateRuns(makeRuns(2, 5));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRateCI.lo).toBeLessThanOrEqual(result.data.passRateCI.hi);
  });

  it("lo and hi are both in [0, 1]", () => {
    const result = aggregateRuns(makeRuns(3, 7));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRateCI.lo).toBeGreaterThanOrEqual(0);
    expect(result.data.passRateCI.lo).toBeLessThanOrEqual(1);
    expect(result.data.passRateCI.hi).toBeGreaterThanOrEqual(0);
    expect(result.data.passRateCI.hi).toBeLessThanOrEqual(1);
  });

  it("method is bootstrap-percentile", () => {
    const result = aggregateRuns(makeRuns(2, 4));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRateCI.method).toBe("bootstrap-percentile");
    expect(result.data.passRateCI.level).toBe(0.95);
  });

  it("single run is degenerate but not NaN (lo == hi == 1 or 0)", () => {
    const passing = aggregateRuns([makeRun()]);
    expect(passing.success).toBe(true);
    if (!passing.success) return;
    expect(passing.data.passRateCI.lo).toBe(1);
    expect(passing.data.passRateCI.hi).toBe(1);
    expect(Number.isNaN(passing.data.passRateCI.lo)).toBe(false);

    const failing = aggregateRuns([
      makeRun({ assertions: [makeAssertion({ passed: false, score: 0 })] }),
    ]);
    expect(failing.success).toBe(true);
    if (!failing.success) return;
    expect(failing.data.passRateCI.lo).toBe(0);
    expect(failing.data.passRateCI.hi).toBe(0);
    expect(Number.isNaN(failing.data.passRateCI.lo)).toBe(false);
  });
});

describe("passRateStdDev", () => {
  it("all-pass series: stdDev = 0", () => {
    const result = aggregateRuns(makeRuns(4, 4));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRateStdDev).toBe(0);
  });

  it("mixed series: stdDev > 0", () => {
    const result = aggregateRuns(makeRuns(2, 4));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.passRateStdDev).toBeGreaterThan(0);
  });
});

describe("latency stats", () => {
  const runs = [
    makeRun({ runIndex: 0, latencyMs: 50 }),
    makeRun({ runIndex: 1, latencyMs: 100 }),
    makeRun({ runIndex: 2, latencyMs: 200 }),
    makeRun({ runIndex: 3, latencyMs: 400 }),
  ];

  it("p50/p95/p99 are computed (not NaN)", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Number.isNaN(result.data.latency.p50)).toBe(false);
    expect(Number.isNaN(result.data.latency.p95)).toBe(false);
    expect(Number.isNaN(result.data.latency.p99)).toBe(false);
  });

  it("min <= p50 <= max", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const { min, p50, max } = result.data.latency;
    expect(min).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(max);
    expect(min).toBe(50);
    expect(max).toBe(400);
  });

  it("latencyAvgMs === latency.mean (back-compat)", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.latencyAvgMs).toBe(result.data.latency.mean);
    expect(result.data.latency.mean).toBe((50 + 100 + 200 + 400) / 4);
  });
});

describe("efficiency stats", () => {
  const runs = [
    makeRun({
      runIndex: 0,
      costEstimateUsd: 0.002,
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      assertions: [makeAssertion(), makeAssertion({ assertionType: "tool_called" })],
    }),
    makeRun({
      runIndex: 1,
      costEstimateUsd: 0.004,
      tokenUsage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
      assertions: [
        makeAssertion(),
        makeAssertion({ assertionType: "tool_called" }),
        makeAssertion({ assertionType: "tool_called" }),
      ],
    }),
  ];

  it("costPerTaskUsd = totalCostUsd / runCount", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency.costPerTaskUsd).toBeCloseTo(
      result.data.totalCostUsd / result.data.runCount,
      10,
    );
    expect(result.data.efficiency.costPerTaskUsd).toBeCloseTo(0.003, 10);
  });

  it("tokensPerTask = totalTokens / runCount", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency.tokensPerTask).toBeCloseTo(
      result.data.totalTokens / result.data.runCount,
      10,
    );
    expect(result.data.efficiency.tokensPerTask).toBe(40);
  });

  it("toolCallsPerTask reflects tool_called assertion count per run", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // 1 + 2 tool_called assertions across 2 runs → 1.5 per task
    expect(result.data.efficiency.toolCallsPerTask).toBe(1.5);
  });

  it("toolCallsPerTask is 0 when no tool-call assertions present", () => {
    const result = aggregateRuns([makeRun(), makeRun({ runIndex: 1 })]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency.toolCallsPerTask).toBe(0);
  });

  it("costCI.lo <= costCI.hi", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.efficiency.costCI.lo).toBeLessThanOrEqual(
      result.data.efficiency.costCI.hi,
    );
  });

  it("null cost estimates are treated as 0", () => {
    const result = aggregateRuns([
      makeRun({ runIndex: 0, costEstimateUsd: null }),
      makeRun({ runIndex: 1, costEstimateUsd: 0.01 }),
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.totalCostUsd).toBeCloseTo(0.01, 10);
    expect(result.data.efficiency.costPerTaskUsd).toBeCloseTo(0.005, 10);
  });
});

describe("assertionScores extended", () => {
  const runs = [
    makeRun({ runIndex: 0, assertions: [makeAssertion({ score: 0.5 })] }),
    makeRun({ runIndex: 1, assertions: [makeAssertion({ score: 1 })] }),
    makeRun({ runIndex: 2, assertions: [makeAssertion({ score: 0.8 })] }),
  ];

  it("each entry has stdDev and ci fields", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.data.assertionScores["output_contains:contains hello"];
    expect(entry).toBeDefined();
    expect(entry!.stdDev).toBeGreaterThan(0);
    expect(entry!.ci.method).toBe("bootstrap-percentile");
    expect(entry!.mean).toBeCloseTo((0.5 + 1 + 0.8) / 3, 10);
  });

  it("ci.lo <= ci.hi", () => {
    const result = aggregateRuns(runs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.data.assertionScores["output_contains:contains hello"];
    expect(entry!.ci.lo).toBeLessThanOrEqual(entry!.ci.hi);
  });
});
