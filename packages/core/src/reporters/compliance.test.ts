import { describe, it, expect } from "vitest";
import { createComplianceReporter } from "./compliance.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

function makeRunResult(): RunResult {
  return {
    totalTests: 3,
    passed: 2,
    failed: 1,
    errored: 0,
    skipped: 0,
    durationMs: 2500,
    suites: [
      {
        name: "refund-agent",
        status: "failed",
        tests: [
          { name: "happy-path", modelId: "", status: "passed", assertions: [], latencyMs: 800, costUsd: 0.01 },
          { name: "edge-case", modelId: "", status: "passed", assertions: [], latencyMs: 700, costUsd: 0.01 },
          { name: "pii-leak", modelId: "", status: "failed", assertions: [], latencyMs: 500, costUsd: 0.005 },
        ],
      },
    ],
  };
}

function makeGateEval(): GateEvaluation {
  return {
    passed: false,
    gates: [
      { gateName: "passRateMin", passed: false, actual: 0.67, threshold: 0.95, message: "Pass rate 66.7% below minimum 95.0%" },
      { gateName: "schemaFailuresMax", passed: true, actual: 0, threshold: 0, message: "Schema failures 0 within limit 0" },
      { gateName: "piiFailuresMax", passed: false, actual: 1, threshold: 0, message: "PII failures 1 exceed limit 0" },
      { gateName: "keywordFailuresMax", passed: true, actual: 0, threshold: 0, message: "Keyword failures 0 within limit 0" },
    ],
  };
}

describe("createComplianceReporter", () => {
  const reporter = createComplianceReporter();

  it("generates markdown format", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("markdown");
  });

  it("includes all article sections", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Article 9");
    expect(output.content).toContain("Article 10");
    expect(output.content).toContain("Article 12");
    expect(output.content).toContain("Article 13");
    expect(output.content).toContain("Article 15");
  });

  it("includes SHA-256 tamper evidence hash", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Tamper Evidence Hash (SHA-256)");
    // SHA-256 hex is 64 characters
    const hashMatch = output.content.match(/`([a-f0-9]{64})`/);
    expect(hashMatch).not.toBeNull();
  });

  it("maps gate results to relevant articles", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    // PII gate should appear under Article 10
    const article10Section = output.content.split("## Article 10")[1]?.split("## Article 12")[0] ?? "";
    expect(article10Section).toContain("PII failures");
  });

  it("includes test execution log", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Total Tests | 3");
    expect(output.content).toContain("Passed | 2");
    expect(output.content).toContain("Failed | 1");
  });
});
