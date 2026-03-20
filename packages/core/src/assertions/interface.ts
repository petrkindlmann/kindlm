import type { ProviderToolCall, ProviderAdapter } from "../types/provider.js";

export type FailureCode =
  | "SCHEMA_INVALID"
  | "SCHEMA_PARSE_ERROR"
  | "PII_DETECTED"
  | "KEYWORD_DENIED"
  | "KEYWORD_MISSING"
  | "CONTAINS_FAILED"
  | "NOT_CONTAINS_FAILED"
  | "MAX_LENGTH_EXCEEDED"
  | "JUDGE_BELOW_THRESHOLD"
  | "JUDGE_PARSE_ERROR"
  | "JUDGE_EVAL_ERROR"
  | "TOOL_CALL_MISSING"
  | "TOOL_CALL_UNEXPECTED"
  | "TOOL_CALL_ARGS_MISMATCH"
  | "TOOL_CALL_ORDER_WRONG"
  | "TOOL_CALL_ARGS_SCHEMA_INVALID"
  | "DRIFT_EXCEEDED"
  | "DRIFT_PARSE_ERROR"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_ERROR"
  | "INVALID_PATTERN"
  | "INTERNAL_ERROR"
  | "BUDGET_EXCEEDED";

export interface AssertionResult {
  assertionType: string;
  label: string;
  passed: boolean;
  score: number;
  failureCode?: FailureCode;
  failureMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AssertionContext {
  outputText: string;
  outputJson?: unknown;
  toolCalls: ProviderToolCall[];
  baselineText?: string;
  baselineJson?: unknown;
  judgeAdapter?: ProviderAdapter;
  judgeModel?: string;
  configDir: string;
  latencyMs?: number;
  costUsd?: number;
  validateJsonSchema?: (
    schema: Record<string, unknown>,
    data: unknown,
  ) => { valid: true } | { valid: false; errors: string[] };
  getEmbedding?: (text: string) => Promise<number[]>;
}

export interface Assertion {
  readonly type: string;
  evaluate(context: AssertionContext): Promise<AssertionResult[]>;
}
