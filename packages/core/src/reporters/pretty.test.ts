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
            modelId: "gpt-4o-mini",
            status: "passed",
            assertions: [
              { assertionType: "tool_called", label: 'Tool "lookup_order" called', passed: true, score: 1 },
            ],
            latencyMs: 500,
            costUsd: 0.001,
          },
          {
            name: "edge-case",
            modelId: "gpt-4o-mini",
            status: "passed",
            assertions: [
              { assertionType: "no_pii", label: "No PII detected", passed: true, score: 1 },
            ],
            latencyMs: 600,
            costUsd: 0.001,
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

  it("generates text format output", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("text");
  });

  it("contains key sections for passing run", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("KindLM Test Results");
    expect(output.content).toContain("refund-agent");
    expect(output.content).toContain("happy-path");
    expect(output.content).toContain("Summary");
    expect(output.content).toContain("2 passed");
    expect(output.content).toContain("All tests passed");
  });

  it("shows passing assertions", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain('✓ Tool "lookup_order" called');
    expect(output.content).toContain("✓ No PII detected");
  });

  it("shows model and latency per test", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("gpt-4o-mini");
    expect(output.content).toContain("500ms");
  });

  it("shows total cost in summary", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Cost:");
    expect(output.content).toContain("$0.0020");
  });

  it("shows failure details with assertion label", async () => {
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
              modelId: "gpt-4o-mini",
              status: "passed",
              assertions: [{ assertionType: "tool_called", label: 'Tool "lookup_order" called', passed: true, score: 1 }],
              latencyMs: 500,
              costUsd: 0.01,
            },
            {
              name: "pii-leak",
              modelId: "gpt-4o-mini",
              status: "failed",
              assertions: [
                {
                  assertionType: "no_pii",
                  label: "No PII detected",
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
    const output = await reporter.generate(failRun, makeGateEval({ passed: false }));
    expect(output.content).toContain("✗ No PII detected: SSN detected in output");
    expect(output.content).toContain("Some tests failed");
  });

  it("shows judge scores", async () => {
    const judgeRun = makeRunResult({
      suites: [
        {
          name: "support-bot",
          status: "passed",
          tests: [
            {
              name: "grounding-check",
              modelId: "gpt-4o-mini",
              status: "passed",
              assertions: [
                {
                  assertionType: "judge",
                  label: "Judge: Response is grounded",
                  passed: true,
                  score: 0.92,
                  metadata: { threshold: 0.8 },
                },
              ],
              latencyMs: 1200,
              costUsd: 0.003,
            },
          ],
        },
      ],
    });
    const output = await reporter.generate(judgeRun, makeGateEval());
    expect(output.content).toContain("0.92");
    expect(output.content).toContain("0.80");
  });

  it("shows failing judge score below threshold", async () => {
    const failJudge = makeRunResult({
      passed: 0,
      failed: 1,
      suites: [
        {
          name: "support-bot",
          status: "failed",
          tests: [
            {
              name: "grounding-check",
              modelId: "gpt-4o-mini",
              status: "failed",
              assertions: [
                {
                  assertionType: "judge",
                  label: "Judge: Response is grounded",
                  passed: false,
                  score: 0.5,
                  failureCode: "JUDGE_BELOW_THRESHOLD",
                  failureMessage: "Score 0.5 below threshold 0.8",
                  metadata: { threshold: 0.8 },
                },
              ],
              latencyMs: 800,
              costUsd: 0.002,
            },
          ],
        },
      ],
    });
    const output = await reporter.generate(failJudge, makeGateEval({ passed: false }));
    expect(output.content).toContain("0.50");
    expect(output.content).toContain("0.80");
  });

  it("includes quality gates section", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Quality Gates");
    expect(output.content).toContain("Pass rate 100.0% meets minimum 95.0%");
  });

  it("omits cost line when all costs are zero", async () => {
    const noCostRun = makeRunResult({
      suites: [
        {
          name: "cmd-suite",
          status: "passed",
          tests: [
            {
              name: "test-cmd",
              modelId: "command",
              status: "passed",
              assertions: [],
              latencyMs: 100,
              costUsd: 0,
            },
          ],
        },
      ],
    });
    const output = await reporter.generate(noCostRun, makeGateEval());
    expect(output.content).not.toContain("Cost:");
  });
});
