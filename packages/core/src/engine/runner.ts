import type { KindLMConfig } from "../types/config.js";
import type { Result, KindlmError } from "../types/result.js";
import type { AssertionResult } from "../assertions/interface.js";

export interface RunResult {
  suites: SuiteRunResult[];
  totalTests: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  durationMs: number;
}

export interface SuiteRunResult {
  name: string;
  status: "passed" | "failed" | "errored" | "skipped";
  tests: TestRunResult[];
  error?: string;
}

export interface TestRunResult {
  name: string;
  status: "passed" | "failed" | "errored" | "skipped";
  assertions: AssertionResult[];
  error?: KindlmError;
  latencyMs: number;
  costUsd: number;
}

export function createRunner(_config: KindLMConfig): {
  run(): Promise<Result<RunResult>>;
} {
  throw new Error("Not implemented");
}
