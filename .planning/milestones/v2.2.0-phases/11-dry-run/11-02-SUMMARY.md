---
phase: 11-dry-run
plan: 02
subsystem: cli
tags: [dry-run, cost-estimation, chalk, vitest]

requires:
  - phase: 11-01
    provides: estimatedCostUsd and totalEstimatedCostUsd fields on TestPlanEntry/TestPlan

provides:
  - formatTestPlan renders per-entry cost label (~$X.XXXXXX or ~$?)
  - formatTestPlan shows "Estimated cost" summary line in plan totals
  - 5 new unit tests covering all cost display cases

affects: [cli, dry-run, reporters]

tech-stack:
  added: []
  patterns:
    - "toFixed(6) for cost display — consistent 6-decimal format across all cost values"
    - "costLabel gated on isCommand — command entries never show cost suffix"

key-files:
  created: []
  modified:
    - packages/cli/src/utils/dry-run.ts
    - packages/cli/src/utils/dry-run.test.ts

key-decisions:
  - "toFixed(6) for both per-entry and total cost — consistent, readable, avoids toPrecision edge cases"
  - "Command entries show no cost suffix — shell commands have no provider cost"

patterns-established:
  - "TDD: failing tests committed before implementation (RED → GREEN)"

requirements-completed:
  - DRY-01
  - DRY-02
  - DRY-03
  - DRY-04
  - DRY-05

duration: 10min
completed: 2026-04-02
---

# Phase 11 Plan 02: Dry-Run Cost Output Summary

**formatTestPlan wired to display per-entry ~$X.XXXXXX cost and total Estimated cost summary, completing all five DRY requirements**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-02T10:50:00Z
- **Completed:** 2026-04-02T10:52:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `costLabel` to each active non-command entry in `formatTestPlan` — shows `~$0.000010` when priced or `~$?` when null
- Added "Estimated cost" summary line after "Total execution units" — shows `~$X.XXXXXX` or `unknown (model pricing not found)` when null
- 5 new unit tests cover all cost display scenarios; full suite 274 passing, 0 failures

## Task Commits

1. **Task 1: Add cost display to formatTestPlan** - `bb3c516` (feat)

Task 2 was verification-only (no file changes).

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `packages/cli/src/utils/dry-run.ts` — Added costLabel per entry and Estimated cost summary line
- `packages/cli/src/utils/dry-run.test.ts` — Added 5 failing tests (RED), then all pass (GREEN)

## Decisions Made

- Used `toFixed(6)` for all cost values — consistent 6-decimal format, simpler than toPrecision branching
- Command entries emit no cost suffix — they have no provider pricing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five DRY requirements (DRY-01 through DRY-05) are now implemented and verified
- Phase 11 dry-run is complete
- TypeScript clean, 274 tests passing

---
*Phase: 11-dry-run*
*Completed: 2026-04-02*
