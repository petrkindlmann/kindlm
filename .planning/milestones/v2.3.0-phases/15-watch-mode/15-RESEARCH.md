# Phase 15: Watch Mode - Research

**Researched:** 2026-04-02
**Domain:** Node.js file watching, process management, CLI UX
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Replace `node:fs.watch` in `watcher.ts` with chokidar 4.x for cross-platform reliability.
- **D-02:** Use chokidar's `awaitWriteFinish: { stabilityThreshold: 300 }` instead of manual setTimeout debounce.
- **D-03:** Watch the config file AND all files referenced in the config (schemaFile, argsSchema paths). Extract referenced files using the same pattern as `--isolate` file copy (parse YAML, walk test expectations).
- **D-04:** Add `chokidar` as a dependency in `packages/cli/package.json`.
- **D-05:** Track the currently-running test promise. On re-trigger, set an `aborted` flag that causes the current run to skip remaining tests gracefully. Do NOT use child processes — the current inline `executeTestRun()` approach is correct.
- **D-06:** Use an `AbortController` or simple boolean flag checked between test executions. The run-in-progress completes its current test but skips subsequent ones.
- **D-07:** Prevent overlapping runs: if a run is in progress when a change triggers, mark abort and queue ONE re-run (not stack them).
- **D-08:** Between runs, print a separator: `──── [2026-04-02T15:30:00Z] ────` (dim, ISO timestamp).
- **D-09:** Do NOT clear the terminal. Users need to scroll back to previous results.
- **D-10:** On first run, print the standard "Watching {path} for changes... Press Ctrl+C to stop." message (already exists).
- **D-11:** Maintain a session-level cost accumulator in the watch loop. After each run, add `RunResult.totalCost` (if available) to the accumulator.
- **D-12:** Print cumulative cost after each run: `Session cost: $X.XXXX (N runs)` in dim text.
- **D-13:** Cost accumulator resets only when watch mode exits.
- **D-14:** Register `process.on('SIGINT', cleanup)` that: (1) closes chokidar watcher, (2) aborts any running test, (3) prints session summary (total runs, total cost), (4) exits with code 0.
- **D-15:** Register `process.on('SIGTERM', cleanup)` with the same handler.
- **D-16:** Ensure cleanup runs only once (guard with a boolean flag).
- **D-17:** No special work needed for cache integration — caching from Phase 14 is already wired via `createCachingAdapter` in `run-tests.ts`. Config-only changes will automatically hit cache.

### Claude's Discretion
- Whether `watchFile()` function signature changes or gets a new `watchFiles()` function
- Internal state machine for the abort/re-queue logic
- Whether to show a brief summary line before the separator (e.g., "2 passed, 1 failed")

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WATCH-01 | `kindlm test --watch` watches config file and all referenced files for changes using chokidar | chokidar 4.x `watch([...paths])` supports multi-file watching; `extractConfigFilePaths` already exists in worktree.ts |
| WATCH-02 | On file change, the previous test run is killed before starting a new one (no zombie processes) | AbortController pattern; `runTests()` SIGINT handler already uses process.removeListener — same pattern for abort flag |
| WATCH-03 | File change detection uses chokidar `awaitWriteFinish` with 300ms stabilization threshold | chokidar 4.x `awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }` option confirmed in docs |
| WATCH-04 | Between runs, a separator line with timestamp is printed (not full terminal clear) | Simple `chalk.dim()` console.log — no library needed |
| WATCH-05 | Cumulative API cost is tracked and displayed across the watch session | `TestRunResult.costUsd` exists on each test; sum from `RunResult.suites[].tests[].costUsd` |
| WATCH-06 | `Ctrl+C` cleanly exits watch mode, killing any running test process and closing the file watcher | `process.on('SIGINT')` + chokidar `watcher.close()` + abort flag |
| WATCH-07 | Watch mode works with response cache — config-only changes re-run from cache instantly | Already wired via `createCachingAdapter` — no changes needed |
</phase_requirements>

## Summary

Phase 15 is a focused gap-closure phase. Roughly 60% of watch mode already exists: the `--watch` flag is registered, `watcher.ts` debounces file events, `test.ts` runs on change, and `process.exit()` is already skipped in watch mode. What's missing is: chokidar upgrade (cross-platform reliability + awaitWriteFinish), abort logic for overlapping runs, multi-file watching (referenced schema files), cumulative cost display, separator output, and SIGINT/SIGTERM cleanup.

The CONTEXT.md decisions are highly specific and leave almost nothing to discretion. All architectural choices are locked. The implementation touches exactly 3 source files: `watcher.ts` (replace internals), `test.ts` (extend watch block), and `package.json` (add chokidar dep). Tests in `watcher.test.ts` need updating to mock chokidar instead of `node:fs`.

**Primary recommendation:** Implement chokidar 4.x (not 5.x — see version note below), replace watcher internals, extend the watch block in test.ts with abort + cost + signal handling, update tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | 4.0.3 | Cross-platform file watching with `awaitWriteFinish` | CONTEXT.md D-01 locks this; 5.x requires Node ≥20.19.0 which is stricter than project's ≥20.0.0 |

**Version note:** chokidar 5.0.0 is the latest (verified via `npm view`) but requires Node ≥20.19.0. The project specifies `node >=20.0.0`. Chokidar 4.0.3 requires Node ≥14.16.0 and is the safe choice. The CONTEXT.md says "4.x" — use `^4.0.3`.

**Confidence:** HIGH (verified via npm registry)

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | ^5.4.0 | Separator + cost output formatting | Already in cli deps |
| AbortController | Node built-in | Abort flag for in-progress run | Already available in Node 20+ |

**Installation:**
```bash
npm install chokidar@^4.0.3 -w packages/cli
```

## Architecture Patterns

### Recommended Structure Change

`watcher.ts` gets a new exported function `watchFiles(paths: string[], ...)` that accepts multiple paths. The old `watchFile()` becomes a thin wrapper or gets replaced. The `FileWatcher` interface (`close()`) stays identical — no changes needed at call sites.

### Pattern 1: chokidar Multi-File Watcher
**What:** Watch an array of paths with `awaitWriteFinish` stabilization
**When to use:** Replacing `node:fs.watch` for cross-platform reliability

```typescript
// Source: chokidar 4.x docs
import { watch } from "chokidar";

export function watchFiles(
  paths: string[],
  onChange: () => void,
  options?: WatcherOptions,
): FileWatcher {
  const watcher = watch(paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: options?.stabilityThreshold ?? 300,
      pollInterval: 100,
    },
  });

  watcher.on("change", onChange);
  watcher.on("add", onChange);

  return {
    close() {
      void watcher.close();
    },
  };
}
```

### Pattern 2: Abort + Queue Logic
**What:** Boolean abort flag checked between test executions; queued re-run fires once
**When to use:** Prevent overlapping runs, give user latest config version

```typescript
// In test.ts watch block
let runInProgress = false;
let pendingRerun = false;
let currentAbort = false;
let sessionRuns = 0;
let sessionCostUsd = 0;

const triggerRun = async () => {
  if (runInProgress) {
    currentAbort = true;
    pendingRerun = true;
    return;
  }

  runInProgress = true;
  currentAbort = false;

  // Print separator (not on first run)
  if (sessionRuns > 0) {
    console.log(chalk.dim(`──── [${new Date().toISOString()}] ────`));
  }

  try {
    const result = await executeTestRun(options, () => currentAbort);
    sessionRuns++;
    sessionCostUsd += result?.totalCostUsd ?? 0;
    console.log(chalk.dim(`Session cost: $${sessionCostUsd.toFixed(4)} (${sessionRuns} run${sessionRuns === 1 ? "" : "s"})`));
  } catch { /* logged inside executeTestRun */ }

  runInProgress = false;

  if (pendingRerun) {
    pendingRerun = false;
    void triggerRun();
  }
};
```

### Pattern 3: SIGINT/SIGTERM Cleanup
**What:** Single cleanup handler registered once, guarded against double-execution
**When to use:** WATCH-06 requirement

```typescript
let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  currentAbort = true;
  void fileWatcher.close();
  console.log(chalk.dim(`\nWatch session ended. ${sessionRuns} run${sessionRuns === 1 ? "" : "s"}, $${sessionCostUsd.toFixed(4)} total cost.`));
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
```

### Pattern 4: Cost Extraction from RunResult
**What:** Sum `costUsd` from all tests across all suites
**When to use:** Feeding the session accumulator

```typescript
// RunResult.suites[].tests[].costUsd is the source of truth
function extractRunCost(runResult: RunResult): number {
  return runResult.suites
    .flatMap((s) => s.tests)
    .reduce((sum, t) => sum + (t.costUsd ?? 0), 0);
}
```

`RunResult` does NOT have a top-level `totalCostUsd`. Cost lives at `TestRunResult.costUsd` (confirmed via code read). The planner must not assume a `runResult.totalCostUsd` shortcut exists.

### Anti-Patterns to Avoid
- **Using chokidar 5.x:** Requires Node ≥20.19.0 — breaks users on Node 20.0.0–20.18.x
- **Stacking concurrent runs:** Must queue at most ONE pending re-run (D-07)
- **Calling process.exit() in cleanup before watcher.close():** close() is async, need `void watcher.close()` then exit
- **Registering SIGINT inside runTests() during watch mode:** `runTests()` already registers a SIGINT handler that calls `process.exit(130)`. In watch mode the outer cleanup handler must win — the inner handler from `runTests()` will be removed after each call via `process.removeListener` (already in the existing code). No conflict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File stabilization debounce | Custom setTimeout after each event | `chokidar awaitWriteFinish` | Handles rapid multi-write editors (vim, VSCode atomic saves) |
| Multi-file watching | Multiple `fs.watch()` calls | `chokidar.watch([...paths])` | Single watcher, unified event stream |
| Cross-platform rename events | Platform-specific `rename` vs `change` detection | chokidar normalizes to `change` | macOS/Linux/Windows behave differently with `node:fs.watch` |

## Common Pitfalls

### Pitfall 1: SIGINT Conflict Between `runTests()` and Watch Cleanup
**What goes wrong:** `runTests()` registers its own `SIGINT` handler that calls `process.exit(130)`. In watch mode, this fires before the watch-level cleanup handler, causing exit code 130 instead of 0 and skipping the session summary.
**Why it happens:** `process.on('SIGINT')` is a listener array — multiple handlers fire in registration order.
**How to avoid:** The existing `runTests()` code already uses `process.removeListener("SIGINT", sigintHandler)` in its `finally` block. The watch-level SIGINT fires *during* a run while the inner handler is active, so both trigger. Solution: pass an `abortSignal` or `isWatchMode` flag so `runTests()`'s SIGINT handler skips `process.exit()` and instead just sets the abort flag, letting the watch-level cleanup drive exit.
**Warning signs:** Exit code 130 in watch mode when pressing Ctrl+C mid-run.

### Pitfall 2: Cost Accumulator vs. Cached Runs
**What goes wrong:** Cached test responses return `costUsd: 0` (no API call made). Session cost display correctly shows $0 for cached runs — this is expected behavior, not a bug.
**Why it happens:** `createCachingAdapter` returns `costEstimateUsd: 0` for cache hits. The engine propagates this to `TestRunResult.costUsd`.
**How to avoid:** Document the behavior; do not "fix" it by adding special cases.

### Pitfall 3: Referenced File Path Resolution
**What goes wrong:** `extractConfigFilePaths()` returns relative paths. When resolving them against `process.cwd()`, a mismatch occurs if the user runs `kindlm` from a different directory.
**Why it happens:** Paths in kindlm.yaml are relative to the config file's directory, not the cwd.
**How to avoid:** Resolve referenced paths against `dirname(configPath)`, same pattern used by `--isolate` worktree copy code in `test.ts` lines 144-147.

### Pitfall 4: Chokidar `ignoreInitial: true` Required
**What goes wrong:** Without `ignoreInitial: true`, chokidar fires `add` events for all watched paths immediately on startup, triggering a second test run before the first completes.
**Why it happens:** chokidar emits `add` for existing files during initial scan by default.
**How to avoid:** Always pass `ignoreInitial: true` when the watcher is set up after the initial run.

### Pitfall 5: `watcher.close()` is Async
**What goes wrong:** `chokidar.FSWatcher.close()` returns a Promise. Calling `process.exit()` synchronously after it may exit before watchers are cleaned up (OS file handles).
**Why it happens:** chokidar 4.x `close()` is async internally.
**How to avoid:** Use `void watcher.close()` — the process exits immediately, and the OS reclaims file handles. Alternatively `await watcher.close()` then exit, but this adds complexity in SIGINT handlers which must be synchronous.

## Code Examples

### chokidar 4.x Basic Usage
```typescript
// Source: chokidar 4.x npm page / README
import { watch } from "chokidar";

const watcher = watch(["kindlm.yaml", "schemas/tool-schema.json"], {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

watcher.on("change", (path) => {
  console.log(`File changed: ${path}`);
});

await watcher.close(); // async
```

### Mocking chokidar in Vitest
```typescript
// Updated watcher.test.ts pattern
const mockWatcherClose = vi.fn().mockResolvedValue(undefined);
const mockWatcherOn = vi.fn().mockReturnThis();

vi.mock("chokidar", () => ({
  watch: vi.fn().mockReturnValue({
    on: mockWatcherOn,
    close: mockWatcherClose,
  }),
}));

const { watchFiles } = await import("./watcher.js");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node:fs.watch` with manual setTimeout debounce | chokidar `awaitWriteFinish` | This phase | Cross-platform reliability; no more spurious double-fires on macOS |
| Single-file watching | Multi-file watching (config + referenced schemas) | This phase | Schema changes now trigger re-run automatically |

## Open Questions

1. **Should `executeTestRun` accept an abort signal?**
   - What we know: SIGINT conflict between `runTests()` inner handler and watch cleanup handler
   - What's unclear: Whether to pass abort via parameter or use a module-level flag
   - Recommendation: Pass as a parameter to `executeTestRun(options, abortRef)` where `abortRef = { aborted: false }` — cleanest without changing `runTests()` signature

2. **Should `watchFile()` be kept as a backward-compat shim or deleted?**
   - What we know: It's only called from `test.ts` (one call site, being replaced)
   - Recommendation: Delete `watchFile()` and replace with `watchFiles()` — no backward compat concern, it's internal

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥20.0.0 | chokidar 4.x | ✓ | v24.10.0 | — |
| chokidar | WATCH-01, WATCH-03 | not installed (new dep) | 4.0.3 (latest 4.x) | — |
| node:fs (built-in) | removed | ✓ | built-in | — |

**Missing dependencies with no fallback:**
- chokidar — install step required as Wave 0

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `packages/cli/vitest.config.ts` |
| Quick run command | `cd packages/cli && npx vitest run src/utils/watcher.test.ts` |
| Full suite command | `cd packages/cli && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WATCH-01 | watchFiles() calls chokidar.watch with all paths | unit | `npx vitest run src/utils/watcher.test.ts` | ✅ (needs update) |
| WATCH-02 | Abort flag set when run in-progress on re-trigger | unit | `npx vitest run src/commands/test.test.ts` | ❌ Wave 0 |
| WATCH-03 | chokidar called with awaitWriteFinish stabilityThreshold:300 | unit | `npx vitest run src/utils/watcher.test.ts` | ✅ (needs update) |
| WATCH-04 | Separator printed between runs | unit | `npx vitest run src/commands/test.test.ts` | ❌ Wave 0 |
| WATCH-05 | Session cost accumulates across runs | unit | `npx vitest run src/commands/test.test.ts` | ❌ Wave 0 |
| WATCH-06 | SIGINT closes watcher, aborts run, prints summary, exits 0 | unit | `npx vitest run src/commands/test.test.ts` | ❌ Wave 0 |
| WATCH-07 | Cache integration — no code changes needed | n/a | covered by Phase 14 tests | ✅ |

### Sampling Rate
- **Per task commit:** `cd /Users/petr/projects/kindlm/packages/cli && npx vitest run src/utils/watcher.test.ts`
- **Per wave merge:** `cd /Users/petr/projects/kindlm/packages/cli && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cli/src/commands/test.test.ts` — watch mode behavior tests (WATCH-02, WATCH-04, WATCH-05, WATCH-06)

## Project Constraints (from CLAUDE.md)

- **No classes** except error types — use factory functions (`watchFiles()`, not a class)
- **Zero I/O in core** — all watch mode logic stays in `@kindlm/cli`, never in `@kindlm/core`
- **ESM imports with `.js` extension** — `import { watch } from "chokidar"` (no extension needed for package imports; relative imports need `.js`)
- **verbatimModuleSyntax** — use `import type` for type-only imports
- **`tsc --noEmit` before done** — required by CLAUDE.md Forced Verification rule
- **strict mode** — no implicit `any`, use `unknown` for catch variables
- **Result types** — watch mode errors should log and continue (not throw), consistent with existing error handling in watch callback (line 110-112 of test.ts)

## Sources

### Primary (HIGH confidence)
- npm registry `npm view chokidar version` — verified chokidar latest is 5.0.0, 4.x latest is 4.0.3
- npm registry `npm view chokidar@5.0.0 engines` — verified Node ≥20.19.0 requirement for v5
- npm registry `npm view chokidar@4.0.3 engines` — verified Node ≥14.16.0 for v4
- Source code read: `packages/cli/src/utils/watcher.ts` — existing implementation confirmed
- Source code read: `packages/cli/src/commands/test.ts` — watch block lines 95-117 confirmed
- Source code read: `packages/cli/src/utils/run-tests.ts` — SIGINT handler pattern confirmed
- Source code read: `packages/core/src/engine/runner.ts` — `RunResult` interface confirmed, no top-level `totalCostUsd`

### Secondary (MEDIUM confidence)
- chokidar README / npm page — `awaitWriteFinish` option shape confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, version confirmed
- Architecture: HIGH — based on direct code reads, no assumptions
- Pitfalls: HIGH — derived from reading actual implementation (SIGINT handler in runTests, cost structure)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (chokidar 4.x is stable, no breaking changes expected)
