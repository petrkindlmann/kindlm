import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

// ============================================================
// Constants
// ============================================================

export const BASELINE_VERSION = "1";

// ============================================================
// Types
// ============================================================

export interface BaselineIO {
  read(suiteName: string): Result<string>;
  write(suiteName: string, content: string): Result<void>;
  list(): Result<string[]>;
}

export interface BaselineTestEntry {
  passRate: number;
  outputText: string;
  failureCodes: string[];
  latencyAvgMs: number;
  costUsd: number;
  runCount: number;
}

export interface BaselineData {
  version: string;
  suiteName: string;
  createdAt: string;
  results: Record<string, BaselineTestEntry>;
}

// ============================================================
// Serialization
// ============================================================

export function serializeBaseline(data: BaselineData): string {
  return JSON.stringify(data, null, 2);
}

export function deserializeBaseline(raw: string): Result<BaselineData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file is not valid JSON",
    });
  }

  if (typeof parsed !== "object" || parsed === null) {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file is not a JSON object",
    });
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj["version"] !== "string") {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file missing required field: version",
    });
  }

  if (obj["version"] !== BASELINE_VERSION) {
    return err({
      code: "BASELINE_VERSION_MISMATCH",
      message: `Baseline version "${obj["version"]}" does not match expected "${BASELINE_VERSION}". Re-run \`kindlm baseline set\` to update.`,
    });
  }

  if (typeof obj["suiteName"] !== "string") {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file missing required field: suiteName",
    });
  }

  if (typeof obj["createdAt"] !== "string") {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file missing required field: createdAt",
    });
  }

  if (typeof obj["results"] !== "object" || obj["results"] === null) {
    return err({
      code: "BASELINE_CORRUPT",
      message: "Baseline file missing required field: results",
    });
  }

  return ok(parsed as BaselineData);
}

// ============================================================
// I/O-delegating functions
// ============================================================

export function readBaseline(suiteName: string, io: BaselineIO): Result<BaselineData> {
  const readResult = io.read(suiteName);
  if (!readResult.success) {
    return readResult;
  }

  return deserializeBaseline(readResult.data);
}

export function writeBaseline(data: BaselineData, io: BaselineIO): Result<void> {
  const content = serializeBaseline(data);
  return io.write(data.suiteName, content);
}

export function listBaselines(io: BaselineIO): Result<string[]> {
  return io.list();
}
