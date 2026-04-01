# Architecture Patterns: KindLM v2.1.0 Gap Closure

**Domain:** CLI behavioral AI testing tool — gap closure milestone
**Researched:** 2026-04-01
**Confidence:** HIGH (all findings from direct source reading)

---

## Integration Map

### 1. Multi-Pass Judge (`betaJudge`)

**Where it lives: `@kindlm/core` — extend `judge.ts`, not a CLI wrapper.**

Rationale: `createJudgeAssertion()` already runs entirely inside `AssertionContext`. The judge makes one `judgeAdapter.complete()` call. Multi-pass means calling it N times and averaging the scores. That logic is pure (no I/O dependency, no Node.js API) — it belongs in core.

**Integration point:** `createJudgeAssertion()` in `core/src/assertions/judge.ts`.

The config shape gains an optional `passes` field (e.g., 3). When `passes > 1`, the assertion makes N sequential `complete()` calls, collects scores, averages them, compares the mean against `minScore`. The aggregated metadata should include individual scores and the mean. The `AssertionResult` `score` field becomes the mean.

The `betaJudge` feature flag is checked in `run-tests.ts` before building adapters. Since assertions are constructed inside `createAssertionsFromExpect()` (called from `executeUnit()` inside the runner), the flag must be threaded through as an `AssertionOverride` so core does not import from CLI. Concretely: add a `judgePassCount?: number` field to `AssertionOverrides` in `core/src/assertions/registry.ts`, set it in `runTestsInner` when `isEnabled(featureFlags, "betaJudge")`.

**No AbortController needed.** Each `complete()` call already respects `timeoutMs` via `ProviderAdapterConfig` (set during `adapter.initialize()`).

---

### 2. Cost Gating (`costGating`)

**Cost gating already exists.** The runner implements it at lines 161–188 of `runner.ts`.

The `budgetExceeded` flag is checked at the top of every unit closure before dispatching. When the flag flips, subsequent units return a `budgetExceededResult` (skipped with a `BUDGET_EXCEEDED` assertion failure). In-flight units complete because JS is single-threaded and `runWithConcurrency` workers only check `budgetExceeded` on the next iteration.

The `costMaxUsd` threshold comes from `config.gates?.costMaxUsd`. The feature flag `costGating` in `features.ts` is therefore a gate on whether this config field is **written** (enabled) or **zeroed out** (disabled). The correct integration point is in `runTestsInner` in `run-tests.ts`, after the config is parsed and before `createRunner()` is called:

```typescript
if (!isEnabled(featureFlags, "costGating") && config.gates?.costMaxUsd !== undefined) {
  config.gates.costMaxUsd = undefined; // strip the field, runner never sees it
}
```

This avoids touching `runner.ts` entirely. The runner's existing mid-run budget logic fires only when `costBudget` (= `config.gates?.costMaxUsd`) is defined.

**No new RunEvent hook needed.** The runner already emits `test.completed` with `costUsd` on every unit. If a progress display showing cumulative cost is needed, the existing `onEvent` callback in `runTestsInner` (lines 250–256) can accumulate it locally.

---

### 3. `--isolate` File Copying

**Where it happens: `test.ts`, between `createWorktree()` and the `runTests()` call.**

Current flow in `executeTestRun()` (test.ts lines 124–143):
1. `createWorktree(slug)` → `wt.path`
2. `process.chdir(wt.path)`
3. `runTests({ configPath: options.config, ... })`

The problem: `runTests` resolves `configPath` relative to `process.cwd()` (now the worktree). The worktree is a bare git checkout — the config file and any `$ref`/`schemaFile` paths referenced in it exist in the original working directory, not in the worktree.

**Integration point:** After `process.chdir(wt.path)` and before `runTests()`:

```typescript
// Copy kindlm.yaml + all referenced files into worktree
await copyConfigIntoWorktree(originalCwd, wt.path, options.config);
```

`copyConfigIntoWorktree` lives in a new `cli/src/utils/worktree-copy.ts` file. Its job:
1. Read + parse the YAML from `originalCwd` (using the same `parseConfig` call pattern as dry-run does).
2. Collect all file references: `test.expect.output.schemaFile`, `test.expect.toolCalls[].argsSchema`, any `include:` paths.
3. Copy each referenced file into the worktree, preserving relative path structure.
4. Copy the config YAML itself.

Only `copyConfigIntoWorktree` needs `fs` — it stays in CLI. Core never sees it.

**Ordering is strict:** copy must complete before `runTests()` because `runTestsInner` calls `readFileSync(configPath)` at line 95 and the runner pre-loads schema files at lines 100–119 of `runner.ts`.

---

### 4. `--concurrency` and `--timeout` CLI Overrides

**Integration point: `runTestsInner` in `run-tests.ts`, in the "Apply CLI overrides" block (lines 128–148).**

The existing pattern for `--runs` and `--gate` is the template: parse → validate → mutate `config.defaults` or `config.gates` in place before `createRunner()` is called. Follow exactly the same pattern:

```typescript
// After existing options.runs and options.gate blocks:
if (options.concurrency !== undefined) {
  config.defaults.concurrency = options.concurrency;
}
if (options.timeout !== undefined) {
  config.defaults.timeoutMs = options.timeout;
}
```

`RunTestsOptions` gains `concurrency?: number` and `timeout?: number`. `test.ts` parses `--concurrency <n>` and `--timeout <ms>` via Commander, validates them (positive integer), and passes them to `runTests()`.

The runner reads `config.defaults.concurrency` at line 165 (`runWithConcurrency(..., config.defaults.concurrency)`) and `config.defaults.timeoutMs` is passed to `adapter.initialize()` at line 236 of `run-tests.ts`. Both already flow correctly — no changes needed in core.

---

### 5. Mid-Run Stop (`costGating` abort path)

**Use the existing `budgetExceeded` flag pattern in `runner.ts` — no AbortController.**

The runner's concurrency pool is a JS pull model (`runWithConcurrency`). Each worker pulls the next unit via `nextIndex++`. The `budgetExceeded` boolean is checked at the start of each unit closure before any async work begins. This gives bounded overshoot (units already awaiting their `complete()` call finish; the next batch is cancelled). This is already implemented and correct.

If a hard stop (cancel in-flight requests) is needed in the future, the insertion point would be adding an `AbortSignal` to `RunnerDeps` and threading it into `adapter.complete()` — but this is not needed for cost gating as currently designed, because in-flight requests completing does not violate the budget contract (the budget gate on `gates.costMaxUsd` is a soft ceiling with documented bounded overshoot).

**For unit tests:** the `budgetExceeded` flag is internal to the runner closure. Test it by constructing a config with a `gates.costMaxUsd` smaller than one test's estimated cost, running two tests, and asserting the second returns `BUDGET_EXCEEDED` in its assertions.

---

### 6. Unit Test Integration Points

**`createSpinner()` spy:** `createSpinner` is imported in `run-tests.ts` from `./spinner.js`. Use `vi.mock("../utils/spinner.js")` and return a spy object with `start` and `stop` methods. The spinner reference is a local variable (`const spinner = createSpinner()`), so the mock must intercept the factory, not the instance.

**`selectReporter` mock:** `selectReporter` is called at the top of `executeTestRun()` in `test.ts` before any runner logic. Mock via `vi.mock("../utils/select-reporter.js")` and return `{ generate: vi.fn().resolves({ content: "" }) }`.

**`createRunner` mock:** `createRunner` is called in `run-tests.ts`. Mock it via `vi.mock("@kindlm/core", ...)` with a factory override, or inject a fake runner by wrapping `runTestsInner` to accept an optional `runnerFactory` dep (dependency injection). The second approach is cleaner for unit testing without mocking the entire core barrel.

---

## Component Boundary Summary

| Feature | Touches Core | Touches CLI | New File |
|---------|-------------|-------------|----------|
| betaJudge multi-pass | `judge.ts`, `registry.ts` (override) | `run-tests.ts` (flag → override) | No |
| costGating flag | None — existing runner logic | `run-tests.ts` (strip field when disabled) | No |
| --isolate file copy | None | `test.ts` (call site), new copy util | `worktree-copy.ts` |
| --concurrency/--timeout | None — existing runner reads config | `run-tests.ts` (override block), `test.ts` (Commander flags) | No |
| mid-run stop | Existing `budgetExceeded` flag | None | No |

## Data Flow: CLI Overrides → Runner

```
test.ts (Commander parse)
  → runTests(options)
    → runTestsInner(options, spinner)
      → parseConfig()
      → [apply CLI overrides: runs, gate, concurrency, timeout]
      → [strip costMaxUsd if !costGating flag]
      → [set judgePassCount override if betaJudge flag]
      → adapter.initialize({ timeoutMs: config.defaults.timeoutMs })
      → createRunner(config, deps)  ← concurrency from config.defaults.concurrency
        → runWithConcurrency(units, config.defaults.concurrency)
          → executeUnit() → runAssertions() → createJudgeAssertion(passes)
```

## Sources

All findings from direct source reading of:
- `packages/core/src/engine/runner.ts` (lines 85–298, concurrency pool lines 165–188)
- `packages/core/src/engine/gate.ts` (cost gate at lines 127–139)
- `packages/core/src/assertions/judge.ts` (single-pass evaluate at lines 72–152)
- `packages/cli/src/commands/test.ts` (worktree flow at lines 124–254)
- `packages/cli/src/utils/run-tests.ts` (override block lines 128–148, onEvent lines 250–256)
- `packages/cli/src/utils/worktree.ts` (createWorktree at lines 136–164)
- `packages/core/src/types/provider.ts` (ProviderAdapter interface)
- `packages/cli/src/utils/features.ts` (FeatureFlags type, isEnabled)
