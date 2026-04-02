import type { Colorize, Reporter, ReporterOutput } from "./interface.js";
import { noColor } from "./interface.js";
import type { RunResult, SuiteRunResult, TestRunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";
import type { AssertionResult } from "../assertions/interface.js";

export function createPrettyReporter(colorize: Colorize = noColor): Reporter {
  return {
    name: "pretty",
    async generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput> {
      const lines: string[] = [];
      const c = colorize;

      lines.push("");
      lines.push(c.bold("  KindLM Test Results"));
      lines.push("");

      let totalCost = 0;

      for (const suite of runResult.suites) {
        lines.push(formatSuite(suite, c));

        for (const test of suite.tests) {
          lines.push(formatTest(test, c));

          // Show model, latency, cost on the next line
          const meta = formatTestMeta(test, c);
          if (meta) lines.push(meta);

          // Show all assertions
          for (const a of test.assertions) {
            lines.push(formatAssertion(a, c));
          }

          totalCost += test.costUsd;
        }
        lines.push("");
      }

      // Summary
      lines.push(c.bold("  Summary"));
      const passStr = c.green(`${runResult.passed} passed`);
      const failStr =
        runResult.failed > 0
          ? c.red(`${runResult.failed} failed`)
          : `${runResult.failed} failed`;
      const errorStr =
        runResult.errored > 0
          ? c.yellow(`${runResult.errored} errored`)
          : `${runResult.errored} errored`;
      lines.push(`    ${passStr}, ${failStr}, ${errorStr} (${runResult.totalTests} total)`);
      lines.push(`    Duration: ${formatDuration(runResult.durationMs)}`);
      if (totalCost > 0) {
        lines.push(`    Cost: ${formatCost(totalCost)}`);
      }
      lines.push("");

      // Gates
      if (gateEvaluation.gates.length > 0) {
        lines.push(c.bold("  Quality Gates"));
        for (const gate of gateEvaluation.gates) {
          const icon = gate.emptyData
            ? c.yellow("⚠")
            : gate.passed
              ? c.green("✓")
              : c.red("✗");
          lines.push(`    ${icon} ${gate.message}`);
        }
        lines.push("");
      }

      // Verdict
      const allPassed = runResult.failed === 0 && runResult.errored === 0 && gateEvaluation.passed;
      if (allPassed) {
        lines.push(c.greenBold("  ✓ All tests passed"));
      } else {
        lines.push(c.redBold("  ✗ Some tests failed"));
      }
      lines.push("");

      return { content: lines.join("\n"), format: "text" };
    },
  };
}

function formatSuite(suite: SuiteRunResult, c: Colorize): string {
  const icon =
    suite.status === "passed"
      ? c.green("✓")
      : suite.status === "skipped"
        ? c.yellow("○")
        : c.red("✗");
  return `  ${icon} ${c.bold(suite.name)}`;
}

function formatTest(test: TestRunResult, c: Colorize): string {
  const icon =
    test.status === "passed"
      ? c.green("✓")
      : test.status === "skipped"
        ? c.yellow("○")
        : c.red("✗");
  return `    ${icon} ${test.name}`;
}

function formatTestMeta(test: TestRunResult, c: Colorize): string | null {
  if (test.status === "skipped") return null;

  const parts: string[] = [];
  if (test.modelId) parts.push(test.modelId);
  if (test.latencyMs > 0) parts.push(formatDuration(test.latencyMs));
  if (test.costUsd >= 0.00005) parts.push(formatCost(test.costUsd));

  if (parts.length === 0) return null;
  return `      ${c.dim(parts.join(" · "))}`;
}

function extractReasoning(a: AssertionResult): string | null {
  if (a.assertionType !== "judge") return null;
  if (!a.metadata || typeof a.metadata !== "object") return null;
  const r = (a.metadata as Record<string, unknown>)["reasoning"];
  if (typeof r !== "string" || r.trim() === "") return null;
  return r;
}

interface ToolCallMetadata {
  receivedToolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  expectedTool?: string;
  expectedArgs?: Record<string, unknown>;
  argDiffs?: Record<string, { expected: unknown; received: unknown }>;
  argCount?: number;
}

function extractToolCallDetail(a: AssertionResult): ToolCallMetadata | null {
  const toolCallTypes = ["tool_called", "tool_not_called", "tool_order"];
  if (!toolCallTypes.includes(a.assertionType)) return null;
  if (!a.metadata || typeof a.metadata !== "object") return null;
  return a.metadata as ToolCallMetadata;
}

function truncateArgs(json: string): string {
  if (json.length <= 500) return json;
  return json.slice(0, 500) + "...(truncated)";
}

function formatAssertion(a: AssertionResult, c: Colorize): string {
  if (a.passed) {
    const scoreStr = formatScore(a);
    const tcDetail = extractToolCallDetail(a);
    if (tcDetail?.argCount !== undefined && tcDetail.argCount > 0) {
      const argLabel = scoreStr
        ? `${a.label} (${tcDetail.argCount} args) ${c.cyan(scoreStr)}`
        : `${a.label} (${tcDetail.argCount} args)`;
      const passLine = `      ${c.green("✓")} ${c.dim(argLabel)}`;
      const reasoning = extractReasoning(a);
      if (reasoning) return `${passLine}\n        Reasoning: ${c.dim(reasoning)}`;
      return passLine;
    }
    const label = scoreStr ? `${a.label} ${c.cyan(scoreStr)}` : a.label;
    const line = `      ${c.green("✓")} ${c.dim(label)}`;
    const reasoning = extractReasoning(a);
    if (reasoning) return `${line}\n        Reasoning: ${c.dim(reasoning)}`;
    return line;
  }

  const scoreStr = formatScore(a);
  const detail = a.failureMessage ?? "failed";
  const label = scoreStr ? `${a.label} ${c.cyan(scoreStr)}` : a.label;
  const line = `      ${c.red("✗")} ${label}: ${detail}`;

  const tcDetail = extractToolCallDetail(a);
  if (tcDetail?.receivedToolCalls && tcDetail.receivedToolCalls.length > 0) {
    const parts: string[] = [line];

    parts.push(`        ${c.dim("Actual tool calls:")}`);
    tcDetail.receivedToolCalls.forEach((tc, i) => {
      const argsStr = truncateArgs(JSON.stringify(tc.arguments));
      parts.push(`        ${c.dim(`${i + 1}.`)} ${tc.name}(${argsStr})`);
    });

    if (tcDetail.argDiffs && Object.keys(tcDetail.argDiffs).length > 0) {
      parts.push(`        ${c.dim("Arg diffs:")}`);
      for (const [key, { expected, received }] of Object.entries(tcDetail.argDiffs)) {
        parts.push(`          ${key}:`);
        parts.push(`            ${c.green("expected:")} ${JSON.stringify(expected)}`);
        parts.push(`            ${c.red("received:")} ${JSON.stringify(received)}`);
      }
    }

    return parts.join("\n");
  }

  const reasoning = extractReasoning(a);
  if (reasoning) return `${line}\n        Reasoning: ${reasoning}`;
  return line;
}

function formatScore(a: AssertionResult): string {
  // Show score for judge and drift assertions where score is meaningful
  if (a.assertionType === "judge" || a.assertionType === "drift") {
    const threshold = extractThreshold(a);
    if (threshold !== null) {
      const symbol = a.passed ? "≥" : "<";
      return `(${a.score.toFixed(2)} ${symbol} ${threshold.toFixed(2)})`;
    }
    return `(${a.score.toFixed(2)})`;
  }
  return "";
}

function extractThreshold(a: AssertionResult): number | null {
  if (a.metadata && typeof a.metadata === "object" && "threshold" in a.metadata) {
    const t = a.metadata.threshold;
    if (typeof t === "number") return t;
  }
  return null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
