import type { Result } from "../types/result.js";
import type { BaselineData } from "./store.js";

export interface BaselineComparison {
  suiteName: string;
  hasBaseline: boolean;
  regressions: BaselineRegression[];
  improvements: BaselineImprovement[];
}

export interface BaselineRegression {
  testName: string;
  baselinePassRate: number;
  currentPassRate: number;
  newFailureCodes: string[];
}

export interface BaselineImprovement {
  testName: string;
  baselinePassRate: number;
  currentPassRate: number;
}

export function compareBaseline(
  _baseline: BaselineData,
  _currentResults: Record<string, unknown>,
): Result<BaselineComparison> {
  throw new Error("Not implemented");
}
