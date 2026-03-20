import { describe, it, expect } from "vitest";
import { compareBaseline } from "./compare.js";
import type { BaselineData, BaselineTestEntry } from "./store.js";
import { BASELINE_VERSION } from "./store.js";

function makeEntry(overrides: Partial<BaselineTestEntry> = {}): BaselineTestEntry {
  return {
    passRate: 1,
    outputText: "Some output",
    failureCodes: [],
    latencyAvgMs: 100,
    costUsd: 0.01,
    runCount: 3,
    ...overrides,
  };
}

function makeBaseline(results: Record<string, BaselineTestEntry>): BaselineData {
  return {
    version: BASELINE_VERSION,
    suiteName: "test-suite",
    createdAt: "2026-01-15T10:00:00.000Z",
    results,
  };
}

describe("compareBaseline", () => {
  it("detects regression when pass rate drops", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 1.0 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.5, failureCodes: ["TOOL_CALL_MISSING"] }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]?.testName).toBe("test-a::gpt-4o");
    expect(result.regressions[0]?.baselinePassRate).toBe(1.0);
    expect(result.regressions[0]?.currentPassRate).toBe(0.5);
    expect(result.improvements).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("detects improvement when pass rate increases", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0.5 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 1.0 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.improvements).toHaveLength(1);
    expect(result.improvements[0]?.baselinePassRate).toBe(0.5);
    expect(result.improvements[0]?.currentPassRate).toBe(1.0);
    expect(result.regressions).toHaveLength(0);
  });

  it("reports unchanged when pass rate is identical", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0.75 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.75 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.unchanged).toHaveLength(1);
    expect(result.unchanged[0]?.passRate).toBe(0.75);
    expect(result.regressions).toHaveLength(0);
    expect(result.improvements).toHaveLength(0);
  });

  it("identifies new tests not in baseline", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry(),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry(),
      "test-b::gpt-4o": makeEntry(),
    };

    const result = compareBaseline(baseline, current);

    expect(result.newTests).toEqual(["test-b::gpt-4o"]);
    expect(result.removedTests).toHaveLength(0);
  });

  it("identifies removed tests not in current", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry(),
      "test-b::gpt-4o": makeEntry(),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry(),
    };

    const result = compareBaseline(baseline, current);

    expect(result.removedTests).toEqual(["test-b::gpt-4o"]);
    expect(result.newTests).toHaveLength(0);
  });

  it("only reports genuinely new failure codes", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 1.0, failureCodes: ["PII_DETECTED"] }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({
        passRate: 0.5,
        failureCodes: ["PII_DETECTED", "TOOL_CALL_MISSING"],
      }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]?.newFailureCodes).toEqual(["TOOL_CALL_MISSING"]);
  });

  it("treats difference within EPSILON as unchanged", () => {
    // EPSILON is 0.001, so a diff of 0.0005 should be unchanged
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0.900 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.9005 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.unchanged).toHaveLength(1);
    expect(result.regressions).toHaveLength(0);
    expect(result.improvements).toHaveLength(0);
  });

  it("treats difference at exactly EPSILON boundary as unchanged", () => {
    // Use values where the diff is exactly representable as EPSILON (0.001)
    // 0.75 + 0.001 = 0.751, but floating point means we need to be careful.
    // The comparison is: diff > EPSILON → improvement, diff < -EPSILON → regression.
    // With passRate 0 and 0.001, diff = 0.001, but 0.001 > 0.001 is false, so unchanged.
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.001 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.unchanged).toHaveLength(1);
    expect(result.improvements).toHaveLength(0);
    expect(result.regressions).toHaveLength(0);
  });

  it("detects improvement just beyond EPSILON", () => {
    // diff = 0.002 which is > EPSILON
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0.5 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.502 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.improvements).toHaveLength(1);
    expect(result.unchanged).toHaveLength(0);
  });

  it("detects regression just beyond EPSILON", () => {
    const baseline = makeBaseline({
      "test-a::gpt-4o": makeEntry({ passRate: 0.5 }),
    });
    const current: Record<string, BaselineTestEntry> = {
      "test-a::gpt-4o": makeEntry({ passRate: 0.498 }),
    };

    const result = compareBaseline(baseline, current);

    expect(result.regressions).toHaveLength(1);
    expect(result.unchanged).toHaveLength(0);
  });
});
