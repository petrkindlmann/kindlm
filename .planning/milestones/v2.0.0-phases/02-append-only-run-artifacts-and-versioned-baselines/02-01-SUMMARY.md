---
phase: 02-append-only-run-artifacts-and-versioned-baselines
plan: 01
subsystem: cli
tags: [artifacts, baseline, run-history, versioning]
dependency_graph:
  requires: []
  provides: [run-artifacts, immutable-baseline-versioning, last-run-artifact-pointer]
  affects: [cli/utils/last-run.ts, cli/commands/test.ts, cli/commands/baseline.ts, core/baseline/store.ts]
tech_stack:
  added: []
  patterns: [append-only artifacts, pointer files for latest, TDD with vi.mock(node:fs)]
key_files:
  created:
    - packages/cli/src/utils/artifacts.ts
    - packages/cli/src/utils/artifacts.test.ts
  modified:
    - packages/cli/src/utils/last-run.ts
    - packages/cli/src/commands/test.ts
    - packages/cli/src/commands/baseline.ts
    - packages/core/src/baseline/store.ts
    - packages/core/src/baseline/index.ts
    - packages/core/src/baseline/store.test.ts
decisions:
  - "computeRunId uses SHA-256 of suiteName:configHash:gitCommit (40-char slice) for deterministic, retry-safe run IDs"
  - "artifacts.ts uses direct fs imports (not injected IO) — CLI layer I/O is intentionally direct"
  - "writeBaselineVersioned pointer file contains only latestFile reference, never a content copy"
  - "crypto mock removed from artifacts.test.ts — createHash is deterministic so no mock needed; randomUUID result verified via contains check"
  - "Pre-existing lint errors in caching-adapter.ts + watcher.test.ts deferred (out of scope)"
metrics:
  duration: 7min
  completed: "2026-03-31"
  tasks: 2
  files: 8
---

# Phase 02 Plan 01: Append-Only Run Artifacts and Versioned Baselines Summary

Append-only per-run artifact files (5 files per execution under `.kindlm/runs/{runId}/{executionId}/`) plus immutable baseline versioning (timestamped files + pointer-only `-latest.json`) for KindLM CLI.

## What Was Built

### Task 1: artifacts.ts (TDD — 12 tests)

New `packages/cli/src/utils/artifacts.ts`:
- `computeRunId(suiteName, configHash, gitCommit)` — deterministic SHA-256 hex (40 chars), same inputs → same ID for retry safety
- `writeRunArtifacts(...)` — creates `.kindlm/runs/{runId}/{executionId}/` with exactly 5 files:
  - `results.json` — full RunResult JSON
  - `results.jsonl` — one line per TestRunResult (streaming log via appendFileSync)
  - `summary.json` — compact stats (passed/failed/errored/durationMs/passRate)
  - `metadata.json` — run metadata (runId, executionId, suiteName, gitCommit, configHash, timestamp)
  - `config.json` — raw YAML config content for replay

### Task 2: Integration wiring + baseline versioning

- `last-run.ts` — `LastRunData` gains `runId?: string` and `artifactDir?: string` optional fields
- `test.ts` — artifact writing block added before `saveLastRun`, non-fatal with `console.warn` on failure; `RunArtifactPaths` imported as top-level type import (not inline)
- `store.ts` — `BaselineData` gains optional `savedAt?: string`; new `writeBaselineVersioned` function:
  - Stamps `savedAt` on a non-mutating copy
  - Writes `{suiteName}-{YYYYMMDDHHMMSS}.json` (permanent historical record)
  - Writes `{suiteName}-latest.json` containing only `{ latestFile: "{name}.json" }` — no content copy
- `baseline.ts` — `set` subcommand uses `writeBaselineVersioned` instead of `writeBaseline`
- `baseline/index.ts` — exports `writeBaselineVersioned`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Inline `import()` type annotation in test.ts**
- **Found during:** Task 2
- **Issue:** Plan suggested `let artifactPaths: import("../utils/artifacts.js").RunArtifactPaths | undefined` but `@typescript-eslint/consistent-type-imports` forbids inline `import()` types
- **Fix:** Added `import type { RunArtifactPaths } from "../utils/artifacts.js"` at top of file
- **Files modified:** packages/cli/src/commands/test.ts
- **Commit:** de8567d

**2. [Rule 1 - Bug] `vi.mock("node:crypto")` with `importOriginal` caused circular dependency + esbuild error**
- **Found during:** Task 1 TDD lint/test cycle
- **Issue:** `await importOriginal<typeof import("node:crypto")>()` uses forbidden inline `import()` type; the proxy delegation also caused infinite recursion
- **Fix:** Removed crypto mock entirely. `createHash` is deterministic (no mock needed); `randomUUID` result verified via `toContain()` on the returned paths rather than asserting a fixed value
- **Files modified:** packages/cli/src/utils/artifacts.test.ts
- **Commit:** de8567d

**3. [Rule 1 - Bug] TS2488 on tuple destructuring from `calls[0]`**
- **Found during:** Task 1 typecheck
- **Issue:** `const [dirArg, optsArg] = calls[0]` — TypeScript correctly rejects destructuring of a possibly-undefined array element
- **Fix:** Guarded with `if (firstCall)` pattern consistent with rest of test file
- **Files modified:** packages/cli/src/utils/artifacts.test.ts
- **Commit:** de8567d

## Deferred Items

Pre-existing lint errors in files not modified by this plan (logged to `deferred-items.md`):
- `caching-adapter.ts` — unused `cacheHits`/`cacheMisses` vars, non-null assertion, unused param
- `watcher.test.ts` — non-null assertions on 4 lines

## Known Stubs

None — all code paths are wired and functional.

## Self-Check

- [x] `packages/cli/src/utils/artifacts.ts` exists
- [x] `packages/cli/src/utils/artifacts.test.ts` exists with 12 tests passing
- [x] `packages/core/src/baseline/store.ts` exports `writeBaselineVersioned`
- [x] Commits 8c5b826 and de8567d exist
- [x] `npm run typecheck` passes with zero errors
- [x] `npx vitest run packages/cli/src/utils/artifacts.test.ts` — 12/12 pass
- [x] `npx vitest run packages/core/src/baseline/store.test.ts` — 22/22 pass
