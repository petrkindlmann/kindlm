import { describe, it, expect } from "vitest";
import { createPrettyReporter } from "./pretty.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    totalTests: 2,
    passed: 2,
    failed: 0,
    errored: 0,
    skipped: 0,
    durationMs: 1234,
    suites: [
      {
        name: "refund-agent",
        status: "passed",
        tests: [
          {
            name: "happy-path",
            modelId: "",
            status: "passed",
            assertions: [
              { assertionType: "tool_called", label: "tool_called:lookup_order", passed: true, score: 1 },
            ],
            latencyMs: 500,
            costUsd: 0.01,
          },
          {
            name: "edge-case",
            modelId: "",
            status: "passed",
            assertions: [
              { assertionType: "no_pii", label: "no_pii", passed: true, score: 1 },
            ],
            latencyMs: 600,
            costUsd: 0.01,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeGateEval(overrides: Partial<GateEvaluation> = {}): GateEvaluation {
  return {
    passed: true,
    gates: [
      { gateName: "passRateMin", passed: true, actual: 1, threshold: 0.95, message: "Pass rate 100.0% meets minimum 95.0%" },
    ],
    ...overrides,
  };
}

describe("createPrettyReporter", () => {
  const reporter = createPrettyReporter();

  it("generates text format output", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("text");
  });

  it("contains key sections for passing run", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("KindLM Test Results");
    expect(output.content).toContain("refund-agent");
    expect(output.content).toContain("happy-path");
    expect(output.content).toContain("Summary");
    expect(output.content).toContain("2 passed");
    expect(output.content).toContain("All tests passed");
  });

  it("shows failure details for failing tests", () => {
    const failRun = makeRunResult({
      passed: 1,
      failed: 1,
      suites: [
        {
          name: "refund-agent",
          status: "failed",
          tests: [
            {
              name: "happy-path",
              modelId: "",
              status: "passed",
              assertions: [{ assertionType: "tool_called", label: "tool_called:lookup_order", passed: true, score: 1 }],
              latencyMs: 500,
              costUsd: 0.01,
            },
            {
              name: "pii-leak",
              modelId: "",
              status: "failed",
              assertions: [
                {
                  assertionType: "no_pii",
                  label: "no_pii",
                  passed: false,
                  score: 0,
                  failureCode: "PII_DETECTED",
                  failureMessage: "SSN detected in output",
                },
              ],
              latencyMs: 300,
              costUsd: 0.01,
            },
          ],
        },
      ],
    });
    const output = reporter.generate(failRun, makeGateEval({ passed: false }));
    expect(output.content).toContain("SSN detected in output");
    expect(output.content).toContain("Some tests failed");
  });

  it("includes quality gates section", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Quality Gates");
    expect(output.content).toContain("Pass rate 100.0% meets minimum 95.0%");
  });
});
