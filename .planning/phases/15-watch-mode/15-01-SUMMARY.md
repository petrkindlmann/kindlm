---
phase: 15-watch-mode
plan: "01"
subsystem: cli/watcher
tags: [watch-mode, chokidar, file-watching, cross-platform]
dependency_graph:
  requires: []
  provides: [watchFiles, FileWatcher, WatcherOptions]
  affects: [packages/cli/src/commands/test.ts]
tech_stack:
  added: [chokidar@4.0.3]
  patterns: [awaitWriteFinish stabilization, ignoreInitial scan skip, fire-and-forget close]
key_files:
  created: []
  modified:
    - packages/cli/src/utils/watcher.ts
    - packages/cli/src/utils/watcher.test.ts
    - packages/cli/package.json
decisions:
  - "chokidar 4.x (not 5.x) — 5.x requires Node >= 20.19.0 which is too recent"
  - "stabilityThreshold 300ms default — awaitWriteFinish handles debounce, no manual setTimeout needed"
  - "void watcher.close() — fire-and-forget since FSWatcher.close() is async but FileWatcher.close() is sync"
  - "listen on both change and add events — covers saves and new file creation in watched paths"
metrics:
  duration: "5 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 15 Plan 01: Chokidar Watcher Foundation Summary

chokidar 4.x watcher with awaitWriteFinish stabilization replacing node:fs.watch for cross-platform multi-file watching.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install chokidar and replace watcher.ts | ef7b413 | packages/cli/package.json, packages/cli/src/utils/watcher.ts |
| 2 | Rewrite watcher tests for chokidar | 8134d78 | packages/cli/src/utils/watcher.test.ts |

## What Was Built

Replaced the `watchFile(filePath, onChange, options)` function (using `node:fs.watch` with manual setTimeout debounce) with `watchFiles(paths, onChange, options)` using chokidar 4.x.

Key configuration:
- `ignoreInitial: true` — only post-scan changes trigger callback
- `awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }` — handles editor atomic writes
- Listens on both `"change"` and `"add"` events
- `persistent: true` — keeps process alive in watch mode

## Deviations from Plan

None — plan executed exactly as written. The TypeScript errors flagged by `tsc --noEmit` on the full CLI package are pre-existing (commands/test.ts still uses old `watchFile` — that call site update is Plan 02 scope).

## Known Stubs

None. `watchFiles()` is fully implemented. The call site in `commands/test.ts` still uses `watchFile` (the deleted function) — this will be wired in Plan 02.

## Self-Check: PASSED

- packages/cli/src/utils/watcher.ts — FOUND
- packages/cli/src/utils/watcher.test.ts — FOUND
- Commit ef7b413 — FOUND
- Commit 8134d78 — FOUND
- All 6 watcher tests pass
