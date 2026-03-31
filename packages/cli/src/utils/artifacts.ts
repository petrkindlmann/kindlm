import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { RunnerResult } from "@kindlm/core";

export interface RunArtifactPaths {
  runId: string;
  executionId: string;
  artifactDir: string;
}

/**
 * Produces a stable run ID from the logical run identity: same suite, same
 * config, same git commit → same ID. This makes retries idempotent: the
 * directory for a retry lives under the same runId but gets a fresh executionId.
 */
export function computeRunId(
  suiteName: string,
  configHash: string,
  gitCommit: string | null,
): string {
  return createHash("sha256")
    .update(`${suiteName}:${configHash}:${gitCommit ?? ""}`)
    .digest("hex")
    .slice(0, 40);
}

/**
 * Writes append-only run artifacts to `.kindlm/runs/{runId}/{executionId}/`.
 * Always creates 5 files: results.json, results.jsonl, summary.json,
 * metadata.json, config.json. Throws on directory creation failure — the
 * caller in test.ts wraps in try/catch to make this non-fatal.
 */
export function writeRunArtifacts(
  runnerResult: RunnerResult,
  suiteName: string,
  configHash: string,
  gitCommit: string | null,
  yamlContent: string,
): RunArtifactPaths {
  const runId = computeRunId(suiteName, configHash, gitCommit);
  const executionId = randomUUID();
  const artifactDir = join(process.cwd(), ".kindlm", "runs", runId, executionId);

  mkdirSync(artifactDir, { recursive: true, mode: 0o700 });

  // Full run result for offline replay and detailed inspection
  writeFileSync(
    join(artifactDir, "results.json"),
    JSON.stringify(runnerResult.runResult, null, 2),
  );

  // Streaming per-test log — one JSON line per TestRunResult
  for (const suite of runnerResult.runResult.suites) {
    for (const test of suite.tests) {
      appendFileSync(join(artifactDir, "results.jsonl"), JSON.stringify(test) + "\n");
    }
  }

  // Compact stats for quick CI dashboards and trend charts
  const { passed, failed, errored, durationMs, totalTests } = runnerResult.runResult;
  writeFileSync(
    join(artifactDir, "summary.json"),
    JSON.stringify({
      passed,
      failed,
      errored,
      durationMs,
      passRate: totalTests > 0 ? passed / totalTests : 0,
    }),
  );

  // Run-level metadata for upload, linking, and local search
  writeFileSync(
    join(artifactDir, "metadata.json"),
    JSON.stringify({
      runId,
      executionId,
      suiteName,
      gitCommit: gitCommit ?? null,
      configHash,
      timestamp: new Date().toISOString(),
    }),
  );

  // Raw config snapshot so users can replay the exact run
  writeFileSync(join(artifactDir, "config.json"), yamlContent);

  return { runId, executionId, artifactDir };
}
