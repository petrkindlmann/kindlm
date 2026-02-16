import type { AssertionResult } from "../assertions/interface.js";

export interface TestCaseRunResult {
  testCaseName: string;
  modelId: string;
  runIndex: number;
  outputText: string;
  assertions: AssertionResult[];
  latencyMs: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costEstimateUsd: number | null;
}

export interface AggregatedTestResult {
  testCaseName: string;
  modelId: string;
  runCount: number;
  passed: boolean;
  passRate: number;
  assertionScores: Record<string, { mean: number; min: number; max: number }>;
  failureCodes: string[];
  latencyAvgMs: number;
  totalCostUsd: number;
  totalTokens: number;
  runs: TestCaseRunResult[];
}

export function aggregateRuns(_runs: TestCaseRunResult[]): AggregatedTestResult {
  throw new Error("Not implemented");
}
