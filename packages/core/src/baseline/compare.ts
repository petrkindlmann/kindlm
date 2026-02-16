import type { BaselineData, BaselineTestEntry } from "./store.js";

// ============================================================
// Types
// ============================================================

export interface BaselineComparison {
  suiteName: string;
  hasBaseline: boolean;
  regressions: BaselineRegression[];
  improvements: BaselineImprovement[];
  unchanged: BaselineUnchanged[];
  newTests: string[];
  removedTests: string[];
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

export interface BaselineUnchanged {
  testName: string;
  passRate: number;
}

// ============================================================
// Comparison
// ============================================================

const EPSILON = 0.001;

export function compareBaseline(
  baseline: BaselineData,
  currentResults: Record<string, BaselineTestEntry>,
): BaselineComparison {
  const regressions: BaselineRegression[] = [];
  const improvements: BaselineImprovement[] = [];
  const unchanged: BaselineUnchanged[] = [];
  const newTests: string[] = [];
  const removedTests: string[] = [];

  const baselineKeys = new Set(Object.keys(baseline.results));

  // Classify current tests
  for (const [key, current] of Object.entries(currentResults)) {
    const base = baseline.results[key];
    if (!base) {
      newTests.push(key);
      continue;
    }

    baselineKeys.delete(key);
    const diff = current.passRate - base.passRate;

    if (diff < -EPSILON) {
      const newFailureCodes = current.failureCodes.filter(
        (code) => !base.failureCodes.includes(code),
      );
      regressions.push({
        testName: key,
        baselinePassRate: base.passRate,
        currentPassRate: current.passRate,
        newFailureCodes,
      });
    } else if (diff > EPSILON) {
      improvements.push({
        testName: key,
        baselinePassRate: base.passRate,
        currentPassRate: current.passRate,
      });
    } else {
      unchanged.push({
        testName: key,
        passRate: current.passRate,
      });
    }
  }

  // Remaining baseline keys are removed tests
  for (const key of baselineKeys) {
    removedTests.push(key);
  }

  return {
    suiteName: baseline.suiteName,
    hasBaseline: true,
    regressions,
    improvements,
    unchanged,
    newTests,
    removedTests,
  };
}
