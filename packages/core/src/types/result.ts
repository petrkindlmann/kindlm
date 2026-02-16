export type Result<T, E = KindlmError> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface KindlmError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  cause?: Error;
}

export type ErrorCode =
  // Config errors
  | "CONFIG_NOT_FOUND"
  | "CONFIG_PARSE_ERROR"
  | "CONFIG_VALIDATION_ERROR"
  | "CONFIG_FILE_REF_ERROR"
  | "CONFIG_TOO_LARGE"
  | "PATH_TRAVERSAL"
  // Provider errors
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_API_ERROR"
  | "PROVIDER_NETWORK_ERROR"
  // Assertion errors
  | "ASSERTION_EVAL_ERROR"
  | "SCHEMA_FILE_ERROR"
  | "JUDGE_EVAL_ERROR"
  // Engine errors
  | "ENGINE_MAX_TURNS"
  | "ENGINE_EMPTY_RESPONSE"
  // Baseline errors
  | "BASELINE_NOT_FOUND"
  | "BASELINE_CORRUPT"
  | "BASELINE_VERSION_MISMATCH"
  // Cloud errors
  | "CLOUD_AUTH_ERROR"
  | "CLOUD_UPLOAD_ERROR"
  | "CLOUD_PLAN_LIMIT"
  | "CLOUD_RATE_LIMIT"
  // System errors
  | "UNKNOWN_ERROR";

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = KindlmError>(error: E): Result<never, E> {
  return { success: false, error };
}
