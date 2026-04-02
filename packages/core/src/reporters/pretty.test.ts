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

// Mock colorize that wraps text with markers for testability
const mockColorize = {
  green: (s: string) => `[green]${s}[/green]`,
  red: (s: string) => `[red]${s}[/red]`,
  yellow: (s: string) => `[yellow]${s}[/yellow]`,
  cyan: (s: string) => `[cyan]${s}[/cyan]`,
  dim: (s: string) => `[dim]${s}[/dim]`,
  bold: (s: string) => `[bold]${s}[/bold]`,
  greenBold: (s: string) => `[greenBold]${s}[/greenBold]`,
  redBold: (s: string) => `[redBold]${s}[/redBold]`,
};

function makeJudgeRunResult(assertion: {
  passed: boolean;
  score: number;
  failureMessage?: string;
  metadata?: Record<string, unknown>;
}): RunResult {
  return makeRunResult({
    passed: assertion.passed ? 1 : 0,
    failed: assertion.passed ? 0 : 1,
    suites: [
      {
        name: "judge-suite",
        status: assertion.passed ? "passed" : "failed",
        tests: [
          {
            name: "judge-test",
            modelId: "gpt-4o",
            status: assertion.passed ? "passed" : "failed",
            assertions: [
              {
                assertionType: "judge",
                label: "Judge: Response is helpful",
                passed: assertion.passed,
                score: assertion.score,
                failureMessage: assertion.failureMessage,
                metadata: assertion.metadata,
              },
            ],
            latencyMs: 500,
            costUsd: 0.001,
          },
        ],
      },
    ],
  });
}

describe("gate icon rendering", () => {
  const reporter = createPrettyReporter(mockColorize);

  it("renders ⚠ (yellow) icon for emptyData gates", async () => {
    const gateEval: GateEvaluation = {
      passed: true,
      gates: [
        {
          gateName: "judgeAvgMin",
          passed: true,
          actual: 1,
          threshold: 0.8,
          message: "Judge average N/A meets minimum 80.0% (no judge assertions found — gate trivially passed)",
          emptyData: true,
        },
      ],
    };
    const output = await reporter.generate(makeRunResult(), gateEval);
    expect(output.content).toContain("[yellow]⚠[/yellow]");
    expect(output.content).toContain("trivially passed");
  });

  it("renders ✓ (green) icon for normal passing gates", async () => {
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("[green]✓[/green]");
    expect(output.content).not.toContain("[yellow]⚠[/yellow]");
  });

  it("renders ✗ (red) icon for failing gates", async () => {
    const gateEval: GateEvaluation = {
      passed: false,
      gates: [
        {
          gateName: "passRateMin",
          passed: false,
          actual: 0.5,
          threshold: 0.95,
          message: "Pass rate 50.0% below minimum 95.0%",
        },
      ],
    };
    const output = await reporter.generate(makeRunResult({ failed: 1 }), gateEval);
    expect(output.content).toContain("[red]✗[/red]");
  });
});

describe("formatAssertion reasoning display", () => {
  const reporter = createPrettyReporter(mockColorize);

  it("shows reasoning in normal text on judge failure", async () => {
    const run = makeJudgeRunResult({
      passed: false,
      score: 0.4,
      failureMessage: "Score 0.4 below threshold 0.7",
      metadata: { reasoning: "The response lacked specific details.", threshold: 0.7 },
    });
    const output = await reporter.generate(run, makeGateEval({ passed: false }));
    // Reasoning line must be present with 8-space indent
    expect(output.content).toContain("        Reasoning: The response lacked specific details.");
    // On failure, reasoning text must NOT be wrapped in dim
    expect(output.content).not.toContain("        Reasoning: [dim]The response lacked specific details.[/dim]");
  });

  it("shows reasoning in dimmed text on judge pass", async () => {
    const run = makeJudgeRunResult({
      passed: true,
      score: 0.9,
      metadata: { reasoning: "The response was thorough and accurate.", threshold: 0.7 },
    });
    const output = await reporter.generate(run, makeGateEval());
    // Reasoning line must be present with 8-space indent, text dimmed
    expect(output.content).toContain("        Reasoning: [dim]The response was thorough and accurate.[/dim]");
  });

  it("shows reasoning for betaJudge assertions (metadata.betaJudge present)", async () => {
    const run = makeJudgeRunResult({
      passed: false,
      score: 0.5,
      metadata: {
        reasoning: "Median judge found the response incomplete.",
        threshold: 0.7,
        betaJudge: { passes: 5, successful: 3, scores: [0.4, 0.5, 0.6] },
      },
    });
    const output = await reporter.generate(run, makeGateEval({ passed: false }));
    expect(output.content).toContain("        Reasoning: Median judge found the response incomplete.");
  });

  it("does not show reasoning for non-judge assertions", async () => {
    const piiRun = makeRunResult({
      suites: [
        {
          name: "pii-suite",
          status: "passed",
          tests: [
            {
              name: "pii-test",
              modelId: "gpt-4o",
              status: "passed",
              assertions: [
                {
                  assertionType: "pii",
                  label: "No PII detected",
                  passed: true,
                  score: 1,
                  metadata: { reasoning: "should not appear" },
                },
              ],
              latencyMs: 200,
              costUsd: 0,
            },
          ],
        },
      ],
    });
    const output = await reporter.generate(piiRun, makeGateEval());
    expect(output.content).not.toContain("Reasoning:");
  });

  it("does not show reasoning when judge metadata.reasoning is absent", async () => {
    const run = makeJudgeRunResult({
      passed: false,
      score: 0.4,
      metadata: { threshold: 0.7 },
    });
    const output = await reporter.generate(run, makeGateEval({ passed: false }));
    expect(output.content).not.toContain("Reasoning:");
  });
});
