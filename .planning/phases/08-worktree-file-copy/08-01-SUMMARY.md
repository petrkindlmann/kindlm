---
phase: 08-worktree-file-copy
plan: 01
subsystem: cli
tags: [isolate, worktree, file-copy, schema]
dependency_graph:
  requires: []
  provides: [ISOLATE-01]
  affects: [packages/cli/src/utils/worktree.ts, packages/cli/src/commands/test.ts]
tech_stack:
  added: [node:fs/promises (copyFile, mkdir), yaml (parse)]
  patterns: [path-escape-guard, best-effort-yaml-parse, fail-open-missing-files]
key_files:
  created: []
  modified:
    - packages/cli/src/utils/worktree.ts
    - packages/cli/src/utils/worktree.test.ts
    - packages/cli/src/commands/test.ts
decisions:
  - capturedCwd local const avoids TypeScript string|undefined for originalCwd at use sites before reassignment
  - WorktreeError re-thrown from inner copyErr catch so path escape degrades the same way as createWorktree failure
  - Path escape guard runs before any I/O — rejects all paths atomically
metrics:
  duration: 4min
  completed: 2026-04-01
  tasks_completed: 2
  files_modified: 3
---

# Phase 08 Plan 01: Worktree File Copy Summary

Implemented `extractConfigFilePaths` and `copyFilesToWorktree` in `worktree.ts`, and wired them into the `--isolate` block in `test.ts`. The config file and all `schemaFile`/`argsSchema` paths referenced in `kindlm.yaml` are now copied into the worktree before `process.chdir()`, closing the ISOLATE-01 gap where schema files were missing from the worktree causing assertion failures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement extractConfigFilePaths and copyFilesToWorktree with tests | b58046f | worktree.ts, worktree.test.ts |
| 2 | Wire copyFilesToWorktree into test.ts isolate block | 0483700 | test.ts |

## What Was Built

**`extractConfigFilePaths(yamlContent: string): string[]`**
- Parses raw YAML with `yaml.parse()`; returns `[]` on any parse error (never throws)
- Walks `tests[].expect.output.schemaFile` and `tests[].expect.toolCalls[].argsSchema`
- Returns deduplicated path list

**`copyFilesToWorktree(worktreePath, repoRoot, filePaths): Promise<void>`**
- Path escape guard: validates every path resolves within `repoRoot` before any I/O
- Throws `WorktreeError("Path escape detected: ...")` if any path escapes (atomically — no partial copy)
- Empty filePaths is a silent no-op
- ENOENT on copy: `console.warn` and skip (fail-open)
- Non-ENOENT errors are re-thrown

**`test.ts` wiring:**
- Resolves all paths against `capturedCwd` (original cwd captured before `chdir()`)
- Config file (`absConfigPath`) is always included in the copy list
- `WorktreeError` from `copyFilesToWorktree` bubbles to outer catch for graceful degradation
- Other copy errors emit a warning and allow the run to continue

## Deviations from Plan

**[Rule 1 - Bug] TypeScript string|undefined at copyFilesToWorktree call site**
- **Found during:** Task 2 (typecheck)
- **Issue:** `originalCwd` is typed `string | undefined` in the outer scope; TypeScript rejected `resolve(originalCwd, ...)` since `originalCwd` could be undefined even though it was set on the line above
- **Fix:** Introduced `capturedCwd` local const (`const capturedCwd = process.cwd()`) and assigned `originalCwd = capturedCwd`, allowing the copy block to use `capturedCwd` (narrowed to `string`)
- **Files modified:** `packages/cli/src/commands/test.ts`
- **Commit:** 0483700

## Known Stubs

None — all functions are fully wired with real behavior.

## Self-Check: PASSED

- `packages/cli/src/utils/worktree.ts` — FOUND: exports `extractConfigFilePaths` and `copyFilesToWorktree`
- `packages/cli/src/utils/worktree.test.ts` — FOUND: describe blocks for both functions, 27 tests passing
- `packages/cli/src/commands/test.ts` — FOUND: `copyFilesToWorktree` called before `process.chdir()`
- Commit b58046f — FOUND in git log
- Commit 0483700 — FOUND in git log
- `npx tsc -p packages/cli/tsconfig.json --noEmit` — exits 0
- All 27 worktree tests pass
