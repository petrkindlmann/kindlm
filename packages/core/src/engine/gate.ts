import type { GatesConfig } from "../types/config.js";
import type { AggregatedTestResult } from "./aggregator.js";

export interface GateResult {
  gateName: string;
  passed: boolean;
  actual: number;
  threshold: number;
  message: string;
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
    const judgeAvg =
      judgeScores.length > 0
        ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
        : 1;
    gates.push({
      gateName: "judgeAvgMin",
      passed: judgeAvg >= config.judgeAvgMin,
      actual: judgeAvg,
      threshold: config.judgeAvgMin,
      message:
        judgeAvg >= config.judgeAvgMin
          ? `Judge average ${fmt(judgeAvg)} meets minimum ${fmt(config.judgeAvgMin)}`
          : `Judge average ${fmt(judgeAvg)} below minimum ${fmt(config.judgeAvgMin)}`,
    });
  }

  // 4. driftScoreMax (optional)
  if (config.driftScoreMax !== undefined) {
    const driftScores = collectScores(results, "drift");
    const maxDrift =
      driftScores.length > 0 ? Math.max(...driftScores) : 0;
    gates.push({
      gateName: "driftScoreMax",
      passed: maxDrift <= config.driftScoreMax,
      actual: maxDrift,
      threshold: config.driftScoreMax,
      message:
        maxDrift <= config.driftScoreMax
          ? `Drift score ${fmt(maxDrift)} within limit ${fmt(config.driftScoreMax)}`
          : `Drift score ${fmt(maxDrift)} exceeds limit ${fmt(config.driftScoreMax)}`,
    });
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

  return {
    passed: gates.every((g) => g.passed),
    gates,
  };
}

function countFailures(
  results: AggregatedTestResult[],
  codes: string[],
): number {
  let count = 0;
  for (const r of results) {
    for (const code of codes) {
      if (r.failureCodes.includes(code)) {
        count++;
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
    const entry = r.assertionScores[assertionType];
    if (entry) {
      scores.push(entry.mean);
    }
  }
  return scores;
}

function fmt(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
