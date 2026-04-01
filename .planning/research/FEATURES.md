# Feature Landscape — KindLM v2.1.0 Gap Closure

**Domain:** AI agent behavioral testing CLI — gap-closure milestone
**Researched:** 2026-04-01
**Overall confidence:** HIGH (code evidence) / MEDIUM (external patterns)

---

## 1. betaJudge — Multi-Pass Judge Scoring

### How many passes?

**Recommendation: 3 passes, median aggregation.**

Research context: SE-Jury (ASE 2025) and the LLMs-as-Judges survey (arXiv 2412.05579) both show that
3-pass median outperforms single-pass for variance reduction. 5 passes offers diminishing returns at
2.5x the cost. The practical community consensus for CI-grade eval tools is N=3.

The existing `JudgeAssertionConfig` carries no `passes` field. The config schema should add an optional
`passes` field (default 3) gated behind the `betaJudge` feature flag. When the flag is off, the
current single-pass path runs unchanged.

### Aggregation strategy

Use **median** (not mean). LLM scores are not normally distributed — a single aberrant 0.0 from a
parse failure would drag the mean down hard. Median is robust to one bad pass out of three.

For 3 passes:
- Sort scores ascending.
- Median = middle value (index 1).

For N passes generally: `scores.sort(); return scores[Math.floor(scores.length / 2)]`.

### Handling parse/call errors on individual passes

Do not fail the whole assertion if one pass errors. Use a "partial success" approach:

1. Collect all pass results (score or error sentinel).
2. Filter to successful parses only.
3. If zero successful passes: return `JUDGE_EVAL_ERROR` (no change from current behavior).
4. If at least one successful pass: compute median from successful scores, record `passesAttempted`
   and `passesSucceeded` in `metadata`.

This way a transient API blip on pass 2 of 3 does not fail CI.

### Where to implement

`packages/core/src/assertions/judge.ts` — add internal `runJudgePasses(N, context)` helper.
`packages/core/src/config/schema.ts` — add `passes?: z.number().int().min(1).max(9).default(3)` to
judge assertion config.

The multi-pass logic must stay in `@kindlm/core`. The feature flag check (`isEnabled(flags, 'betaJudge')`)
happens in the CLI layer (`run-tests.ts`) and is passed via `AssertionOverrides` or a flag on
`AssertionContext`.

**Implementation note:** The current `judge.ts` always uses `temperature: 0`. Keep that for
multi-pass. Temperature=0 with repeated identical prompts still produces variance on real provider
deployments (different backends, sampling seeds), which is the whole point of multiple passes.

---

## 2. costGating — Pre-emptive Budget Enforcement

### Current state

The runner (`packages/core/src/engine/runner.ts`) already has the full cost gating implementation:

```typescript
let cumulativeCostUsd = 0;
let budgetExceeded = false;
const costBudget = config.gates?.costMaxUsd;
// ... per-unit check before executeUnit
// ... post-unit accumulation + budgetExceeded flag set
```

The `budgetExceededResult()` helper is already implemented and returns a proper `BUDGET_EXCEEDED`
assertion failure.

**The gap is not in the runner — it is in the feature flag wiring.** `costGating` flag exists in
`.kindlm/config.json` but `run-tests.ts` does not pass `config.gates.costMaxUsd` conditionally on
the flag. The runner always reads `config.gates?.costMaxUsd` from the parsed YAML regardless of the
flag.

### Recommended approach

The `costGating` feature flag should gate whether the `gates.costMaxUsd` field in kindlm.yaml is
respected at runtime (not whether it appears in config). When the flag is `false`, strip
`costMaxUsd` from the gates object before passing to the runner, or pass `undefined` for budget.

This keeps the runner clean (no flag awareness in `@kindlm/core`) and gates from the CLI layer
as all other feature flags do.

### Where in the loop does the check happen?

Already correct: the check happens **before each unit executes** (not per-batch, not post-hoc).
With `runWithConcurrency`, tests already in-flight when budget is exceeded will complete — there is
bounded overshoot of at most `concurrency - 1` additional tests. This is documented in the runner
with a comment. This is the correct trade-off; stopping mid-concurrency would require cancellation
tokens and adds complexity with minimal real-world budget benefit.

---

## 3. --isolate Filesystem Fix (ISOLATE-01)

### The gap

`worktree.ts` creates a detached-HEAD git worktree. The test runner still uses the original
`configDir` (the source tree). Schema files referenced in test YAML as relative paths
(`schemaFile: "./schemas/response.json"`) are resolved against `configDir` — which is the original
tree, not the worktree. So `--isolate` provides git isolation but not filesystem isolation.

### What needs to be copied

From the runner code:
- `test.expect.output?.schemaFile` — JSON Schema files (resolved via `joinPath(configDir, schemaFile)`)
- Any `$ref` paths within those schema files that point to sibling files (AJV resolves these)
- The `kindlm.yaml` config file itself

All paths are relative to `configDir`. The worktree already contains tracked git files (the YAML,
any schemas checked into git). The copy is only needed for **untracked/gitignored files** — schema
files that users may have in `.gitignore` (unlikely but possible) and the `.kindlm/` state directory.

### Recommended implementation

In `worktree.ts` (or a new `isolate.ts` helper), after `git worktree add`:

1. Read the parsed config to enumerate all `schemaFile` paths.
2. For each path: check if the file exists in the worktree (it is already there if tracked by git).
   If missing, copy from `configDir` to `worktreePath` preserving the relative path.
3. Copy `.kindlm/baselines/` into the worktree `.kindlm/` directory (baseline comparison needs it).
4. Do NOT copy `.kindlm/config.json` (feature flags) — use the source tree's flags, not a stale copy.

Path resolution: use `node:path`'s `path.resolve(configDir, schemaFile)` and
`path.join(worktreePath, path.relative(configDir, absoluteSchemaPath))` for destination.

**Constraint:** This happens in the CLI layer (`--isolate` flag handling in `test.ts`), not in core.
Core remains zero-I/O.

### $ref handling

AJV resolves `$ref` relative to the schema file's own location. If the schema being copied has
`$ref: "./types.json"`, that sibling also needs to be in the worktree. A recursive scan of `$ref`
paths in copied JSON schemas is the thorough approach, but for v2.1.0 a single-level copy
(copy all files in the same directory as each `schemaFile`) is simpler and covers 99% of real
usage. Flag this as a known limitation.

---

## 4. Unit Tests — dry-run.ts, select-reporter.ts, spinner.ts

### dry-run.ts (formatTestPlan)

Pure function — no I/O, no mocks needed. Tests verify:
- Output contains suite name from `TestPlan.suiteName`
- Active entries rendered with model label `[modelId]`
- Command entries rendered with `[command]` label
- Repeat > 1 shows `x{N}` suffix
- Skipped entries appear in "Skipped:" section
- Total execution units and concurrency/timeout appear in footer
- Empty active entries shows "No tests to execute."

Pattern: construct minimal `TestPlan` objects directly, call `formatTestPlan()`, assert
`result.includes(expected)`. No chalk stripping needed — the test just checks for substrings that
are not chalk-colored (the test name, model id strings, numeric values).

### select-reporter.ts (selectReporter)

Uses `process.exit(1)` on unknown type — must mock `process.exit` to prevent test process death.

Standard pattern:

```typescript
vi.spyOn(process, 'exit').mockImplementation((_code) => { throw new Error('process.exit'); });
```

Tests:
- `selectReporter("pretty")` returns object with `report` function (duck-type check)
- `selectReporter("json")` returns object with `report` function
- `selectReporter("junit")` returns object with `report` function
- `selectReporter("unknown")` calls `process.exit(1)` — assert the spy was called with `1`

Mocking `@kindlm/core` reporters is optional; testing that the right factory was called requires
mocking them. Since the return types are duck-typed (`Reporter` interface), it is simpler to mock
`@kindlm/core` and assert `createPrettyReporter` / `createJsonReporter` / `createJunitReporter`
were each called:

```typescript
vi.mock("@kindlm/core", () => ({
  createPrettyReporter: vi.fn().mockReturnValue({ report: vi.fn() }),
  createJsonReporter:   vi.fn().mockReturnValue({ report: vi.fn() }),
  createJunitReporter:  vi.fn().mockReturnValue({ report: vi.fn() }),
}));
```

### spinner.ts (createSpinner)

The existing `run-tests.test.ts` already demonstrates the standard pattern for this codebase:

```typescript
vi.mock("./spinner.js", () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn()
  })),
}));
```

For a unit test of `spinner.ts` itself, mock `ora` at the module level:

```typescript
vi.mock("ora", () => ({
  default: vi.fn().mockReturnValue({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
  }),
}));
```

Then import `createSpinner` and verify:
- `start(text)` calls `ora({ text, stream: process.stderr }).start()`
- `succeed(text)` calls `instance.succeed(text)` and nulls the instance
- `fail(text)` calls `instance.fail(text)` and nulls the instance
- `stop()` calls `instance.stop()` and nulls the instance
- Calling `succeed` when `start` was never called does not throw (instance is undefined; optional
  chaining `instance?.succeed` already handles this)

**Key constraint:** `ora` is a default import (`import ora from "ora"`). The mock must use
`vi.mock("ora", () => ({ default: vi.fn(...) }))` — the `default` key is required for ESM default
imports mocked via `vi.mock`.

---

## 5. CLI Overrides — --concurrency and --timeout

### Expected behavior

`--concurrency N` overrides `config.defaults.concurrency` for this run only.
`--timeout MS` overrides `config.defaults.timeoutMs` for this run only.

These are pure overrides: take the parsed `KindLMConfig`, mutate `defaults.concurrency` /
`defaults.timeoutMs` after parse and before runner construction. No changes to core required.

**For `--timeout`:** `config.defaults.timeoutMs` is used in two places:
1. `runner.ts` line 543: `deps.commandExecutor.execute(cmdResult.data, { timeoutMs: config.defaults.timeoutMs, ... })`
2. Provider-level HTTP timeout (set on adapter init). Note — provider timeout is set during adapter
   initialization in `run-tests.ts`, before the runner runs. If `--timeout` is to affect HTTP
   requests (not just command tests), `runTests()` must apply the override before adapter init.

**Recommendation:** `--timeout` overrides `config.defaults.timeoutMs` which flows into command test
execution. It does not retroactively affect provider adapter HTTP timeout (which is set at init
time). Document this as the behavior. If users need provider timeout control, that is a separate
`defaults.providerTimeoutMs` field — out of scope for v2.1.0.

### Where to wire

In `packages/cli/src/commands/test.ts`, after calling `parseConfig()`:

```typescript
if (options.concurrency !== undefined) config.defaults.concurrency = options.concurrency;
if (options.timeout !== undefined)     config.defaults.timeoutMs = options.timeout;
```

The `formatTestPlan` function already uses `plan.concurrency` and `plan.timeoutMs` for display —
these are derived from `config.defaults`, so the dry-run output will reflect the override correctly
with no additional changes.

### Validation

- `--concurrency` must be ≥ 1. Commander `.argParser(parseInt)` + check before assignment.
- `--timeout` must be ≥ 1. Same approach.
- Both are optional; omitting them preserves existing behavior exactly.

---

## Feature Dependencies

```
betaJudge flag on → judge.ts multi-pass path → no changes to runner, config schema, or CLI
costGating flag on → gates.costMaxUsd forwarded to runner → runner already handles it
--isolate + ISOLATE-01 → worktree created → files copied → test.ts switches cwd to worktree
--concurrency/--timeout → config.defaults mutated → runner reads defaults as usual
```

## Anti-Features

| Anti-Feature | Why Avoid |
|---|---|
| Temperature > 0 for multi-pass judge | Defeats caching; temperature=0 already produces variance across real backends |
| Cancelling in-flight tasks when budget exceeded | Requires cancellation tokens; bounded overshoot is acceptable at concurrency 4 |
| Recursive $ref scanning for ISOLATE-01 | Overkill for v2.1.0; single-level directory copy covers real usage |
| `--timeout` affecting provider HTTP timeout | Provider adapter is initialized before runner; retroactive change requires API redesign |

## Sources

- SE-Jury paper (ASE 2025): https://arxiv.org/html/2505.20854v2
- LLMs-as-Judges survey: https://arxiv.org/html/2412.05579v2
- LLM-as-a-Judge survey: https://arxiv.org/abs/2411.15594
- Vitest mocking guide: https://vitest.dev/guide/mocking
- Existing codebase patterns: `run-tests.test.ts` (ora mock), `worktree.test.ts` (execFile mock)
