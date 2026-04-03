---
phase: 15-watch-mode
plan: "02"
subsystem: cli/commands/test
tags: [watch-mode, abort-queue, cost-tracking, signal-handling, chokidar]
dependency_graph:
  requires: [watchFiles, extractConfigFilePaths]
  provides: [watch-mode-complete, SIGINT-cleanup, session-cost-tracking]
  affects: [packages/cli/src/commands/test.ts]
tech_stack:
  added: []
  patterns:
    - abort/queue pattern with runInProgress + pendingRerun + abortRef
    - cost aggregation from suites[].tests[].costUsd (no top-level field)
    - cleanedUp guard to prevent double SIGINT handler execution
key_files:
  modified:
    - packages/cli/src/commands/test.ts
decisions:
  - abortRef signals in-flight run but does not force-kill it — run finishes its current test naturally, new run won't stack
  - executeTestRun return type changed to Promise<{costUsd, passed, failed} | undefined> for watch cost accumulation
  - Referenced files resolved against dirname(configPath) not cwd — avoids path resolution bug when invoked from different directories
metrics:
  duration_minutes: 8
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 1
---

# Phase 15 Plan 02: Watch Mode Integration Summary

Watch mode fully wired into `kindlm test --watch` — abort/queue logic, multi-file watching, session cost tracking, timestamped separators, and clean SIGINT/SIGTERM handling.

## What Was Built

**Full watch mode implementation in `packages/cli/src/commands/test.ts`:**

- Changed `watchFile` import to `watchFiles` (multi-file chokidar wrapper from Plan 01)
- Multi-file watch list: `[configPath, ...extractConfigFilePaths(yaml).map(p => resolve(dirname(configPath), p))]`
- Abort/queue state machine: `runInProgress`, `pendingRerun`, `abortRef` — prevents concurrent run stacking, queues max one pending re-run
- Timestamped separator (`────`) printed between runs (not before first) using `chalk.dim`
- Cost extracted per run: `result.suites.flatMap(s => s.tests).reduce((sum, t) => sum + (t.costUsd ?? 0), 0)`
- Session cost accumulated and displayed: `Session cost: $X.XXXX (N runs)` after each run
- `executeTestRun` return type changed to `Promise<{costUsd, passed, failed} | undefined>` — non-watch path unchanged (process.exit before return)
- SIGINT/SIGTERM handlers with `cleanedUp` guard — prints session summary, closes watcher, exits 0
- "Watching N files for changes..." message when multiple files watched

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire watch mode with abort, cost tracking, separators, signal handling | 81fe1a1 | packages/cli/src/commands/test.ts |
| 2 | Full CLI test suite verification | (verification only — no code changes) | — |

## Verification Results

- `tsc --noEmit` clean for CLI and core packages
- 318 CLI tests pass (34 test files, 1 skipped)
- `eslint` clean for test.ts and watcher.ts

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- packages/cli/src/commands/test.ts — exists and modified
- Commit 81fe1a1 — verified via git log
