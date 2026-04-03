# Phase 15: Watch Mode - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the watch mode so `kindlm test --watch` reliably re-runs on config changes with proper process management, cost tracking, and clean exit. The foundation (watcher.ts, --watch flag, basic re-run loop) already exists. This phase upgrades the watcher to chokidar, adds previous-run cancellation, timestamped separators, cumulative cost, and SIGINT cleanup.

</domain>

<decisions>
## Implementation Decisions

### File watcher upgrade (WATCH-01, WATCH-03)
- **D-01:** Replace `node:fs.watch` in `watcher.ts` with chokidar 4.x for cross-platform reliability.
- **D-02:** Use chokidar's `awaitWriteFinish: { stabilityThreshold: 300 }` instead of manual setTimeout debounce.
- **D-03:** Watch the config file AND all files referenced in the config (schemaFile, argsSchema paths). Extract referenced files using the same pattern as `--isolate` file copy (parse YAML, walk test expectations).
- **D-04:** Add `chokidar` as a dependency in `packages/cli/package.json`.

### Process management (WATCH-02)
- **D-05:** Track the currently-running test promise. On re-trigger, set an `aborted` flag that causes the current run to skip remaining tests gracefully. Do NOT use child processes — the current inline `executeTestRun()` approach is correct.
- **D-06:** Use an `AbortController` or simple boolean flag checked between test executions. The run-in-progress completes its current test but skips subsequent ones.
- **D-07:** Prevent overlapping runs: if a run is in progress when a change triggers, mark abort and queue ONE re-run (not stack them).

### Output format (WATCH-04)
- **D-08:** Between runs, print a separator: `──── [2026-04-02T15:30:00Z] ────` (dim, ISO timestamp).
- **D-09:** Do NOT clear the terminal. Users need to scroll back to previous results.
- **D-10:** On first run, print the standard "Watching {path} for changes... Press Ctrl+C to stop." message (already exists).

### Cumulative cost tracking (WATCH-05)
- **D-11:** Maintain a session-level cost accumulator in the watch loop. After each run, add `RunResult.totalCost` (if available) to the accumulator.
- **D-12:** Print cumulative cost after each run: `Session cost: $X.XXXX (N runs)` in dim text.
- **D-13:** Cost accumulator resets only when watch mode exits.

### Signal handling (WATCH-06)
- **D-14:** Register `process.on('SIGINT', cleanup)` that: (1) closes chokidar watcher, (2) aborts any running test, (3) prints session summary (total runs, total cost), (4) exits with code 0.
- **D-15:** Register `process.on('SIGTERM', cleanup)` with the same handler.
- **D-16:** Ensure cleanup runs only once (guard with a boolean flag).

### Cache integration (WATCH-07)
- **D-17:** No special work needed — caching from Phase 14 is already wired via `createCachingAdapter` in `run-tests.ts`. Config-only changes (no prompt changes) will automatically hit cache and return instantly with `[cached]` indicator.

### Claude's Discretion
- Whether `watchFile()` function signature changes or gets a new `watchFiles()` function
- Internal state machine for the abort/re-queue logic
- Whether to show a brief summary line before the separator (e.g., "2 passed, 1 failed")

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing watch implementation
- `packages/cli/src/utils/watcher.ts` — Current `watchFile()` using `node:fs.watch`. REPLACE with chokidar.
- `packages/cli/src/utils/watcher.test.ts` — Existing tests. UPDATE for chokidar-based watcher.
- `packages/cli/src/commands/test.ts` lines 95-117 — Current watch mode wiring. EXTEND with process management, cost tracking, signal handling.

### Test execution
- `packages/cli/src/utils/run-tests.ts` — `runTests()` function called by watch loop. Returns `RunResult` with cost data.
- `packages/core/src/engine/runner.ts` — `RunResult` type with cost aggregation.

### Config file parsing (for referenced file watching)
- `packages/cli/src/commands/test.ts` lines 142-144 — Pattern for extracting referenced file paths (schemaFile, argsSchema) used by --isolate.

### Research
- `.planning/research/PITFALLS.md` §Pitfall 5 — Watch mode zombie processes
- `.planning/research/PITFALLS.md` §Pitfall 9 — Debounce too short on slow FS
- `.planning/research/SUMMARY.md` — chokidar 4.x decision, awaitWriteFinish

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (foundation ~60% built)
- `watcher.ts` — `watchFile()` with debounce. Needs replacement with chokidar but interface shape is good.
- `test.ts` watch block — Already runs initial test, watches config, re-runs on change. Needs: abort logic, cost tracking, signal handling, separator.
- `executeTestRun()` — Returns after run completes. Result includes reporter output but cost may need extraction.

### Established Patterns
- Commander options already has `--watch` registered
- `process.exit()` handling in test.ts already skips exit when `options.watch` is true (line 241)
- Error handling in watch callback already catches and logs (line 110-112)

### Integration Points
- `watcher.ts` — replace internals, keep or evolve interface
- `test.ts` watch block (lines 95-117) — major extension point
- `package.json` — add chokidar dependency
- `run-tests.ts` — may need to expose cost from RunResult

</code_context>

<specifics>
## Specific Ideas

- Watch mode should feel like Vitest's --watch — unobtrusive, fast feedback, clean output.
- The cache integration means config-only changes (tweaking assertions, thresholds) re-run for free.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-watch-mode*
*Context gathered: 2026-04-02*
