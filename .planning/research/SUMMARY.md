# Project Research Summary

**Project:** KindLM v2.1.0 Gap Closure
**Domain:** AI agent behavioral testing CLI — gap-closure milestone
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

KindLM v2.1.0 is a gap-closure milestone: five targeted improvements to an already-shipped v1.0 codebase. All five features (multi-pass judge scoring, pre-emptive cost budget enforcement, worktree filesystem isolation fix, CLI utility unit tests, and `--concurrency`/`--timeout` flag overrides) are implementable with the existing stack — no new npm packages required. The existing architecture already contains the correct integration points; the work is wiring feature flags to existing logic and closing three specific gaps in judge variance, cost enforcement, and worktree isolation.

The recommended approach is to sequence work by dependency and risk. Cost gating is the simplest: the runner already implements it, the only gap is the feature-flag wiring in `run-tests.ts`. CLI overrides follow the same established pattern as `--runs` and `--gate`. The worktree file-copy fix (ISOLATE-01) is the riskiest: it involves I/O, path resolution across boundaries, and symlink handling that can silently fail. Multi-pass judge scoring is medium complexity — the math is trivial but partial-failure handling requires careful design to avoid median poisoning from infrastructure errors.

The primary risk across all features is architectural boundary discipline: the zero-I/O constraint on `@kindlm/core` is load-bearing. File I/O (worktree copy, path traversal guard) and CLI flag parsing must stay in the CLI layer. Multi-pass judge logic and cost accumulation math belong in core. Violating this boundary during implementation is the most likely source of subtle bugs and reviewer rejection.

## Key Findings

### Recommended Stack

No new dependencies are needed for any v2.1.0 feature. The existing stack handles every requirement: `vi.mock()` with Vitest 3.2.4 handles ESM mocking for `ora`; `node:fs/promises` (already used in CLI) handles the worktree file copy; `commander` (already declared) handles the new CLI flags; the inline `median()` function is 4 lines of TypeScript.

**Core technologies (unchanged):**
- TypeScript 5.7.0 strict/ESM — all new code follows existing conventions
- Vitest 3.2.4 — `vi.mock()`, `vi.spyOn()` cover all test utility mocking needs
- commander ^13.0.0 — `.option()` pattern handles `--concurrency` and `--timeout`
- `node:fs/promises` built-in — `copyFile` + `mkdir` for ISOLATE-01
- `node:path` built-in — path resolution for worktree copy boundary checks

### Expected Features

All five features are table stakes for the v2.1.0 milestone. None should be deferred.

**Must implement (all are in-scope for v2.1.0):**
- `betaJudge` multi-pass judge scoring — reduces LLM judge variance; 3-pass median is the research-backed default
- `costGating` flag wiring — the runner already enforces budgets; just wire the feature flag correctly
- ISOLATE-01 worktree file copy — `--isolate` is broken without this; schema files referenced in YAML do not exist in the bare worktree
- Unit tests for `dry-run.ts`, `select-reporter.ts`, `spinner.ts` — coverage gap, all testable with standard patterns
- `--concurrency` and `--timeout` CLI overrides — follows established `--runs`/`--gate` override pattern exactly

**Anti-features to avoid:**
- Temperature > 0 for multi-pass judge (defeats caching; temperature=0 already produces variance across real backends)
- Cancelling in-flight tasks when cost budget is exceeded (bounded overshoot at concurrency-1 is the acceptable trade-off)
- Recursive `$ref` scanning for ISOLATE-01 (single-level directory copy covers 99% of real usage; document the limitation)
- `--timeout` retroactively affecting provider HTTP timeout (provider adapter is initialized before runner; out of scope for v2.1.0)

**Defer to v2.2+:**
- Hard `AbortSignal` cancellation of in-flight provider calls on budget exceeded
- `defaults.providerTimeoutMs` as a separate field from `defaults.timeoutMs`
- Recursive `$ref` resolution in worktree copy

### Architecture Approach

All five features follow the existing two-layer pattern: pure logic belongs in `@kindlm/core`, I/O and flag parsing belong in `@kindlm/cli`. The correct integration points are already identified from direct source reading. No new files are needed except `cli/src/utils/worktree-copy.ts` (ISOLATE-01 file copy helper). No changes to `@kindlm/cloud`, `@kindlm/dashboard`, or `packages/vscode` are required.

**Integration points per feature:**

1. `betaJudge` — `core/src/assertions/judge.ts` (multi-pass loop), `core/src/assertions/registry.ts` (judgePassCount override), `cli/src/utils/run-tests.ts` (flag → override wiring)
2. `costGating` — `cli/src/utils/run-tests.ts` only (strip `costMaxUsd` when flag is off; runner already handles the rest)
3. ISOLATE-01 — new `cli/src/utils/worktree-copy.ts` + call site in `cli/src/commands/test.ts` between `createWorktree()` and `runTests()`
4. `--concurrency`/`--timeout` — `cli/src/commands/test.ts` (Commander flags), `cli/src/utils/run-tests.ts` (override block, follows existing `--runs` pattern)
5. Unit tests — colocated `*.test.ts` files in `cli/src/utils/`

**Data flow through the stack:**
```
test.ts (Commander parse)
  → runTests(options)
    → runTestsInner(options, spinner)
      → parseConfig()
      → [apply CLI overrides: runs, gate, concurrency, timeout]
      → [strip costMaxUsd if !costGating flag]
      → [set judgePassCount override if betaJudge flag]
      → adapter.initialize({ timeoutMs: config.defaults.timeoutMs })
      → createRunner(config, deps)
        → runWithConcurrency(units, config.defaults.concurrency)
          → executeUnit() → runAssertions() → createJudgeAssertion(passes)
```

### Critical Pitfalls

1. **Multi-pass judge median poisoning** — Infrastructure failures (provider rate-limit, parse error) return score=0 in the current `createJudgeAssertion`. Including these in the median silently skews results. Prevention: distinguish `JUDGE_EVAL_ERROR` results from genuine low-score results before computing the median. Require `ceil(N/2)` successful passes minimum; otherwise return `JUDGE_EVAL_ERROR`.

2. **Worktree file copy: symlinks, path escape, missing files** — `fs.copyFile` silently follows symlinks and can copy targets outside the repo root. `schemaFile: "../../shared/schema.json"` resolves outside `configDir`. Missing baseline files cause fatal `ENOENT`. Prevention: `lstat` + `realpath` + boundary check per file; treat missing optional files as non-fatal; use a `Set` to prevent circular copy loops.

3. **Cost gating TOCTOU race** — Under concurrency > 1, multiple tests can both read "under budget" and both launch before either updates the counter. Prevention: reserve estimated cost synchronously before the async `complete()` call; gate on `accrued + reserved < max`. `estimateCost()` is already available on every provider adapter.

4. **ESM mock hoisting for `ora`** — `ora` is pure ESM. In tests for modules that use `ora` transitively, `vi.mock("ora")` may bind to an already-evaluated module instance. Prevention: mock the `spinner.ts` wrapper module (`vi.mock("../utils/spinner.js")`) in tests for callers; mock `ora` directly only in `spinner.test.ts`.

5. **Zero/negative CLI flag values** — `parseInt("0")` passes `isNaN` checks. `concurrency: 0` hangs the runner. Prevention: follow the existing guard pattern from `--runs` validation in `run-tests.ts`: `if (!Number.isInteger(n) || n < 1) → exit(1)`.

6. **Floating-point cost accumulation drift** — Summing many small USD values via JS `number` produces drift (`0.001 × 100 !== 0.1`). Prevention: accumulate in integer microdollars (`Math.round(cost * 1_000_000)`) and compare in microdollars; convert back to USD for display only.

## Implications for Roadmap

Based on research, suggested phase structure for v2.1.0:

### Phase 1: Cost Gating Flag Wiring + CLI Overrides
**Rationale:** Both are pure CLI-layer changes with no core modifications needed. Cost gating just removes a field from config when the flag is off. CLI overrides follow the identical pattern as already-implemented `--runs` and `--gate`. Lowest risk, high confidence, establishes momentum.
**Delivers:** Working `costGating` feature flag, `--concurrency` and `--timeout` flags available in all test runs.
**Addresses:** costGating wiring gap, CLI override feature gap.
**Avoids:** TOCTOU race (Pitfall 2) — use microdollar accumulation from the start; input validation (Pitfall 5) — apply `>= 1` guard immediately.
**Research flag:** Standard patterns — no additional research needed.

### Phase 2: Multi-Pass Judge Scoring (`betaJudge`)
**Rationale:** Self-contained within `@kindlm/core`. Requires schema change (add `passes` field to `JudgeAssertionConfig`), loop logic in `judge.ts`, and flag wiring in `run-tests.ts`. No I/O. Medium complexity due to partial-failure handling design.
**Delivers:** `betaJudge` flag activates 3-pass median scoring; single-pass path unchanged when flag is off.
**Addresses:** LLM judge variance reduction for CI-grade reliability.
**Avoids:** Median poisoning (Pitfall 1) — separate infrastructure errors from genuine scores before median; zero-I/O boundary (Pitfall 7) — all multi-pass math in core.
**Research flag:** Standard patterns — research already verified against SE-Jury paper and Vitest docs. No additional research needed.

### Phase 3: Worktree File Copy (ISOLATE-01)
**Rationale:** Highest complexity and risk of the five features. Requires new CLI utility file, I/O with multiple failure modes (symlinks, path escape, missing files), and strict path-preservation logic. Sequenced last among functional features so earlier phases are stable before the riskiest change lands.
**Delivers:** `--isolate` correctly copies `kindlm.yaml` and all referenced schema files into the git worktree, making filesystem isolation complete.
**Addresses:** ISOLATE-01 gap (worktree has git isolation but not filesystem isolation for referenced files).
**Avoids:** Symlink/path escape (Pitfall 3) — `lstat` + `realpath` + boundary guard; path structure preservation (Pitfall 8) — preserve relative paths from `configDir`.
**Research flag:** Needs care during implementation — the `$ref` sibling-copy limitation should be documented explicitly as a known gap.

### Phase 4: CLI Utility Unit Tests
**Rationale:** Sequenced after functional features so tests cover the final implementations. Tests for `dry-run.ts` (pure function), `select-reporter.ts` (process.exit mock), and `spinner.ts` (ora ESM mock) are independent of each other and of the functional changes.
**Delivers:** Coverage for three previously-untested CLI utilities.
**Addresses:** Test coverage gap.
**Avoids:** ESM mock hoisting (Pitfall 4) — mock `spinner.ts` wrapper in caller tests, mock `ora` directly in `spinner.test.ts` only.
**Research flag:** Standard patterns — Vitest mocking docs verified, existing `run-tests.test.ts` demonstrates the ora mock pattern already.

### Phase Ordering Rationale

- Cost gating and CLI overrides come first because they are pure CLI mutations with no core changes and no new files — lowest risk entry point.
- Multi-pass judge comes second because it touches core but has no I/O and the math is well-defined; getting it right before worktree work reduces the surface area of concurrent changes.
- ISOLATE-01 comes third because it is the only feature requiring a new file and careful I/O handling; doing it after the other features are stable limits blast radius.
- Unit tests come last so they test the final implementations, not intermediate states.

### Research Flags

Phases with standard patterns (skip additional research-phase):
- **All phases:** All patterns verified from direct codebase reading and official Vitest/Node.js docs. Confidence is HIGH across all four research files. No phase requires a `gsd:research-phase` invocation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions from existing package.json + official Vitest/Node.js docs; no inference required |
| Features | HIGH | Features defined from codebase gap analysis + external academic sources for judge multi-pass |
| Architecture | HIGH | All integration points verified from direct source reading of the actual files with line numbers |
| Pitfalls | HIGH | Critical pitfalls grounded in codebase patterns (existing validation guards) and documented ESM behavior |

**Overall confidence:** HIGH

### Gaps to Address

- **ISOLATE-01 `$ref` sibling handling:** Single-level directory copy is the v2.1.0 approach. If a schema uses `$ref` to a file in a different directory, that file will be missing in the worktree. Document this as a known limitation in `--isolate` help text.
- **`--timeout` scope:** `config.defaults.timeoutMs` affects command test execution timeout but not provider adapter HTTP timeout (which is set at init time). Document explicitly in CLI help text that `--timeout` controls test execution timeout, not provider request timeout.
- **`betaJudge` minimum pass count:** The threshold for "enough successful passes to compute a valid median" is `ceil(N/2)`. This should be validated with at least one adversarial test case (all passes fail, exactly `ceil(N/2)` passes succeed).

## Sources

### Primary (HIGH confidence)
- Direct source reading: `packages/core/src/assertions/judge.ts`, `packages/core/src/engine/runner.ts`, `packages/cli/src/utils/run-tests.ts`, `packages/cli/src/utils/worktree.ts`, `packages/cli/src/utils/features.ts`
- Vitest ESM mocking docs: https://vitest.dev/guide/mocking.html
- Node.js `fs/promises` API: https://nodejs.org/api/fs.html#promises-api

### Secondary (MEDIUM confidence)
- SE-Jury paper (ASE 2025): https://arxiv.org/html/2505.20854v2 — 3-pass median recommendation
- LLMs-as-Judges survey (arXiv 2412.05579): https://arxiv.org/html/2412.05579v2 — variance reduction at N=3
- ora v8 ESM-only: https://github.com/sindresorhus/ora — `vi.mock` ESM default import pattern

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
