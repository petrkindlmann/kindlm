import type { Result } from "../types/result.js";

export interface BaselineData {
  version: string;
  suiteName: string;
  createdAt: string;
  results: Record<string, unknown>;
}

export function readBaseline(_suiteName: string, _baselineDir: string): Result<BaselineData> {
  throw new Error("Not implemented");
}

export function writeBaseline(
  _suiteName: string,
  _data: BaselineData,
  _baselineDir: string,
): Result<void> {
  throw new Error("Not implemented");
}

export function listBaselines(_baselineDir: string): Result<string[]> {
  throw new Error("Not implemented");
}
