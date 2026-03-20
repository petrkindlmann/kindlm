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

  it("generates valid XML structure", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("xml");
    expect(output.content).toContain('<?xml version="1.0"');
    expect(output.content).toContain("<testsuites");
    expect(output.content).toContain("</testsuites>");
  });

  it("includes failure elements for failed tests", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("<failure");
    expect(output.content).toContain("SSN found in output");
  });

  it("escapes XML special characters", async () => {
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
    const output = await reporter.generate(runResult, { passed: true, gates: [] });
    expect(output.content).toContain("&lt;special&gt;");
    expect(output.content).toContain("&quot;chars&quot;");
    expect(output.content).toContain("&amp;");
    expect(output.content).not.toContain('name="test with <special>');
  });

  it("includes quality gates as a separate test suite", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain('name="Quality Gates"');
    expect(output.content).toContain('name="passRateMin"');
  });

  it("strips XML-illegal control characters", async () => {
    const runResult: RunResult = {
      totalTests: 1,
      passed: 0,
      failed: 1,
      errored: 0,
      skipped: 0,
      durationMs: 100,
      suites: [
        {
          name: "suite",
          status: "failed",
          tests: [
            {
              name: "control-char-test",
              modelId: "",
              status: "failed",
              assertions: [
                {
                  assertionType: "contains",
                  label: "contains",
                  passed: false,
                  score: 0,
                  failureCode: "CONTAINS_FAILED",
                  failureMessage: "Has \x00null \x08backspace \x0Bvtab \x0Cformfeed \x1Funit-sep \uFFFEbom chars",
                },
              ],
              latencyMs: 50,
              costUsd: 0,
            },
          ],
        },
      ],
    };
    const output = await reporter.generate(runResult, { passed: true, gates: [] });
    // Control chars should be stripped — verify by checking char codes
    const hasIllegalControlChar = [...output.content].some((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return (
        (code >= 0x00 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0xfffe ||
        code === 0xffff
      );
    });
    expect(hasIllegalControlChar).toBe(false);
    // But the readable text around them should survive
    expect(output.content).toContain("null");
    expect(output.content).toContain("backspace");
    // Tabs (\x09), newlines (\x0A), carriage returns (\x0D) are XML-legal and should be preserved
  });

  it("handles skipped tests", async () => {
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
    const output = await reporter.generate(runResult, { passed: true, gates: [] });
    expect(output.content).toContain("<skipped/>");
  });
});
