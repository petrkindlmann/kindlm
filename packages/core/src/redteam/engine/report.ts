import type { Colorize } from "../../reporters/interface.js";
import type { RedTeamGatesConfig } from "../schema.js";
import type { AttackVerdict, RedTeamCategory, Severity } from "../types.js";
import { SEVERITIES } from "../types.js";

// ============================================================
// Red Team Vulnerability Report (S04)
// ============================================================
//
// Pure functions that aggregate AttackVerdict[] into a structured
// report, evaluate red team gates, and format output for terminal
// (pretty) and JSON consumption.
//
// This is intentionally separate from the main Reporter interface.
// Main reporters operate on RunResult (suite/test/assertion shaped
// data). Red team verdicts are grouped by plugin/category/severity
// — a fundamentally different shape.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface RedTeamGateResult {
  gateName: string;
  passed: boolean;
  actual: number;
  threshold: number;
  message: string;
}

export interface RedTeamGateEvaluation {
  passed: boolean;
  gates: RedTeamGateResult[];
}

export interface CategorySummary {
  category: RedTeamCategory;
  pluginId: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  bySeverity: Record<Severity, { total: number; failed: number }>;
}

export interface RedTeamReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgScore: number;
  };
  categories: CategorySummary[];
  gates: RedTeamGateEvaluation;
  failedVerdicts: AttackVerdict[];
}

// ============================================================
// Aggregation
// ============================================================

function emptySeverityBuckets(): Record<Severity, { total: number; failed: number }> {
  return {
    critical: { total: 0, failed: 0 },
    high: { total: 0, failed: 0 },
    medium: { total: 0, failed: 0 },
    low: { total: 0, failed: 0 },
  };
}

/**
 * Group verdicts by pluginId and compute per-category stats.
 */
function aggregateByCategory(verdicts: AttackVerdict[]): CategorySummary[] {
  const byPlugin = new Map<string, AttackVerdict[]>();
  for (const v of verdicts) {
    const key = v.attack.pluginId;
    const group = byPlugin.get(key);
    if (group) {
      group.push(v);
    } else {
      byPlugin.set(key, [v]);
    }
  }

  const categories: CategorySummary[] = [];
  for (const [pluginId, group] of byPlugin) {
    const first = group[0];
    if (!first) continue;
    const total = group.length;
    const passed = group.filter((v) => v.passed).length;
    const failed = total - passed;
    const scoreSum = group.reduce((s, v) => s + v.score, 0);
    const bySeverity = emptySeverityBuckets();
    for (const v of group) {
      const sev = v.attack.severity;
      bySeverity[sev].total++;
      if (!v.passed) bySeverity[sev].failed++;
    }
    categories.push({
      category: first.attack.category,
      pluginId,
      total,
      passed,
      failed,
      passRate: total > 0 ? passed / total : 1,
      avgScore: total > 0 ? scoreSum / total : 1,
      bySeverity,
    });
  }

  return categories;
}

// ============================================================
// Gate Evaluation
// ============================================================

/**
 * Evaluate red team gates against verdict results.
 *
 * Mirrors the pattern in `engine/gate.ts` but operates on
 * `AttackVerdict[]` with the red-team-specific gate config.
 */
export function evaluateRedTeamGates(
  verdicts: AttackVerdict[],
  gates: RedTeamGatesConfig,
): RedTeamGateEvaluation {
  const results: RedTeamGateResult[] = [];

  // 1. maxCriticalFailures
  const criticalFailures = verdicts.filter(
    (v) => !v.passed && v.attack.severity === "critical",
  ).length;
  results.push({
    gateName: "maxCriticalFailures",
    passed: criticalFailures <= gates.maxCriticalFailures,
    actual: criticalFailures,
    threshold: gates.maxCriticalFailures,
    message:
      criticalFailures <= gates.maxCriticalFailures
        ? `Critical failures ${criticalFailures} within limit ${gates.maxCriticalFailures}`
        : `Critical failures ${criticalFailures} exceed limit ${gates.maxCriticalFailures}`,
  });

  // 2. maxHighFailures
  const highFailures = verdicts.filter(
    (v) => !v.passed && v.attack.severity === "high",
  ).length;
  results.push({
    gateName: "maxHighFailures",
    passed: highFailures <= gates.maxHighFailures,
    actual: highFailures,
    threshold: gates.maxHighFailures,
    message:
      highFailures <= gates.maxHighFailures
        ? `High failures ${highFailures} within limit ${gates.maxHighFailures}`
        : `High failures ${highFailures} exceed limit ${gates.maxHighFailures}`,
  });

  // 3. minOverallPassRate (optional)
  if (gates.minOverallPassRate !== undefined) {
    const total = verdicts.length;
    const passed = verdicts.filter((v) => v.passed).length;
    const passRate = total > 0 ? passed / total : 1;
    results.push({
      gateName: "minOverallPassRate",
      passed: passRate >= gates.minOverallPassRate,
      actual: passRate,
      threshold: gates.minOverallPassRate,
      message:
        passRate >= gates.minOverallPassRate
          ? `Pass rate ${fmtPct(passRate)} meets minimum ${fmtPct(gates.minOverallPassRate)}`
          : `Pass rate ${fmtPct(passRate)} below minimum ${fmtPct(gates.minOverallPassRate)}`,
    });
  }

  return {
    passed: results.every((g) => g.passed),
    gates: results,
  };
}

// ============================================================
// Report Builder
// ============================================================

/**
 * Build a complete red team vulnerability report from graded verdicts.
 *
 * This is the main entry point for S04. S05 will call this after
 * the generate → execute → grade pipeline completes.
 */
export function buildRedTeamReport(
  verdicts: AttackVerdict[],
  gates: RedTeamGatesConfig,
): RedTeamReport {
  const categories = aggregateByCategory(verdicts);

  const total = verdicts.length;
  const passed = verdicts.filter((v) => v.passed).length;
  const failed = total - passed;
  const scoreSum = verdicts.reduce((s, v) => s + v.score, 0);

  const failedVerdicts = verdicts
    .filter((v) => !v.passed)
    .sort((a, b) => severityRank(a.attack.severity) - severityRank(b.attack.severity));

  return {
    summary: {
      total,
      passed,
      failed,
      passRate: total > 0 ? passed / total : 1,
      avgScore: total > 0 ? scoreSum / total : 1,
    },
    categories,
    gates: evaluateRedTeamGates(verdicts, gates),
    failedVerdicts,
  };
}

// ============================================================
// Formatters
// ============================================================

/**
 * Format a red team report for terminal output.
 *
 * Mirrors the style of the existing pretty reporter: colored
 * headers, tabular category breakdown, gate verdicts with ✓/✗,
 * and failed probe details sorted by severity.
 */
export function formatRedTeamReportPretty(
  report: RedTeamReport,
  colorize: Colorize,
): string {
  const lines: string[] = [];
  const { summary, categories, gates, failedVerdicts } = report;

  // Header
  lines.push("");
  lines.push(colorize.bold("Red Team Vulnerability Report"));
  lines.push("─".repeat(50));
  lines.push("");

  // Summary
  const passLabel = summary.passRate >= 1
    ? colorize.green(`${fmtPct(summary.passRate)} resistance`)
    : summary.passRate >= 0.8
      ? colorize.yellow(`${fmtPct(summary.passRate)} resistance`)
      : colorize.red(`${fmtPct(summary.passRate)} resistance`);
  lines.push(`  Total probes: ${summary.total}`);
  lines.push(`  Resisted:     ${colorize.green(String(summary.passed))}`);
  lines.push(`  Exploited:    ${summary.failed > 0 ? colorize.red(String(summary.failed)) : "0"}`);
  lines.push(`  Pass rate:    ${passLabel}`);
  lines.push(`  Avg score:    ${summary.avgScore.toFixed(2)}`);
  lines.push("");

  // Per-category breakdown
  if (categories.length > 0) {
    lines.push(colorize.bold("Categories"));
    lines.push("─".repeat(50));
    for (const cat of categories) {
      const rate = fmtPct(cat.passRate);
      const rateColored = cat.passRate >= 1
        ? colorize.green(rate)
        : cat.passRate >= 0.8
          ? colorize.yellow(rate)
          : colorize.red(rate);
      lines.push(
        `  ${cat.pluginId.padEnd(28)} ${rateColored.padStart(8)}  (${cat.passed}/${cat.total})`,
      );
    }
    lines.push("");
  }

  // Gates
  lines.push(colorize.bold("Gates"));
  lines.push("─".repeat(50));
  for (const g of gates.gates) {
    const icon = g.passed ? colorize.green("✓") : colorize.red("✗");
    lines.push(`  ${icon} ${g.message}`);
  }
  const gateVerdict = gates.passed
    ? colorize.greenBold("PASSED")
    : colorize.redBold("FAILED");
  lines.push("");
  lines.push(`  Result: ${gateVerdict}`);
  lines.push("");

  // Failed probes (sorted by severity)
  if (failedVerdicts.length > 0) {
    lines.push(colorize.bold("Failed Probes"));
    lines.push("─".repeat(50));
    for (const v of failedVerdicts) {
      const sevLabel = formatSeverityLabel(v.attack.severity, colorize);
      lines.push(`  ${sevLabel} ${colorize.dim(v.attack.pluginId)} — ${v.attack.label}`);
      lines.push(`    ${colorize.dim("Score:")} ${v.score.toFixed(2)}  ${colorize.dim("Reason:")} ${v.reason}`);
      lines.push(`    ${colorize.dim("Probe:")} ${truncate(v.attack.userPrompt, 80)}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format a red team report as JSON.
 */
export function formatRedTeamReportJson(report: RedTeamReport): string {
  return JSON.stringify(report, null, 2);
}

// ============================================================
// Helpers
// ============================================================

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

function formatSeverityLabel(severity: Severity, colorize: Colorize): string {
  const labels: Record<Severity, string> = {
    critical: colorize.redBold("[CRITICAL]"),
    high: colorize.red("[HIGH]    "),
    medium: colorize.yellow("[MEDIUM]  "),
    low: colorize.dim("[LOW]     "),
  };
  return labels[severity];
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

// Re-export SEVERITIES usage for iteration — used internally only
void SEVERITIES;
