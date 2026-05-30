import type { AssertionResult } from "../assertions/interface.js";
import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";
import {
  passK,
  passAtK,
  percentile,
  sampleStdDev,
  bootstrapCI,
} from "./stats.js";
import type { ConfidenceInterval } from "./stats.js";

export type { ConfidenceInterval };

export interface TestCaseRunResult {
  testCaseName: string;
  modelId: string;
  runIndex: number;
  outputText: string;
  assertions: AssertionResult[];
  latencyMs: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costEstimateUsd: number | null;
  errored?: boolean;
  error?: { code: string; message: string };
  /** True when every provider call for this run was served from cache. */
  fromCache?: boolean;
}

export interface LatencyStats {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface EfficiencyStats {
  /** Mean cost (USD) per trial. */
  costPerTaskUsd: number;
  /** Mean tokens per trial. */
  tokensPerTask: number;
  /**
   * Mean tool calls per trial (STAT-04 best-effort).
   * Approximated from tool_called assertion count per run.
   * Will be exact when ProviderResponse is threaded through TestCaseRunResult.
   */
  toolCallsPerTask: number;
  /** Bootstrap 95% CI on mean cost across runs. */
  costCI: ConfidenceInterval;
}

export interface AggregatedTestResult {
  testCaseName: string;
  modelId: string;
  runCount: number;
  passed: boolean;
  errored: boolean;

  // Pass rate and reliability metrics (REL-02, REL-03, REL-04, STAT-01)
  passRate: number;
  passRateCI: ConfidenceInterval;
  passRateStdDev: number;
  passK: number;
  passAtK: number;

  // Assertion scores with variance (REL-04, STAT-01)
  assertionScores: Record<
    string,
    {
      mean: number;
      min: number;
      max: number;
      stdDev: number;
      ci: ConfidenceInterval;
    }
  >;

  failureCodes: string[];

  // Latency (STAT-02)
  latency: LatencyStats;
  /** @deprecated Use latency.mean. Kept for back-compat one minor version. */
  latencyAvgMs: number;

  // Cost/token totals (kept for back-compat)
  totalCostUsd: number;
  totalTokens: number;

  // Efficiency metrics (STAT-03, STAT-04)
  efficiency: EfficiencyStats;

  runs: TestCaseRunResult[];
}

const meanOf = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

export function aggregateRuns(runs: TestCaseRunResult[]): Result<AggregatedTestResult, string> {
  const first = runs[0];
  if (!first) {
    return err("aggregateRuns requires at least one run");
  }
  const { testCaseName, modelId } = first;

  const runPassed = (r: TestCaseRunResult): boolean =>
    r.assertions.every((a) => a.passed);

  const passedRuns = runs.filter(runPassed).length;
  const passRate = passedRuns / runs.length;

  // Per-run binary pass series for CI + std dev (REL-03, REL-04, STAT-01)
  const perRunBinary = runs.map((r) => (runPassed(r) ? 1 : 0));
  const passRateCI = bootstrapCI(perRunBinary, meanOf);
  const passRateStdDev = sampleStdDev(perRunBinary);
  const passKValue = passK(passedRuns, runs.length, runs.length);
  const passAtKValue = passAtK(passedRuns, runs.length, runs.length);

  // Group assertion scores by type:label composite key to avoid blending
  // distinct criteria (e.g., two judge assertions with different labels)
  const scoresByType = new Map<string, number[]>();
  for (const run of runs) {
    for (const a of run.assertions) {
      const scoreKey = a.label ? `${a.assertionType}:${a.label}` : a.assertionType;
      let arr = scoresByType.get(scoreKey);
      if (!arr) {
        arr = [];
        scoresByType.set(scoreKey, arr);
      }
      arr.push(a.score);
    }
  }

  const assertionScores: AggregatedTestResult["assertionScores"] = {};
  for (const [type, scores] of scoresByType) {
    assertionScores[type] = {
      mean: meanOf(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
      stdDev: sampleStdDev(scores),
      ci: bootstrapCI(scores, meanOf),
    };
  }

  // Collect unique failure codes
  const failureCodeSet = new Set<string>();
  for (const run of runs) {
    for (const a of run.assertions) {
      if (!a.passed && a.failureCode) {
        failureCodeSet.add(a.failureCode);
      }
    }
  }

  // Latency stats (STAT-02)
  const latencyValues = runs.map((r) => r.latencyMs);
  const latency: LatencyStats = {
    mean: meanOf(latencyValues),
    p50: percentile(latencyValues, 50),
    p95: percentile(latencyValues, 95),
    p99: percentile(latencyValues, 99),
    min: Math.min(...latencyValues),
    max: Math.max(...latencyValues),
  };
  // Back-compat: latencyAvgMs is the latency mean (not independently recomputed).
  const latencyAvgMs = latency.mean;

  // Efficiency metrics (STAT-03, STAT-04)
  const costValues = runs.map((r) => r.costEstimateUsd ?? 0);
  const totalCostUsd = costValues.reduce((a, b) => a + b, 0);
  const totalTokens = runs.reduce((sum, r) => sum + r.tokenUsage.totalTokens, 0);
  // STAT-04: tool calls approximated via tool_called assertion count per run.
  // Best-effort proxy; TestCaseRunResult does not carry ProviderResponse.toolCalls.
  const toolCallsPerRun = runs.map(
    (r) => r.assertions.filter((a) => a.assertionType === "tool_called").length,
  );
  const efficiency: EfficiencyStats = {
    costPerTaskUsd: totalCostUsd / runs.length,
    tokensPerTask: totalTokens / runs.length,
    toolCallsPerTask: toolCallsPerRun.reduce((a, b) => a + b, 0) / runs.length,
    costCI: bootstrapCI(costValues, meanOf),
  };

  const hasErrored = runs.some((r) => r.errored === true);

  return ok({
    testCaseName,
    modelId,
    runCount: runs.length,
    passed: passRate === 1,
    errored: hasErrored,
    passRate,
    passRateCI,
    passRateStdDev,
    passK: passKValue,
    passAtK: passAtKValue,
    assertionScores,
    failureCodes: [...failureCodeSet],
    latency,
    latencyAvgMs,
    totalCostUsd,
    totalTokens,
    efficiency,
    runs,
  });
}
