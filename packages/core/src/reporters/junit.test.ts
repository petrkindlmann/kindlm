import { describe, it, expect } from "vitest";
import { createJunitReporter } from "./junit.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

function makeRunResult(): RunResult {
  return {
    totalTests: 2,
    passed: 1,
    failed: 1,
    errored: 0,
    skipped: 0,
    durationMs: 1500,
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
            name: "pii-check",
            modelId: "",
            status: "failed",
            assertions: [
              {
                assertionType: "no_pii",
                label: "no_pii",
                passed: false,
                score: 0,
                failureCode: "PII_DETECTED",
                failureMessage: "SSN found in output",
              },
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
      { gateName: "passRateMin", passed: false, actual: 0.5, threshold: 0.95, message: "Pass rate 50.0% below minimum 95.0%" },
    ],
  };
}

describe("createJunitReporter", () => {
  const reporter = createJunitReporter();

  it("generates valid XML structure", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("xml");
    expect(output.content).toContain('<?xml version="1.0"');
    expect(output.content).toContain("<testsuites");
    expect(output.content).toContain("</testsuites>");
  });

  it("includes failure elements for failed tests", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("<failure");
    expect(output.content).toContain("SSN found in output");
  });

  it("escapes XML special characters", () => {
    const runResult: RunResult = {
      totalTests: 1,
      passed: 0,
      failed: 1,
      errored: 0,
      skipped: 0,
      durationMs: 100,
      suites: [
        {
          name: 'suite <"test">&',
          status: "failed",
          tests: [
            {
              name: 'test with <special> "chars" & more',
              modelId: "",
              status: "failed",
              assertions: [
                {
                  assertionType: "contains",
                  label: "contains",
                  passed: false,
                  score: 0,
                  failureCode: "CONTAINS_FAILED",
                  failureMessage: 'Expected <output> to contain "value"',
                },
              ],
              latencyMs: 50,
              costUsd: 0,
            },
          ],
        },
      ],
    };
    const output = reporter.generate(runResult, { passed: true, gates: [] });
    expect(output.content).toContain("&lt;special&gt;");
    expect(output.content).toContain("&quot;chars&quot;");
    expect(output.content).toContain("&amp;");
    expect(output.content).not.toContain('name="test with <special>');
  });

  it("includes quality gates as a separate test suite", () => {
    const output = reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain('name="Quality Gates"');
    expect(output.content).toContain('name="passRateMin"');
  });

  it("handles skipped tests", () => {
    const runResult: RunResult = {
      totalTests: 1,
      passed: 0,
      failed: 0,
      errored: 0,
      skipped: 1,
      durationMs: 0,
      suites: [
        {
          name: "suite",
          status: "skipped",
          tests: [
            { name: "skipped-test", modelId: "", status: "skipped", assertions: [], latencyMs: 0, costUsd: 0 },
          ],
        },
      ],
    };
    const output = reporter.generate(runResult, { passed: true, gates: [] });
    expect(output.content).toContain("<skipped/>");
  });
});
