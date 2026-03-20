import type { AssertionResult } from "../assertions/interface.js";
import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

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
}

export interface AggregatedTestResult {
  testCaseName: string;
  modelId: string;
  runCount: number;
  passed: boolean;
  errored: boolean;
  passRate: number;
  assertionScores: Record<string, { mean: number; min: number; max: number }>;
  failureCodes: string[];
  latencyAvgMs: number;
  totalCostUsd: number;
  totalTokens: number;
  runs: TestCaseRunResult[];
}

export function aggregateRuns(runs: TestCaseRunResult[]): Result<AggregatedTestResult, string> {
  const first = runs[0];
  if (!first) {
    return err("aggregateRuns requires at least one run");
  }
  const { testCaseName, modelId } = first;

  const passedRuns = runs.filter((r) =>
    r.assertions.every((a) => a.passed),
  ).length;
  const passRate = passedRuns / runs.length;

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

  const assertionScores: Record<string, { mean: number; min: number; max: number }> = {};
  for (const [type, scores] of scoresByType) {
    const sum = scores.reduce((a, b) => a + b, 0);
    assertionScores[type] = {
      mean: sum / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
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

  const latencyAvgMs =
    runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length;

  const totalCostUsd = runs.reduce(
    (sum, r) => sum + (r.costEstimateUsd ?? 0),
    0,
  );

  const totalTokens = runs.reduce(
    (sum, r) => sum + r.tokenUsage.totalTokens,
    0,
  );

  const hasErrored = runs.some((r) => r.errored === true);

  return ok({
    testCaseName,
    modelId,
    runCount: runs.length,
    passed: passRate === 1,
    errored: hasErrored,
    passRate,
    assertionScores,
    failureCodes: [...failureCodeSet],
    latencyAvgMs,
    totalCostUsd,
    totalTokens,
    runs,
  });
}
