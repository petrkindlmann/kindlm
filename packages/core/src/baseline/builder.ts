import type { AggregatedTestResult } from "../engine/aggregator.js";
import type { BaselineData, BaselineTestEntry } from "./store.js";
import { BASELINE_VERSION } from "./store.js";

export function buildBaselineData(
  suiteName: string,
  aggregated: AggregatedTestResult[],
  timestamp: string,
): BaselineData {
  const results: Record<string, BaselineTestEntry> = {};

  for (const agg of aggregated) {
    const key = `${agg.testCaseName}::${agg.modelId}`;

    // Pick representative output: first passing run, or first run if all failed
    const passingRun = agg.runs.find((r) => r.assertions.every((a) => a.passed));
    const representative = passingRun ?? agg.runs[0];

    results[key] = {
      passRate: agg.passRate,
      outputText: representative?.outputText ?? "",
      failureCodes: agg.failureCodes,
      latencyAvgMs: agg.latencyAvgMs,
      costUsd: agg.totalCostUsd,
      runCount: agg.runCount,
    };
  }

  return {
    version: BASELINE_VERSION,
    suiteName,
    createdAt: timestamp,
    results,
  };
}
