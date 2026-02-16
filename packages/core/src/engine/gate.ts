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
  _config: GatesConfig,
  _results: AggregatedTestResult[],
): GateEvaluation {
  throw new Error("Not implemented");
}
