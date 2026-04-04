import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

// ============================================================
// Constants
// ============================================================

export const BASELINE_VERSION = "1";

/**
 * Ordered list of known baseline versions from oldest to newest.
 * When adding a new version, append it here and add a migration
 * function in MIGRATIONS.
 */
const KNOWN_VERSIONS: readonly string[] = ["1"];

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
  savedAt?: string;       // ISO timestamp stamped on write (immutability marker)
  results: Record<string, BaselineTestEntry>;
}

export type MigrationResult =
  | { ok: true; baseline: BaselineData; migrated: boolean }
  | { ok: false; error: string };

// ============================================================
// Migration framework
// ============================================================

/**
 * Map from source version to a function that migrates to the next version.
 *
 * Compliance consideration: historical baselines are evidence and should
 * not be destroyed. Migration transforms the comparison format but
 * preserves all original data. When a baseline is migrated on read, the
 * caller should persist the updated version so subsequent reads are fast,
 * but the original file content is never silently discarded.
 */
type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<string, MigrationFn> = {
  // Example for future use:
  // "1": (raw) => ({ ...raw, version: "2", newField: defaultValue }),
};

/**
 * Attempt to migrate a parsed baseline object from its current version
 * to BASELINE_VERSION through a chain of migrations.
 */
export function migrateBaseline(raw: unknown): MigrationResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Baseline data is not an object" };
  }

  let obj = raw as Record<string, unknown>;
  const version = obj["version"];

  if (typeof version !== "string") {
    return { ok: false, error: "Baseline data missing version field" };
  }

  if (version === BASELINE_VERSION) {
    const validated = validateBaselineFields(obj);
    if (!validated.ok) return validated;
    return { ok: true, baseline: obj as unknown as BaselineData, migrated: false };
  }

  if (!KNOWN_VERSIONS.includes(version)) {
    return {
      ok: false,
      error: `Unsupported baseline version: "${version}". Known versions: ${KNOWN_VERSIONS.join(", ")}`,
    };
  }

  // Walk the migration chain from the current version to the latest
  let currentVersion = version;
  let migrated = false;

  while (currentVersion !== BASELINE_VERSION) {
    const migrationFn = MIGRATIONS[currentVersion];
    if (!migrationFn) {
      return {
        ok: false,
        error: `No migration path from version "${currentVersion}" to "${BASELINE_VERSION}"`,
      };
    }
    obj = migrationFn(obj);
    currentVersion = obj["version"] as string;
    migrated = true;
  }

  const validated = validateBaselineFields(obj);
  if (!validated.ok) return validated;

  return { ok: true, baseline: obj as unknown as BaselineData, migrated };
}

function validateBaselineFields(
  obj: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  if (typeof obj["suiteName"] !== "string") {
    return { ok: false, error: "Baseline file missing required field: suiteName" };
  }
  if (typeof obj["createdAt"] !== "string") {
    return { ok: false, error: "Baseline file missing required field: createdAt" };
  }
  if (typeof obj["results"] !== "object" || obj["results"] === null) {
    return { ok: false, error: "Baseline file missing required field: results" };
  }
  return { ok: true };
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

  // Attempt migration instead of immediately failing on version mismatch
  const migration = migrateBaseline(parsed);

  if (!migration.ok) {
    // If the version is known but migration failed, or version is unknown
    const isKnown = KNOWN_VERSIONS.includes(obj["version"] as string);
    return err({
      code: isKnown ? "BASELINE_CORRUPT" : "BASELINE_VERSION_MISMATCH",
      message: migration.error,
    });
  }

  return ok(migration.baseline);
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

/**
 * Writes an immutable versioned baseline and updates a `-latest` pointer file.
 *
 * Two writes per call:
 *   1. `{suiteName}-{YYYYMMDDHHMMSS}.json` — the permanent historical record
 *   2. `{suiteName}-latest.json` — pointer containing only the filename reference
 *
 * The pointer contains only a filename reference (latestFile), never a content
 * copy. This preserves the single source of truth and keeps pointer files small.
 * Callers wanting to read the latest baseline should resolve via the pointer.
 */
export function writeBaselineVersioned(data: BaselineData, io: BaselineIO): Result<void> {
  const stamped: BaselineData = { ...data, savedAt: new Date().toISOString() };
  // Produce a compact sortable timestamp: YYYYMMDDHHMMSS
  const timestamp = (stamped.savedAt ?? "").replace(/[-:T.Z]/g, "").slice(0, 14);
  // Append a random hex nonce so two calls within the same second never collide
  const nonce = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const versionedName = `${data.suiteName}-${timestamp}-${nonce}`;

  const writeVersioned = io.write(versionedName, serializeBaseline(stamped));
  if (!writeVersioned.success) {
    return writeVersioned;
  }

  // Pointer file contains only the filename reference — never a content copy
  const pointer = JSON.stringify({ latestFile: `${versionedName}.json` });
  return io.write(`${data.suiteName}-latest`, pointer);
}

export function listBaselines(io: BaselineIO): Result<string[]> {
  return io.list();
}
