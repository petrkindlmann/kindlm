---
phase: 10-reporter-output-gate-integrity
plan: "02"
subsystem: core/engine + core/reporters
tags: [gate-evaluation, pretty-reporter, ux, correctness]
dependency_graph:
  requires: [10-01]
  provides: [GATE-01, GATE-02, GATE-03]
  affects: [packages/core/src/engine/gate.ts, packages/core/src/reporters/pretty.ts]
tech_stack:
  added: []
  patterns: [optional-flag-on-result-type, two-phase-tdd]
key_files:
  created: []
  modified:
    - packages/core/src/engine/gate.ts
    - packages/core/src/engine/gate.test.ts
    - packages/core/src/reporters/pretty.ts
    - packages/core/src/reporters/pretty.test.ts
decisions:
  - "D-08: Empty-data gates still pass — vacuous pass is not a failure, just a signal"
  - "computeCategoryPassRate refactored to return { rate, empty } tuple rather than a raw number to surface emptiness without a separate counting pass"
metrics:
  duration: ~8 minutes
  completed: 2026-04-02
  tasks_completed: 2
  files_modified: 4
---

# Phase 10 Plan 02: Empty-Data Gate Warning Summary

One-liner: `emptyData?: true` flag on GateResult + yellow ⚠ icon in pretty reporter for the four gates that trivially pass when no matching assertions are present.

## What Was Built

Two tasks, TDD approach for Task 1:

**Task 1 (gate.ts + gate.test.ts):**
- Added `emptyData?: true` optional field to `GateResult` interface
- Four affected gates now detect and flag empty input collections:
  - `judgeAvgMin` — set when `collectScores(results, "judge")` returns empty array
  - `driftScoreMax` — set when `collectScores(results, "drift")` returns empty array
  - `deterministicPassRate` — set when no assertions classify as "deterministic"
  - `probabilisticPassRate` — set when no assertions classify as "probabilistic"
- Each flagged gate appends warning text to `message` field: `(no X assertions found — gate trivially passed)`
- `computeCategoryPassRate` refactored: now returns `{ rate: number; empty: boolean }` instead of bare `number`
- 7 new tests: 4 empty-data positive cases + 2 non-empty negative cases + 1 passRateMin never-emptyData case
- All 16 gate tests pass

**Task 2 (pretty.ts + pretty.test.ts):**
- Gate rendering loop updated: `gate.emptyData ? c.yellow("⚠") : gate.passed ? c.green("✓") : c.red("✗")`
- 3 new gate icon rendering tests: emptyData→⚠, passing→✓, failing→✗
- All 39 reporter tests pass; `tsc --noEmit` clean

## Commits

| Hash | Message |
|------|---------|
| 3a40f68 | feat(10-02): add emptyData flag to GateResult for trivially-passed gates |
| 56e70f7 | feat(10-02): render ⚠ warning icon for empty-data gates in pretty reporter |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `packages/core/src/engine/gate.ts` — exists, contains 4+ `emptyData` references
- `packages/core/src/reporters/pretty.ts` — exists, contains `emptyData` conditional + yellow ⚠
- `packages/core/src/engine/gate.test.ts` — exists, contains "trivially passed" test cases
- Commits 3a40f68 and 56e70f7 verified in git log
- All 16 gate tests pass, all 39 reporter tests pass, `tsc --noEmit` clean
