# Domain Pitfalls

**Domain:** KindLM v2.1.0 gap-closure — multi-pass judge, cost gating, worktree file copy, ora mocking, CLI overrides
**Researched:** 2026-04-01
**Codebase version examined:** @kindlm/cli 2.0.0, @kindlm/core (assertions/judge.ts, engine/runner.ts)

---

## Critical Pitfalls

### Pitfall 1: Multi-Pass Judge — Partial Failure Ambiguity

**What goes wrong:** `betaJudge` runs the judge `N` times and takes the median. If pass `k` of `N` throws (provider rate-limit, transient 500, parse failure), the array of results is ragged. Naively passing partial results to a median function silently produces a median from fewer data points, masking flakiness.

**Why it happens:** The current `createJudgeAssertion` (judge.ts:109-120) catches adapter errors and returns a failed `AssertionResult` with score `0`. A multi-pass wrapper that re-uses this path will include score-0 poison values in the median calculation, making a judge that scored `[0.9, 0, 0.9]` (one transient failure) report `0.9` via median — but the pass count is wrong. Alternatively, if the implementation throws on partial failure, a single flaky API call fails the entire assertion.

**Consequences:** Flaky tests that silently pass (score-0 values dragged out by median) or tests that are too strict (any transient failure = total fail).

**Prevention:**
- Distinguish `JUDGE_EVAL_ERROR` / `JUDGE_PARSE_ERROR` results (infrastructure failures) from genuine low-score results before computing the median.
- Define a minimum-pass-count threshold: if fewer than `ceil(N/2)` passes returned a parseable score, return `JUDGE_EVAL_ERROR` rather than a phantom median.
- Keep the multi-pass loop in `@kindlm/core` (zero I/O — it only calls `judgeAdapter.complete`). The aggregation math belongs in core, not CLI.

**Detection:** Unit test with a mock adapter that fails on pass 2 of 3. Verify the result carries `JUDGE_EVAL_ERROR`, not a silently-passing median.

---

### Pitfall 2: Pre-emptive Cost Gating — TOCTOU Race in Concurrent Execution

**What goes wrong:** `run-tests.ts` runs tests with concurrency controlled by `config.defaults.concurrency`. A pre-emptive cost gate checks accumulated spend before launching each test. Under concurrency > 1, multiple tests can read the same running total simultaneously, both see "under budget", and both launch — pushing total spend past the cap before either finishes.

**Why it happens:** JavaScript is single-threaded but `async`/`await` yields between awaits. The pattern `if (runningCost < maxCost) { launch() }` is a classic check-then-act TOCTOU: between the check and the adapter call resolving, other concurrent tests have already incremented the counter.

**Consequences:** The budget cap is exceeded by up to `concurrency - 1` tests worth of cost. At concurrency=8 and $0.50/test cap, overspend can reach 7x the intended limit.

**Prevention:**
- Maintain a `reservedCost` counter alongside `accruedCost`. When a test is launched, immediately add its **estimated** cost to `reservedCost` (synchronously, before any await). Gate on `accruedCost + reservedCost < maxCost`.
- `estimateCost()` is already on every `ProviderAdapter` — use it pre-launch. Decrement `reservedCost` and increment `accruedCost` when the run resolves.
- This logic belongs in `@kindlm/core`'s runner (it's pure math, no I/O). Expose it via a new `costBudget` field in runner options.

**Detection:** Test with `concurrency: 4`, `maxCostUsd: 0.01`, mock adapter that returns `cost: 0.004` per test. Verify no more than 2 tests complete (0.004 + 0.004 = 0.008, third would exceed 0.01 + one reservation).

---

### Pitfall 3: Worktree File Copy — Symlinks, Missing Files, Circular Paths

**What goes wrong:** Copying the config and referenced files into the git worktree before running tests. The worktree is created at `.kindlm/worktrees/<slug>` (worktree.ts:143). Referenced files (JSON schema files, baseline files) may be symlinks, may not exist, or may reference paths outside the repo root — and `fs.copyFile` silently follows symlinks, potentially copying their targets outside the intended sandbox.

**Why it happens:**
1. `parseConfig` resolves `schemaFile` paths relative to `configDir`. If `schemaFile` is `../../shared/schema.json`, the resolved path escapes the repo root. Copying it into the worktree requires reproducing the relative structure — or the path breaks.
2. Symlinks: `fs.copyFile` copies the link target's content, not the link itself. For a symlink pointing outside the repo, this silently exfiltrates data from outside the project boundary and the worktree path breaks anyway when the symlink target is absent.
3. Files that don't exist at copy time (e.g., baseline files that haven't been created yet) cause `ENOENT` — these must be treated as optional, not fatal.
4. A config that references itself (circular `extends` or future self-referential features) can create infinite copy loops if not detected.

**Prevention:**
- Resolve all referenced paths to absolute form and verify each stays within `configDir` before copying. Reject paths that escape with a clear error (path traversal guard).
- Use `fs.lstat` before copy; if entry is a symlink, resolve with `fs.realpath` and verify the real path is within the allowed boundary. Copy the resolved target, not the symlink.
- Treat missing baseline files as non-fatal (skip copy, do not abort).
- Maintain a `Set<string>` of already-copied paths to prevent circular reference loops.
- This logic lives in CLI (`utils/worktree-copy.ts`) — it is I/O-heavy and must not enter `@kindlm/core`.

**Detection:** Test cases: (a) symlink pointing outside repo root → expect `WorktreeError`; (b) missing baseline file → expect no error, file absent in destination; (c) `schemaFile: "../../outside.json"` → expect `WorktreeError`.

---

## Moderate Pitfalls

### Pitfall 4: Mocking `ora` with `vi.mock()` in ESM

**What goes wrong:** `ora` is a pure-ESM package (`"type": "module"`, no CJS export). In Vitest ESM mode, `vi.mock("ora")` hoisting works correctly only if the mock factory is in the same file as the `import`. If `spinner.ts` wraps `ora` and a test mocks it at the `ora` module boundary, the hoisted mock may not intercept the import that already resolved in `spinner.ts`'s module scope.

**Why it happens:** ESM module evaluation is static and sealed at link time. `vi.mock()` is hoisted to the top of the test file, but if `spinner.ts` is evaluated before the mock is registered (e.g., via a transitive import chain), the real `ora` is bound. Vitest's `vi.mock()` uses a module registry intercept that works if — and only if — the mock is declared in the file that imports the module under test.

**Prevention:**
- Mock at the boundary closest to the test. In tests for `spinner.ts`, use `vi.mock("ora", () => ({ default: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() })) }))` at the top of the test file.
- For tests of `run-tests.ts` (which calls `createSpinner`), mock `../utils/spinner.js` (the wrapper module), not `ora` directly. This is more stable because it does not depend on ESM link-time resolution order.
- Do not mock `ora` in a shared `__mocks__` file — Vitest auto-mock + ESM can produce stale module instances across test files.

**Detection:** Run `vitest run --reporter verbose` on the spinner test file. If `ora` calls are not intercepted, the real spinner writes to stdout and the mock call counts remain at 0.

---

### Pitfall 5: `--concurrency` and `--timeout` Accepting Zero or Negative Values

**What goes wrong:** `run-tests.ts` already validates `--runs` (must be `>= 1`) and `--gate` (must be `0-100`). If `--concurrency 0` or `--timeout -1` are added without equivalent guards, downstream behavior is undefined. `concurrency: 0` in the runner likely produces a divide-by-zero or hangs waiting for a semaphore that never releases. `timeoutMs: -1` may silently disable timeouts (depends on runner implementation).

**Why it happens:** Commander parses options as strings by default; `.option("--concurrency <n>", ..., parseInt)` passes `NaN` for non-numeric input without error. `parseInt("0")` is a valid parse that passes `isNaN` checks.

**Prevention:**
- Follow the existing pattern in `run-tests.ts:129-133`. For concurrency: `if (!Number.isInteger(n) || n < 1) → exit(1)`.
- For timeout: `if (!Number.isInteger(n) || n < 100) → exit(1)`. A 100ms floor is reasonable; 0 or negative is never valid in production usage.
- Add a maximum sanity cap: `concurrency > 64` or `timeoutMs > 600_000` should warn (not error), matching the existing `--gate` decimal warning pattern.

**Detection:** `kindlm test --concurrency 0` should exit 1 with a clear error. `kindlm test --timeout -1` same.

---

### Pitfall 6: Floating-Point Accumulation in Cost Gating

**What goes wrong:** Accumulating USD costs as JavaScript `number` floats. `0.1 + 0.2 !== 0.3`. Over many test runs, accumulated cost diverges from the true sum.

**Why it happens:** `estimateCost` returns `number | null`. Summing 100 costs of `$0.001` can produce `0.09999999999999...` instead of `0.1`, causing the gate to pass when it should have fired.

**Prevention:** Accumulate costs in integer microdollars (`Math.round(cost * 1_000_000)`) and compare thresholds in microdollars. Convert back to USD for display only. Alternatively, use `Number.EPSILON`-tolerant comparison: `accruedCost >= maxCost - 1e-9`.

**Detection:** Unit test: sum 100 × `estimateCost` of `0.001` and assert the sum is within `1e-9` of `0.1`.

---

## Minor Pitfalls

### Pitfall 7: Zero-I/O Constraint Split Between Core and CLI

**What goes wrong:** Features that feel like "test logic" get implemented in CLI, breaking the core/CLI boundary; or features that need I/O (file read, process.env) get placed in core, violating the zero-I/O constraint.

**Boundary for each v2.1.0 feature:**

| Feature | Belongs in core | Belongs in CLI |
|---------|----------------|----------------|
| `betaJudge` multi-pass loop + median math | Yes | No |
| `betaJudge` config field in Zod schema | Yes | No |
| Cost accumulation + gate logic | Yes (runner) | Override parsing |
| File copy to worktree | No | Yes (`worktree-copy.ts`) |
| Path traversal guard for file copy | No | Yes |
| `--concurrency` / `--timeout` override parsing + validation | No | Yes (`run-tests.ts`) |
| Applying overrides to `config.defaults` | CLI (already done for `--runs`, `--gate`) | — |

**Prevention:** Before implementing, ask: "Does this code call `fs`, `process.env`, `fetch`, or `console`?" If yes → CLI. If it's pure computation on `KindLMConfig` or `ProviderResponse` data → core.

---

### Pitfall 8: `createWorktree` Creates Detached HEAD — Config Paths Differ

**What goes wrong:** `createWorktree` adds a detached-HEAD worktree at `.kindlm/worktrees/<slug>`. When the test runner is invoked inside the worktree, `configPath` is resolved relative to `process.cwd()`, which is now the worktree root, not the original repo root. Any path in `kindlm.yaml` that was relative to the original directory (`../fixtures/schema.json`) becomes invalid.

**Why it happens:** The worktree copy step (Pitfall 3) must reproduce the full relative path structure. If it only copies `kindlm.yaml` to the worktree root without copying referenced files to their expected relative locations, every `schemaFile`, baseline path, and JSON schema reference breaks silently (AJV schema loads fail with `ENOENT`).

**Prevention:** When copying files into the worktree, preserve their paths relative to `configDir`. A file at `configDir/schemas/output.json` must land at `worktreeRoot/schemas/output.json`.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| `betaJudge` multi-pass loop | Partial failure median poisoning (Pitfall 1) | Separate infra errors from low scores before median |
| `betaJudge` config schema addition | Zod union placement — new field must not conflict with existing `judge[]` array items | Add as sibling field to `JudgeAssertionConfig`, not inside it |
| Cost gating concurrent tests | TOCTOU race (Pitfall 2) | Reserve estimated cost before await |
| Cost gating float math | Accumulated float drift (Pitfall 6) | Use microdollar integers internally |
| `--isolate` file copy | Symlinks + missing files + path escape (Pitfall 3) | `lstat` + realpath + boundary check per file |
| `--isolate` path resolution | Config paths break in worktree (Pitfall 8) | Preserve relative structure during copy |
| ora unit tests | ESM mock hoisting (Pitfall 4) | Mock `spinner.ts` wrapper, not `ora` directly |
| `--concurrency`/`--timeout` parsing | Zero/negative values (Pitfall 5) | Follow existing `--runs` guard pattern in `run-tests.ts` |
| Any new feature | Zero-I/O boundary violation (Pitfall 7) | I/O check before placing code in core vs CLI |

---

## Sources

- Codebase: `/Users/petr/projects/kindlm/packages/core/src/assertions/judge.ts` (single-pass judge implementation)
- Codebase: `/Users/petr/projects/kindlm/packages/cli/src/utils/run-tests.ts` (override validation patterns, concurrency model)
- Codebase: `/Users/petr/projects/kindlm/packages/cli/src/utils/worktree.ts` (worktree creation, detached HEAD, path construction)
- Codebase: `/Users/petr/projects/kindlm/packages/cli/src/utils/caching-adapter.ts` (adapter wrapping pattern)
- Vitest ESM mocking: https://vitest.dev/guide/mocking.html#mocking-es-modules (HIGH confidence — verified against Vitest docs)
- ora ESM-only package: https://github.com/sindresorhus/ora (pure ESM since v6, confirmed in package.json `"type": "module"`) (HIGH confidence)
