---
phase: 05-worktree-isolation
plan: "01"
subsystem: cli
tags:
  - worktree
  - isolation
  - git
  - cli

dependency_graph:
  requires:
    - packages/cli/src/utils/run-tests.ts
    - packages/cli/src/commands/test.ts
  provides:
    - packages/cli/src/utils/worktree.ts
    - "--isolate flag in kindlm test"
  affects:
    - packages/cli/src/commands/test.ts

tech_stack:
  added:
    - "node:child_process (execFile via manual Promise wrapper)"
    - "node:crypto (randomUUID for run ID)"
  patterns:
    - "Error subclass pattern: WorktreeError, WorktreeHasChangesError"
    - "Fail-closed null-return for git state uncertainty"
    - "Graceful degradation with console.warn on worktree creation failure"
    - "finally block for guaranteed cleanup"

key_files:
  created:
    - packages/cli/src/utils/worktree.ts
    - packages/cli/src/utils/worktree.test.ts
  modified:
    - packages/cli/src/commands/test.ts

decisions:
  - Manual Promise wrapper over promisify(execFile) preserves vi.mock compatibility in tests
  - Detached HEAD worktree avoids branch name conflicts during concurrent runs
  - toWorktreeSlug() lives in test.ts (not exported) per one-file-per-concern rule
  - countWorktreeChanges returns null (not throws) so callers can distinguish "unknown" from "clean"

metrics:
  duration: "6m"
  completed: "2026-03-31"
  tasks: 2
  files: 3
---

# Phase 05 Plan 01: Worktree Isolation for Test Runs Summary

**One-liner:** Git worktree isolation via `kindlm test --isolate` with slug validation, fail-closed cleanup, and graceful degradation when git is absent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for worktree utility | 704f243 | packages/cli/src/utils/worktree.test.ts |
| 1 (GREEN) | Create worktree.ts utility | 7066f8a | packages/cli/src/utils/worktree.ts |
| 2 | Wire --isolate flag into kindlm test | 4f6f425 | packages/cli/src/commands/test.ts |

## What Was Built

### packages/cli/src/utils/worktree.ts

New utility module with four exported functions and two error classes:

- **`WorktreeError`** — base error class for all worktree failures
- **`WorktreeHasChangesError`** — thrown when a worktree has uncommitted files or unpushed commits; carries `worktreePath`, `files`, `commits` fields
- **`validateWorktreeSlug(slug)`** — synchronous validation: max 64 chars, charset `[a-zA-Z0-9._-]`, rejects `.` and `..` reserved segments
- **`countWorktreeChanges(path)`** — returns `{ files, commits }` or `null` (fail-closed when git unavailable); upstream lookup failures default commits to 0
- **`removeWorktree(path, force?)`** — refuses to remove dirty worktrees without `force: true`; fail-closed when state is indeterminate
- **`createWorktree(slug, repoRoot?)`** — creates a detached-HEAD worktree under `.kindlm/worktrees/{slug}`; returns cleanup function that swallows `WorktreeHasChangesError` with a console.warn

**Key implementation choice:** Used a manual `Promise` wrapper instead of `util.promisify(execFile)`. The reason: `util.promisify` on the real `execFile` uses `promisify.custom` to resolve to `{ stdout, stderr }`, but `vi.mock("node:child_process")` replaces the function and loses that symbol. A manual wrapper resolves to just `stdout: string`, which works correctly in both production and test contexts.

### packages/cli/src/commands/test.ts

- Added `isolate?: boolean` to `TestOptions` interface
- Registered `--isolate` flag on the commander command
- Added `toWorktreeSlug()` pure helper (not exported): sanitizes suite name + appends 8-char UUID prefix
- Wired worktree lifecycle into `executeTestRun`:
  - Creates worktree before `runTests()` when `--isolate` is set
  - Degrades gracefully with `console.warn` if git is absent or worktree creation fails
  - Cleans up in a `finally` block so cleanup always runs, even on provider errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced promisify(execFile) with manual Promise wrapper**
- **Found during:** Task 1 GREEN (tests failing after implementation)
- **Issue:** `util.promisify.custom` on the real `execFile` resolves to `{ stdout, stderr }` object. When `vi.mock("node:child_process")` replaces execFile, that custom symbol is lost, so the mock's callback of `(null, stdout, "")` resolves to just the `stdout` string — making `result.stdout` undefined.
- **Fix:** Replaced `promisify(execFile)` with a manual wrapper that resolves to `stdout: string` directly.
- **Files modified:** packages/cli/src/utils/worktree.ts
- **Commit:** 7066f8a

## Verification Results

- `tsc --noEmit -p packages/cli/tsconfig.json` — exits 0 (clean)
- `npx vitest run .claude/worktrees/agent-ad70d821/packages/cli/src` — 18 files, 117 tests, all pass
- Worktree tests: 17/17 pass covering all behavior branches
- No changes to `kindlm test` behavior when `--isolate` is absent

## Known Stubs

None. The `--isolate` feature creates a real worktree on disk and removes it after tests. No placeholder data flows to any output.

## Self-Check: PASSED
