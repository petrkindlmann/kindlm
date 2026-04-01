---
phase: 07-betajudge-multi-pass-scoring
plan: "01"
subsystem: core-assertions, cli-wiring
tags: [judge, betaJudge, multi-pass, median-scoring, feature-flag]
dependency_graph:
  requires: [FF-01, feature-flags-infrastructure]
  provides: [JUDGE-01]
  affects: [packages/core/src/assertions/judge.ts, packages/core/src/engine/runner.ts, packages/cli/src/utils/run-tests.ts]
tech_stack:
  added: []
  patterns: [multi-pass-median-scoring, quorum-guard, betaJudge-gating]
key_files:
  created: []
  modified:
    - packages/core/src/assertions/interface.ts
    - packages/core/src/assertions/judge.ts
    - packages/core/src/assertions/judge.test.ts
    - packages/core/src/engine/runner.ts
    - packages/cli/src/utils/run-tests.ts
decisions:
  - "betaJudge multi-pass uses ceil(N/2)=2 quorum: prevents poisoned median from transient API failures"
  - "Median index: Math.floor(scores.length/2) on sorted array — deterministic for both even and odd successful-pass counts"
  - "Early return from betaJudge block preserves single-pass code path entirely unchanged"
metrics:
  duration: 3min
  completed_date: "2026-04-01"
  tasks: 2
  files_modified: 5
---

# Phase 07 Plan 01: betaJudge Multi-Pass Scoring Summary

3-pass median judge scoring gated behind the `betaJudge` feature flag — judge runs 3 times when enabled, median of successful passes returned, JUDGE_EVAL_ERROR if fewer than 2 passes succeed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add betaJudge to interfaces and implement multi-pass judge logic | 8eeaefa | interface.ts, judge.ts, judge.test.ts, runner.ts |
| 2 | Wire betaJudge feature flag from CLI to runner | 1cba673 | run-tests.ts |

## What Was Built

### AssertionContext.betaJudge (interface.ts)
Added `betaJudge?: boolean` as the last field of `AssertionContext`. Optional — absent is equivalent to `false`.

### RunnerDeps.betaJudge (runner.ts)
Added `betaJudge?: boolean` to `RunnerDeps`. Threaded into `AssertionContext` in both `buildAssertionContext` (prompt-based tests) and `executeCommandUnit` (command-based tests).

### Multi-pass judge logic (judge.ts)
When `context.betaJudge === true`, the `evaluate` method runs 3 judge passes in a loop, collecting `PassResult` values. Parse errors and adapter throws are captured as failed passes. If `successfulPasses.length < 2` (quorum = `ceil(3/2)`), returns `JUDGE_EVAL_ERROR` with a message like "betaJudge: only 1/3 passes succeeded (need 2)". Otherwise, sorts successful scores numerically and takes `scores[Math.floor(scores.length / 2)]` as the median. The single-pass code path (lines below the `if (context.betaJudge)` block) is entirely unchanged — the betaJudge block returns early.

### CLI wiring (run-tests.ts)
Added `betaJudge: isEnabled(featureFlags, "betaJudge")` to the `createRunner` deps object. `isEnabled` and `featureFlags` were already present from Phase 6.

## Tests Added

9 new tests in `describe("betaJudge multi-pass scoring")`:
1. Passes with median of 3 scores above threshold
2. Fails with median of 3 scores below threshold (failureCode JUDGE_BELOW_THRESHOLD)
3. Uses median of 2 valid scores when 1/3 passes throws
4. Returns JUDGE_EVAL_ERROR when only 1/3 passes succeed
5. Returns JUDGE_EVAL_ERROR when all 3 passes fail
6. Uses median of 2 valid scores when 1/3 returns parse error
7. Includes betaJudge metadata (passes, successful, scores array)
8. Calls adapter.complete exactly 3 times when betaJudge=true
9. Calls adapter.complete exactly 1 time when betaJudge=false

All 131 tests pass (108 pre-existing + 23 CLI + 9 new betaJudge = adjusted total across worktree).

## Deviations from Plan

None — plan executed exactly as written. The core build step was required before the CLI type check would resolve the new `betaJudge` field in `RunnerDeps` (workspace linking resolves through built dist files).

## Self-Check: PASSED

Files verified:
- `packages/core/src/assertions/interface.ts` — contains `betaJudge?: boolean`
- `packages/core/src/assertions/judge.ts` — contains `if (context.betaJudge)`, `const PASSES = 3`, `const MIN_QUORUM = Math.ceil(PASSES / 2)`, `.sort((a, b) => a - b)`, `scores[Math.floor(scores.length / 2)]`, `FailureCode` in import
- `packages/core/src/engine/runner.ts` — RunnerDeps contains `betaJudge?: boolean`, buildAssertionContext contains `betaJudge: deps.betaJudge`
- `packages/cli/src/utils/run-tests.ts` — contains `betaJudge: isEnabled(featureFlags, "betaJudge")`
- `packages/core/src/assertions/judge.test.ts` — contains `describe("betaJudge multi-pass scoring"`, 9 test cases

Commits verified:
- 8eeaefa: feat(07-01): add betaJudge field to interfaces and implement multi-pass judge scoring
- 1cba673: feat(07-01): wire betaJudge feature flag from CLI to runner
