import type { Colorize, Reporter, ReporterOutput } from "./interface.js";
import { noColor } from "./interface.js";
import type { RunResult, SuiteRunResult, TestRunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";
import type { AssertionResult } from "../assertions/interface.js";
import type { ConfidenceInterval, LatencyStats, EfficiencyStats } from "../engine/aggregator.js";

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

          // Statistical reliability summary (REL-02/03, STAT-01/02/03)
          for (const statLine of formatTestStats(test, c)) {
            lines.push(statLine);
          }

          // Group assertions by turnLabel for conversation tests
          const hasTurns = test.assertions.some(
            (a) => a.metadata?.turnLabel !== undefined,
          );

          if (!hasTurns) {
            // No conversation turns — render flat (backward compat)
            for (const a of test.assertions) {
              lines.push(formatAssertion(a, c));
            }
          } else {
            // Group by turnLabel, preserving order
            const turnOrder: string[] = [];
            const byTurn = new Map<string | undefined, AssertionResult[]>();

            for (const a of test.assertions) {
              const label = a.metadata?.turnLabel as string | undefined;
              if (label !== undefined && !byTurn.has(label)) {
                turnOrder.push(label);
              }
              const bucket = byTurn.get(label) ?? [];
              bucket.push(a);
              byTurn.set(label, bucket);
            }

            // Unlabeled assertions first (final-turn expect:)
            const unlabeled = byTurn.get(undefined) ?? [];
            for (const a of unlabeled) {
              lines.push(formatAssertion(a, c));
            }

            // Then labeled turns in order
            for (const label of turnOrder) {
              lines.push(`      ${c.dim(`── Turn: ${label} ──`)}`);
              const assertions = byTurn.get(label) ?? [];
              for (const a of assertions) {
                lines.push(formatAssertion(a, c));
              }
            }
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
  const cachedBadge = test.fromCache ? ` ${c.dim(c.cyan("[cached]"))}` : "";
  return `    ${icon} ${test.name}${cachedBadge}`;
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

// CI bounds are rounded to 2dp here (not in the data layer) to hide bootstrap
// jitter, which is sub-0.005 at B=1000 resamples.
function formatCI(ci: ConfidenceInterval | undefined, n: number): string {
  if (n <= 1 || !ci) return "(n=1, no CI)";
  return `[${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}] (n=${n})`;
}

function formatLatencyStats(lat: LatencyStats | undefined, fallbackMs: number): string {
  if (!lat || (lat.p50 === 0 && lat.p95 === 0 && lat.p99 === 0)) {
    return formatDuration(fallbackMs);
  }
  return `p50: ${Math.round(lat.p50)}ms  p95: ${Math.round(lat.p95)}ms  p99: ${Math.round(lat.p99)}ms`;
}

// toolCallsPerTask is intentionally omitted from the compact view (it is a
// best-effort proxy and too technical by default). JSON includes it.
function formatEfficiency(eff: EfficiencyStats | undefined): string | null {
  if (!eff) return null;
  const cost = eff.costPerTaskUsd > 0 ? `$${eff.costPerTaskUsd.toFixed(4)}/task` : null;
  const tokens = eff.tokensPerTask > 0 ? `${Math.round(eff.tokensPerTask)} tokens/task` : null;
  const joined = [cost, tokens].filter(Boolean).join("   ");
  return joined === "" ? null : joined;
}

// Renders the reliability block (pass rate + CI, pass^k/pass@k, latency
// percentiles, efficiency) shown below a test's meta line. For single-run
// tests it shows an n=1 note and omits pass^k to avoid a degenerate display.
function formatTestStats(test: TestRunResult, c: Colorize): string[] {
  if (test.status === "skipped") return [];
  if (test.runCount === undefined || test.passRate === undefined) return [];

  const n = test.runCount;
  const out: string[] = [];

  const passRateStr = test.passRate.toFixed(2);
  if (n > 1) {
    const ciStr = formatCI(test.passRateCI, n);
    const k = n;
    const passKStr = test.passK !== undefined ? `pass^${k}: ${test.passK.toFixed(2)}` : "";
    const passAtKStr = test.passAtK !== undefined ? `pass@${k}: ${test.passAtK.toFixed(2)}` : "";
    const segments = [`pass rate: ${passRateStr} ${ciStr}`, passKStr, passAtKStr].filter(Boolean);
    out.push(`      ${c.dim(segments.join("   "))}`);
  } else {
    out.push(`      ${c.dim(`pass rate: ${passRateStr} (n=1, no CI)`)}`);
  }

  const latencyStr = formatLatencyStats(test.latency, test.latencyMs);
  out.push(`      ${c.dim(`latency:   ${latencyStr}`)}`);

  const effStr = formatEfficiency(test.efficiency);
  if (effStr) out.push(`      ${c.dim(`cost:      ${effStr}`)}`);

  return out;
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
