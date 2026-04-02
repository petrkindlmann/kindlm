import type { GatesConfig } from "../types/config.js";
import type { AggregatedTestResult } from "./aggregator.js";
import { classifyAssertion } from "../assertions/classification.js";

export interface GateResult {
  gateName: string;
  passed: boolean;
  actual: number;
  threshold: number;
  message: string;
  // Set to true when gate trivially passes due to no matching assertions in the run.
  // Signals a vacuous pass — the gate configuration isn't exercising anything.
  emptyData?: true;
}

export interface GateEvaluation {
  passed: boolean;
  gates: GateResult[];
}

export function evaluateGates(
  config: GatesConfig,
  results: AggregatedTestResult[],
): GateEvaluation {
  const gates: GateResult[] = [];

  // 1. passRateMin — overall pass rate across all results
  const totalRuns = results.reduce((s, r) => s + r.runCount, 0);
  const totalPassed = results.reduce(
    (s, r) => s + Math.round(r.passRate * r.runCount),
    0,
  );
  const overallPassRate = totalRuns > 0 ? totalPassed / totalRuns : 0;
  gates.push({
    gateName: "passRateMin",
    passed: overallPassRate >= config.passRateMin,
    actual: overallPassRate,
    threshold: config.passRateMin,
    message:
      overallPassRate >= config.passRateMin
        ? `Pass rate ${fmt(overallPassRate)} meets minimum ${fmt(config.passRateMin)}`
        : `Pass rate ${fmt(overallPassRate)} below minimum ${fmt(config.passRateMin)}`,
  });

  // 2. schemaFailuresMax
  const schemaFailures = countFailures(results, [
    "SCHEMA_INVALID",
    "SCHEMA_PARSE_ERROR",
  ]);
  gates.push({
    gateName: "schemaFailuresMax",
    passed: schemaFailures <= config.schemaFailuresMax,
    actual: schemaFailures,
    threshold: config.schemaFailuresMax,
    message:
      schemaFailures <= config.schemaFailuresMax
        ? `Schema failures ${schemaFailures} within limit ${config.schemaFailuresMax}`
        : `Schema failures ${schemaFailures} exceed limit ${config.schemaFailuresMax}`,
  });

  // 3. judgeAvgMin (optional)
  if (config.judgeAvgMin !== undefined) {
    const judgeScores = collectScores(results, "judge");
    const isEmpty = judgeScores.length === 0;
    const judgeAvg = isEmpty
      ? 1
      : judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length;
    const judgeGate: GateResult = {
      gateName: "judgeAvgMin",
      passed: judgeAvg >= config.judgeAvgMin,
      actual: judgeAvg,
      threshold: config.judgeAvgMin,
      message: isEmpty
        ? `Judge average N/A meets minimum ${fmt(config.judgeAvgMin)} (no judge assertions found — gate trivially passed)`
        : judgeAvg >= config.judgeAvgMin
          ? `Judge average ${fmt(judgeAvg)} meets minimum ${fmt(config.judgeAvgMin)}`
          : `Judge average ${fmt(judgeAvg)} below minimum ${fmt(config.judgeAvgMin)}`,
    };
    if (isEmpty) judgeGate.emptyData = true;
    gates.push(judgeGate);
  }

  // 4. driftScoreMax (optional)
  // Drift assertion scores are stored as (1 - driftScore), where 1 = no drift.
  // Convert back to drift values before comparing against the threshold.
  if (config.driftScoreMax !== undefined) {
    const driftScores = collectScores(results, "drift");
    const isEmpty = driftScores.length === 0;
    const driftValues = driftScores.map((s) => 1 - s);
    const maxDrift = isEmpty ? 0 : Math.max(...driftValues);
    const driftGate: GateResult = {
      gateName: "driftScoreMax",
      passed: maxDrift <= config.driftScoreMax,
      actual: maxDrift,
      threshold: config.driftScoreMax,
      message: isEmpty
        ? `Drift score N/A within limit ${fmt(config.driftScoreMax)} (no drift assertions found — gate trivially passed)`
        : maxDrift <= config.driftScoreMax
          ? `Drift score ${fmt(maxDrift)} within limit ${fmt(config.driftScoreMax)}`
          : `Drift score ${fmt(maxDrift)} exceeds limit ${fmt(config.driftScoreMax)}`,
    };
    if (isEmpty) driftGate.emptyData = true;
    gates.push(driftGate);
  }

  // 5. piiFailuresMax
  const piiFailures = countFailures(results, ["PII_DETECTED"]);
  gates.push({
    gateName: "piiFailuresMax",
    passed: piiFailures <= config.piiFailuresMax,
    actual: piiFailures,
    threshold: config.piiFailuresMax,
    message:
      piiFailures <= config.piiFailuresMax
        ? `PII failures ${piiFailures} within limit ${config.piiFailuresMax}`
        : `PII failures ${piiFailures} exceed limit ${config.piiFailuresMax}`,
  });

  // 6. keywordFailuresMax
  const keywordFailures = countFailures(results, [
    "KEYWORD_DENIED",
    "KEYWORD_MISSING",
  ]);
  gates.push({
    gateName: "keywordFailuresMax",
    passed: keywordFailures <= config.keywordFailuresMax,
    actual: keywordFailures,
    threshold: config.keywordFailuresMax,
    message:
      keywordFailures <= config.keywordFailuresMax
        ? `Keyword failures ${keywordFailures} within limit ${config.keywordFailuresMax}`
        : `Keyword failures ${keywordFailures} exceed limit ${config.keywordFailuresMax}`,
  });

  // 7. costMaxUsd (optional)
  if (config.costMaxUsd !== undefined) {
    const totalCost = results.reduce((s, r) => s + r.totalCostUsd, 0);
    gates.push({
      gateName: "costMaxUsd",
      passed: totalCost <= config.costMaxUsd,
      actual: totalCost,
      threshold: config.costMaxUsd,
      message:
        totalCost <= config.costMaxUsd
          ? `Total cost $${totalCost.toFixed(4)} within limit $${config.costMaxUsd.toFixed(4)}`
          : `Total cost $${totalCost.toFixed(4)} exceeds limit $${config.costMaxUsd.toFixed(4)}`,
    });
  }

  // 8. latencyMaxMs (optional)
  if (config.latencyMaxMs !== undefined) {
    const avgLatency =
      results.length > 0
        ? results.reduce((s, r) => s + r.latencyAvgMs, 0) / results.length
        : 0;
    gates.push({
      gateName: "latencyMaxMs",
      passed: avgLatency <= config.latencyMaxMs,
      actual: avgLatency,
      threshold: config.latencyMaxMs,
      message:
        avgLatency <= config.latencyMaxMs
          ? `Average latency ${Math.round(avgLatency)}ms within limit ${config.latencyMaxMs}ms`
          : `Average latency ${Math.round(avgLatency)}ms exceeds limit ${config.latencyMaxMs}ms`,
    });
  }

  // 9. deterministicPassRate (optional)
  if (config.deterministicPassRate !== undefined) {
    const { rate, empty: detEmpty } = computeCategoryPassRate(results, "deterministic");
    const detGate: GateResult = {
      gateName: "deterministicPassRate",
      passed: rate >= config.deterministicPassRate,
      actual: rate,
      threshold: config.deterministicPassRate,
      message: detEmpty
        ? `Deterministic pass rate N/A meets minimum ${fmt(config.deterministicPassRate)} (no deterministic assertions found — gate trivially passed)`
        : rate >= config.deterministicPassRate
          ? `Deterministic pass rate ${fmt(rate)} meets minimum ${fmt(config.deterministicPassRate)}`
          : `Deterministic pass rate ${fmt(rate)} below minimum ${fmt(config.deterministicPassRate)}`,
    };
    if (detEmpty) detGate.emptyData = true;
    gates.push(detGate);
  }

  // 10. probabilisticPassRate (optional)
  if (config.probabilisticPassRate !== undefined) {
    const { rate, empty: probEmpty } = computeCategoryPassRate(results, "probabilistic");
    const probGate: GateResult = {
      gateName: "probabilisticPassRate",
      passed: rate >= config.probabilisticPassRate,
      actual: rate,
      threshold: config.probabilisticPassRate,
      message: probEmpty
        ? `Probabilistic pass rate N/A meets minimum ${fmt(config.probabilisticPassRate)} (no probabilistic assertions found — gate trivially passed)`
        : rate >= config.probabilisticPassRate
          ? `Probabilistic pass rate ${fmt(rate)} meets minimum ${fmt(config.probabilisticPassRate)}`
          : `Probabilistic pass rate ${fmt(rate)} below minimum ${fmt(config.probabilisticPassRate)}`,
    };
    if (probEmpty) probGate.emptyData = true;
    gates.push(probGate);
  }

  return {
    passed: gates.every((g) => g.passed),
    gates,
  };
}

function computeCategoryPassRate(
  results: AggregatedTestResult[],
  category: "deterministic" | "probabilistic",
): { rate: number; empty: boolean } {
  let total = 0;
  let passed = 0;
  for (const r of results) {
    for (const run of r.runs) {
      for (const a of run.assertions) {
        if (classifyAssertion(a.assertionType) === category) {
          total++;
          if (a.passed) passed++;
        }
      }
    }
  }
  return { rate: total > 0 ? passed / total : 1, empty: total === 0 };
}

function countFailures(
  results: AggregatedTestResult[],
  codes: string[],
): number {
  let count = 0;
  for (const r of results) {
    for (const run of r.runs) {
      for (const a of run.assertions) {
        if (!a.passed && a.failureCode && codes.includes(a.failureCode)) {
          count++;
        }
      }
    }
  }
  return count;
}

function collectScores(
  results: AggregatedTestResult[],
  assertionType: string,
): number[] {
  const scores: number[] = [];
  for (const r of results) {
    for (const [key, entry] of Object.entries(r.assertionScores)) {
      // Match both "judge" and "judge:Is empathetic", "judge:Is accurate" etc.
      if (key === assertionType || key.startsWith(`${assertionType}:`)) {
        scores.push(entry.mean);
      }
    }
  }
  return scores;
}

function fmt(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
