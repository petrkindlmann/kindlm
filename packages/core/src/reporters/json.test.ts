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

  it("generates valid JSON", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("json");
    expect(() => JSON.parse(output.content)).not.toThrow();
  });

  it("includes all top-level sections", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed).toHaveProperty("kindlm");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("gates");
    expect(parsed).toHaveProperty("suites");
  });

  it("has correct summary numbers", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed.summary.totalTests).toBe(3);
    expect(parsed.summary.passed).toBe(2);
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.summary.durationMs).toBe(2000);
  });

  it("includes gate results", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    const parsed = JSON.parse(output.content);
    expect(parsed.gates.passed).toBe(false);
    expect(parsed.gates.results).toHaveLength(1);
    expect(parsed.gates.results[0].gateName).toBe("passRateMin");
  });
});
