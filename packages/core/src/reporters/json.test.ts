import { describe, it, expect } from "vitest";
import { createJsonReporter } from "./json.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

function makeRunResult(): RunResult {
  return {
    totalTests: 3,
    passed: 2,
    failed: 1,
    errored: 0,
    skipped: 0,
    durationMs: 2000,
    suites: [
      {
        name: "suite-a",
        status: "failed",
        tests: [
          { name: "test-1", modelId: "", status: "passed", assertions: [], latencyMs: 500, costUsd: 0.01 },
          { name: "test-2", modelId: "", status: "passed", assertions: [], latencyMs: 600, costUsd: 0.02 },
          {
            name: "test-3",
            modelId: "",
            status: "failed",
            assertions: [
              { assertionType: "schema", label: "schema", passed: false, score: 0, failureCode: "SCHEMA_INVALID", failureMessage: "Invalid output" },
            ],
            latencyMs: 400,
            costUsd: 0.01,
          },
        ],
      },
    ],
  };
}

function makeGateEval(): GateEvaluation {
  return {
    passed: false,
    gates: [
      { gateName: "passRateMin", passed: false, actual: 0.67, threshold: 0.95, message: "Pass rate below min" },
    ],
  };
}

describe("createJsonReporter", () => {
  const reporter = createJsonReporter();

  it("generates valid JSON", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("json");
    expect(() => JSON.parse(output.content)).not.toThrow();
  });

  it("includes all top-level sections", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed).toHaveProperty("kindlm");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("gates");
    expect(parsed).toHaveProperty("suites");
  });

  it("has correct summary numbers", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed.summary.totalTests).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.durationMs).toBe(2000);
  });

  it("includes gate results", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed.gates.passed).toBe(false);
    expect(parsed.gates.results).toHaveLength(1);
    expect(parsed.gates.results[0].gateName).toBe("passRateMin");
  });

  it("includes statistical fields (passK, passAtK, passRateCI, latency, efficiency) when runCount > 1", async () => {
    const runResult: RunResult = {
      totalTests: 1,
      passed: 1,
      failed: 0,
      errored: 0,
      skipped: 0,
      durationMs: 1000,
      suites: [
        {
          name: "stat-suite",
          status: "passed",
          tests: [
            {
              name: "multi-run",
              modelId: "gpt-4o",
              status: "passed",
              assertions: [],
              latencyMs: 240,
              costUsd: 0.06,
              runCount: 5,
              passRate: 0.8,
              passK: 0.328,
              passAtK: 0.9997,
              passRateCI: { lo: 0.52, hi: 0.97, level: 0.95, method: "bootstrap-percentile", resamples: 1000 },
              latency: { mean: 240, p50: 240, p95: 890, p99: 1120, min: 100, max: 1200 },
              efficiency: {
                costPerTaskUsd: 0.012,
                tokensPerTask: 3847,
                toolCallsPerTask: 2,
                costCI: { lo: 0.01, hi: 0.014, level: 0.95, method: "bootstrap-percentile", resamples: 1000 },
              },
            },
          ],
        },
      ],
    };
    const output = await reporter.generate(runResult, { passed: true, gates: [] });
    const test = JSON.parse(output.content).suites[0].tests[0];
    expect(test.runCount).toBe(5);
    expect(test.passRate).toBe(0.8);
    expect(test.passK).toBe(0.328);
    expect(test.passAtK).toBe(0.9997);
    expect(test.passRateCI).toMatchObject({ lo: 0.52, hi: 0.97 });
    expect(test.latency).toMatchObject({ p50: 240, p95: 890, p99: 1120 });
    expect(test.efficiency).toMatchObject({ costPerTaskUsd: 0.012, tokensPerTask: 3847, toolCallsPerTask: 2 });
  });

  it("omits statistical fields when runCount is undefined", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    const test = JSON.parse(output.content).suites[0].tests[0];
    expect(test).not.toHaveProperty("runCount");
    expect(test).not.toHaveProperty("passK");
    expect(test).not.toHaveProperty("latency");
  });
});
