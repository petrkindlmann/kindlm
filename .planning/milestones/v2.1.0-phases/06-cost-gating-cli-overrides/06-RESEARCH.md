# Phase 6: Cost Gating + CLI Overrides - Research

**Researched:** 2026-04-01
**Domain:** CLI flag parsing (Commander.js) + feature-flag-driven config mutation in `run-tests.ts`
**Confidence:** HIGH

## Summary

Phase 6 is a pure CLI-layer mutation with no core changes. All three requirements (COST-01, CLI-01, CLI-02) are wired in `packages/cli/src/utils/run-tests.ts` and `packages/cli/src/commands/test.ts`. No new files. No changes to `@kindlm/core`, `@kindlm/cloud`, `@kindlm/dashboard`, or `packages/vscode`.

The runner in `packages/core/src/engine/runner.ts` already fully implements budget enforcement: `config.gates?.costMaxUsd` drives `costBudget`, a `budgetExceeded` flag gates subsequent units, and `budgetExceededResult()` emits the failure result. The only gap is that `run-tests.ts` does not strip `costMaxUsd` from `config.gates` when the `costGating` feature flag is off — so the budget is always enforced today. The fix is a four-line deletion in `run-tests.ts` (in the CLI overrides block, after the `--gate` block).

`--concurrency` and `--timeout` follow the exact pattern already established by `--runs` and `--gate`. The validation guard pattern is `if (!Number.isInteger(n) || n < 1) → exit(1)`. The override is a direct assignment to `config.defaults.concurrency` / `config.defaults.timeoutMs` — identical to how `config.defaults.repeat` is overridden for `--runs`.

**Primary recommendation:** Add `--concurrency` and `--timeout` options to `test.ts`, add `concurrency?` and `timeout?` fields to `RunTestsOptions`, insert three override blocks in `runTestsInner`, add a `costGating` strip block. All changes land in two files, ~30 lines total.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COST-01 | `costGating` flag gates whether `config.gates.costMaxUsd` is forwarded to the runner | Runner already reads `config.gates?.costMaxUsd`; strip it in run-tests.ts when flag is off |
| CLI-01 | `kindlm test --concurrency N` overrides `config.defaults.concurrency` (validated ≥ 1) | Follow `--runs` pattern at run-tests.ts lines 128-134; assign to `config.defaults.concurrency` |
| CLI-02 | `kindlm test --timeout MS` overrides `config.defaults.timeoutMs` (validated ≥ 0) | Follow `--gate` pattern; assign to `config.defaults.timeoutMs`; add help-text note about provider HTTP timeout |
</phase_requirements>

## Standard Stack

### Core (unchanged — no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | ^13.0.0 | CLI flag parsing | Already used in test.ts; `.option()` pattern for all flags |
| TypeScript 5.7.0 | 5.7.0 | Strict ESM | Existing stack |
| Vitest 3.2.4 | 3.2.4 | Tests | Existing test framework |

No new npm packages required.

## Architecture Patterns

### Recommended Project Structure
No new files. Changes touch only:
```
packages/cli/src/
├── commands/test.ts          # Add --concurrency and --timeout Commander options
└── utils/run-tests.ts        # Add RunTestsOptions fields + 3 override blocks
```

### Pattern 1: CLI Override Block (established by --runs and --gate)
**What:** Validate the raw CLI integer/float, exit(1) with a clear message on bad input, then assign to the config defaults field.
**When to use:** Any CLI flag that overrides a config.defaults field.

From `run-tests.ts` lines 128-148 (the existing --runs and --gate blocks):

```typescript
// Source: packages/cli/src/utils/run-tests.ts lines 128-148
if (options.runs !== undefined) {
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    console.error(chalk.red(`Invalid --runs value: ${options.runs}. Must be a positive integer (>= 1).`));
    process.exit(1);
  }
  config.defaults.repeat = options.runs;
}
if (options.gate !== undefined) {
  if (Number.isNaN(options.gate) || options.gate < 0 || options.gate > 100) {
    console.error(chalk.red(`Invalid --gate value: ${options.gate}. Must be between 0 and 100.`));
    process.exit(1);
  }
  // ... assign
}
```

The `--concurrency` and `--timeout` blocks belong immediately after line 148 (end of the existing `--gate` block), before the `// 4. Resolve API keys` comment on line 151.

### Pattern 2: Feature Flag → Config Strip
**What:** Read a feature flag; if disabled, delete or nullify a config field before passing config to `createRunner()`.
**When to use:** When a feature flag controls whether the runner uses a specific gate.

costGating strip block — insert after the CLI override blocks (after `--timeout`), before `// 4. Resolve API keys`:

```typescript
// Source: run-tests.ts — new block, follows --gate block
if (!isEnabled(featureFlags, "costGating") && config.gates) {
  config.gates = { ...config.gates, costMaxUsd: undefined };
}
```

This nullifies only `costMaxUsd` in the gates object, leaving all other gates (`passRateMin`, `schemaFailuresMax`, etc.) intact. The runner's check `config.gates?.costMaxUsd` returns `undefined`, so `costBudget` is `undefined` and budget enforcement never fires.

### Anti-Patterns to Avoid
- **Deleting the entire `config.gates` object:** Destroys passRateMin, schemaFailuresMax, and other gates. Only nullify `costMaxUsd`.
- **Checking costGating after `createRunner()`:** Runner captures `config.gates?.costMaxUsd` at construction; it must be stripped before `createRunner()` is called.
- **Passing `--timeout` as provider HTTP timeout:** The provider adapter's `timeoutMs` is set during `adapter.initialize()` at run-tests.ts line 230-237. `config.defaults.timeoutMs` only affects command test execution timeout (runner.ts line 543). The CLI help text must say: "Does not affect provider HTTP timeout."
- **`--concurrency 0` silently hanging:** `runWithConcurrency` creates `Math.min(limit, tasks.length)` workers — if limit is 0, zero workers are spawned and the run hangs forever. Validation must reject `concurrency < 1`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cost accumulation in runner | Custom budget tracking | Existing `cumulativeCostUsd` / `budgetExceeded` in runner.ts | Already fully implemented with TOCTOU safety |
| Integer validation | Custom parseInt checks | `Number.isInteger(n) && n >= 1` guard | Established pattern from --runs |
| Feature flag reading | Direct JSON.parse in run-tests.ts | `isEnabled(featureFlags, "costGating")` | Already imported; consistent API |

## Common Pitfalls

### Pitfall 1: `costMaxUsd` stripped before or after wrong point
**What goes wrong:** Strip happens after `createRunner()` — runner already captured `config.gates?.costMaxUsd` in its closure at construction, so budget enforcement still fires.
**Why it happens:** `createRunner(config, deps)` at run-tests.ts line 262 captures the config reference at call time. The runner reads `config.gates?.costMaxUsd` at line 163 of runner.ts, inside the `run()` call — so the strip only needs to happen before `runner.run()`, not before `createRunner()`. Actually the runner reads it lazily inside `run()`, so stripping before `runner.run()` would work — but stripping before `createRunner()` is the safest and clearest contract.
**How to avoid:** Insert the costGating strip block after the `--timeout` override block and before `// 4. Resolve API keys` (line 151 in run-tests.ts).

### Pitfall 2: `--concurrency 0` hangs the runner
**What goes wrong:** `runWithConcurrency(tasks, 0)` creates `Math.min(0, tasks.length) = 0` workers; no tasks run, `Promise.all([])` resolves immediately with an empty array, but the test results list is empty — runner returns zero results. Actually worse: tasks array items are never consumed, so the run "completes" with no test results and reports 0/0 passed.
**Why it happens:** `Math.min(0, N)` = 0, so the workers array is empty.
**How to avoid:** Validate `concurrency >= 1` before assigning to config.defaults. Exit(1) with clear message: `"Invalid --concurrency value: 0. Must be a positive integer (>= 1)."`.

### Pitfall 3: `--timeout 0` is valid
**What goes wrong:** Treating `timeout: 0` like `concurrency: 0` and rejecting it. But timeout=0 is meaningful (immediate timeout for testing) and semantically distinct from invalid.
**Why it happens:** Confusing numeric domain semantics.
**How to avoid:** Validate `timeout >= 0` (not `> 0`). The requirement spec says "validated ≥ 0".

### Pitfall 4: parseInt for Commander string values
**What goes wrong:** Commander delivers all option values as strings (e.g. `"5"`). `parseInt("5abc", 10)` returns `5` — not `NaN` — so numeric validation passes but the value is wrong.
**How to avoid:** Follow the existing pattern in test.ts: parse in test.ts with `parseInt(options.concurrency, 10)` and pass the integer to `RunTestsOptions`. `Number.isInteger()` then correctly validates.

### Pitfall 5: `RunTestsOptions` type and `TestOptions` interface out of sync
**What goes wrong:** Adding `concurrency?` to `RunTestsOptions` in run-tests.ts but forgetting to add `concurrency?: string` to `TestOptions` in test.ts (or vice versa).
**How to avoid:** Update both interfaces together in the same task. TypeScript strict mode will catch missing assignments at the call site (`runTests({ ..., concurrency: ... })`).

## Code Examples

### Commander option syntax for new flags

```typescript
// Source: packages/cli/src/commands/test.ts — follows existing .option() pattern
.option("--concurrency <count>", "Override default test concurrency (must be >= 1)")
.option("--timeout <ms>", "Override test execution timeout in ms (>= 0; does not affect provider HTTP timeout)")
```

### TestOptions interface additions

```typescript
// Source: packages/cli/src/commands/test.ts — TestOptions interface
interface TestOptions {
  // ... existing fields ...
  concurrency?: string;
  timeout?: string;
}
```

### runTests call site in test.ts

```typescript
// Source: packages/cli/src/commands/test.ts — executeTestRun()
const { runnerResult, config, yamlContent, artifactPaths } = await runTests({
  configPath: options.config,
  runs: options.runs !== undefined ? parseInt(options.runs, 10) : undefined,
  gate: options.gate !== undefined ? parseFloat(options.gate) : undefined,
  concurrency: options.concurrency !== undefined ? parseInt(options.concurrency, 10) : undefined,
  timeout: options.timeout !== undefined ? parseInt(options.timeout, 10) : undefined,
  suite: options.suite,
  noCache: options.noCache,
});
```

### RunTestsOptions additions

```typescript
// Source: packages/cli/src/utils/run-tests.ts
export interface RunTestsOptions {
  configPath: string;
  runs?: number;
  gate?: number;
  concurrency?: number;   // new
  timeout?: number;       // new
  suite?: string;
  baselineData?: BaselineData;
  noCache?: boolean;
  featureFlags?: FeatureFlags;
}
```

### Concurrency override block (insert after --gate block, before // 4. Resolve API keys)

```typescript
// Source: packages/cli/src/utils/run-tests.ts — new block after line 148
if (options.concurrency !== undefined) {
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    console.error(chalk.red(`Invalid --concurrency value: ${options.concurrency}. Must be a positive integer (>= 1).`));
    process.exit(1);
  }
  config.defaults.concurrency = options.concurrency;
}
```

### Timeout override block (insert after concurrency block)

```typescript
// Source: packages/cli/src/utils/run-tests.ts — new block
if (options.timeout !== undefined) {
  if (!Number.isInteger(options.timeout) || options.timeout < 0) {
    console.error(chalk.red(`Invalid --timeout value: ${options.timeout}. Must be a non-negative integer (>= 0).`));
    process.exit(1);
  }
  config.defaults.timeoutMs = options.timeout;
}
```

### costGating strip block (insert after timeout block, before // 4. Resolve API keys)

```typescript
// Source: packages/cli/src/utils/run-tests.ts — new block
if (!isEnabled(featureFlags, "costGating") && config.gates) {
  config.gates = { ...config.gates, costMaxUsd: undefined };
}
```

### Test pattern from run-tests.test.ts (existing override tests to mirror)

```typescript
// Source: packages/cli/src/utils/run-tests.test.ts lines 171-179
it("exits 1 for invalid --runs value (zero)", async () => {
  try { await runTests({ configPath: "kindlm.yaml", runs: 0 }); } catch { /* exit throws */ }
  expect(exitCode).toBe(1);
  expect(errors.join("\n")).toContain("Invalid --runs value");
});

it("applies --runs override to config.defaults.repeat", async () => {
  const result = await runTests({ configPath: "kindlm.yaml", runs: 3 });
  expect(result.config.defaults.repeat).toBe(3);
});
```

New tests must mirror this pattern exactly for `--concurrency` and `--timeout`.

## Exact Line Numbers in run-tests.ts

| Insert point | Line | Current content | New block |
|---|---|---|---|
| After --gate block ends | After line 148 | `}` (closing gate block) | `--concurrency` validation + assign |
| After --concurrency block | After new concurrency block | — | `--timeout` validation + assign |
| After --timeout block | After new timeout block | — | `costGating` strip block |
| Before `// 4. Resolve API keys` | Line 151 | `// 4. Resolve API keys...` | (insert before this) |

The `featureFlags` variable is already declared at line 75 (`const featureFlags = options.featureFlags ?? loadFeatureFlags(process.cwd())`), so `isEnabled(featureFlags, "costGating")` is available at all insertion points.

## runner.ts: Cost Budget Field Name

The field is `costMaxUsd` (from `GatesConfig`, read at runner.ts line 163):

```typescript
// Source: packages/core/src/engine/runner.ts line 163
const costBudget = config.gates?.costMaxUsd;
```

The variable inside the runner is `costBudget`. The config schema field is `costMaxUsd`. There is no `budget` alias.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run packages/cli/src/utils/run-tests.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | `--concurrency 0` exits with error | unit | `npx vitest run packages/cli/src/utils/run-tests.test.ts` | New tests in existing file |
| CLI-01 | `--concurrency 1` sets config.defaults.concurrency | unit | same | New tests in existing file |
| CLI-02 | `--timeout 5000` sets config.defaults.timeoutMs | unit | same | New tests in existing file |
| CLI-02 | `--timeout -1` exits with error | unit | same | New tests in existing file |
| COST-01 | costGating=true: costMaxUsd forwarded to runner | unit | same | New tests in existing file |
| COST-01 | costGating=false: costMaxUsd stripped from config.gates | unit | same | New tests in existing file |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/cli/src/utils/run-tests.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. New tests are added to the already-existing `run-tests.test.ts` file, not a new file.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript mutation of existing files, no new tools, services, or runtimes required).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| costMaxUsd always enforced | costMaxUsd gated by costGating flag | Phase 6 | Users without flag enabled are unaffected |
| No concurrency CLI override | --concurrency flag available | Phase 6 | CI pipelines can force serial execution |
| No timeout CLI override | --timeout flag available | Phase 6 | CI pipelines can shorten timeouts without editing YAML |

## Project Constraints (from CLAUDE.md)

- **No classes** — all new code uses plain functions or direct assignments
- **`verbatimModuleSyntax: true`** — any new type-only imports must use `import type`
- **`.js` extensions in all relative imports** — already satisfied in existing run-tests.ts
- **`@kindlm/core` zero I/O** — all changes stay in CLI layer, no core modifications
- **Result types over exceptions** — not applicable here (CLI-layer validation calls `process.exit(1)` per existing pattern)
- **`tsc --noEmit` must pass** — TypeScript strict mode; new interface fields must be typed correctly
- **GSD workflow** — changes go through `/gsd:execute-phase`

## Open Questions

1. **`--timeout` with `parseInt` vs `parseFloat`**
   - What we know: `timeoutMs` is typed as `number` (integer milliseconds); `parseInt` is used for `--runs`
   - What's unclear: Whether `--timeout 5000.5` should be accepted (rounds to 5000) or rejected
   - Recommendation: Use `parseInt(options.timeout, 10)` for consistency with `--runs`; `Number.isInteger()` will then accept integer strings correctly

2. **`--concurrency` Commander syntax: `<count>` vs `[count]`**
   - What we know: `<count>` (required argument) is used for `--runs <count>` and `--gate <percent>` in existing test.ts
   - Recommendation: Use `<count>` (required) — if flag is passed without a value, Commander errors before our code runs

## Sources

### Primary (HIGH confidence)
- Direct source read: `packages/cli/src/utils/run-tests.ts` — exact lines 128-148 (override pattern)
- Direct source read: `packages/cli/src/commands/test.ts` — exact Commander option syntax, TestOptions interface
- Direct source read: `packages/cli/src/utils/features.ts` — `isEnabled()`, `FeatureFlags` type with `costGating: boolean`
- Direct source read: `packages/core/src/engine/runner.ts` — lines 161-188: `costBudget = config.gates?.costMaxUsd`, `budgetExceeded` flag, `runWithConcurrency` concurrency parameter
- Direct source read: `packages/core/src/engine/gate.ts` — `costMaxUsd` optional gate at lines 127-139
- Direct source read: `packages/cli/src/utils/run-tests.test.ts` — exact mock setup pattern, `vi.mocked`, process.exit spy, error capture pattern

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — confirmed microdollar accumulation note, `--runs` guard pattern reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, all from direct source reads
- Architecture: HIGH — exact file names, line numbers, and code from source reads
- Pitfalls: HIGH — derived from actual runner.ts implementation (`Math.min(limit, tasks.length)` concurrency behavior)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable codebase, no fast-moving dependencies)
