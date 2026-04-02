---
phase: 11-dry-run
plan: "01"
subsystem: testing
tags: [pricing, dry-run, cost-estimation, core]

requires:
  - phase: 10-reporter-output-gate-integrity
    provides: test-plan types used by dry-run formatter

provides:
  - KINDLM_PRICING consolidated table in pricing.ts (all providers)
  - estimateDryRunCost(modelId, maxTokens, repeat) helper in pricing.ts
  - TestPlanEntry.estimatedCostUsd field
  - TestPlan.totalEstimatedCostUsd field
  - buildTestPlan populates per-entry cost and plan total

affects: [dry-run, 11-dry-run]

tech-stack:
  added: []
  patterns:
    - "Cost estimation uses output price as proxy since token split unknown pre-run"
    - "KINDLM_PRICING is a read-only consolidated table; per-adapter tables unchanged"

key-files:
  created:
    - packages/core/src/providers/pricing.test.ts (extended with KINDLM_PRICING + estimateDryRunCost tests)
  modified:
    - packages/core/src/providers/pricing.ts
    - packages/core/src/engine/test-plan.ts
    - packages/core/src/engine/test-plan.test.ts
    - packages/cli/src/utils/dry-run.test.ts

key-decisions:
  - "Output price used as proxy for dry-run cost (input token count unknown pre-run)"
  - "KINDLM_PRICING is a separate export — per-adapter private tables left unchanged"
  - "totalEstimatedCostUsd is null only when ALL entries have null cost (all commands/skipped)"

patterns-established:
  - "estimateDryRunCost: null for unknown model or command entry; never throws"

requirements-completed:
  - DRY-04

duration: 8min
completed: 2026-04-02
---

# Phase 11 Plan 01: Dry-Run Cost Estimation Summary

**KINDLM_PRICING consolidated table and estimateDryRunCost helper wired into buildTestPlan so each TestPlanEntry carries per-entry cost and TestPlan carries a total**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-02T08:46:00Z
- **Completed:** 2026-04-02T08:49:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Exported `KINDLM_PRICING` combining OpenAI, Anthropic, and Gemini pricing into one lookup table
- Exported `estimateDryRunCost(modelId, maxTokens, repeat)` with null-safe behavior for unknown models and command entries
- Added `estimatedCostUsd: number | null` to `TestPlanEntry` and `totalEstimatedCostUsd: number | null` to `TestPlan`
- `buildTestPlan` now uses `maxTokens` from model params (fallback 1024) to compute per-entry cost

## Task Commits

1. **Task 1: Add KINDLM_PRICING and estimateDryRunCost to pricing.ts** - `853d0dd` (feat)
2. **Task 2: Add cost fields to TestPlanEntry/TestPlan and populate in buildTestPlan** - `7f2636f` (feat)

## Files Created/Modified

- `packages/core/src/providers/pricing.ts` - Added KINDLM_PRICING table + estimateDryRunCost export
- `packages/core/src/providers/pricing.test.ts` - Extended with 9 new tests for new exports (16 total)
- `packages/core/src/engine/test-plan.ts` - Added cost fields to interfaces; buildTestPlan populates them
- `packages/core/src/engine/test-plan.test.ts` - 6 new cost estimation tests (14 total)
- `packages/cli/src/utils/dry-run.test.ts` - Updated factory helpers to include new required fields

## Decisions Made

- Output price used as proxy for dry-run cost estimation — input token count is unknown pre-execution
- `KINDLM_PRICING` is a separate export; per-adapter private tables (`OPENAI_PRICING`, `ANTHROPIC_PRICING`, `GEMINI_PRICING`) left unchanged to avoid coupling
- `totalEstimatedCostUsd` is `null` only if every entry is null (all commands or all skipped); partial null entries contribute 0 to sum via non-null filter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected cost formula examples in test expectations**
- **Found during:** Task 1 (RED tests)
- **Issue:** Plan documentation stated `(1024/1_000_000) * 10.0 * 1 = 0.00001024` but the correct result is `0.01024` (off by 1000x — plan had a typo treating the divisor as 1_000_000_000 not 1_000_000)
- **Fix:** Test expectations corrected to `0.01024` and `0.03072`; formula itself is correct
- **Files modified:** `packages/core/src/providers/pricing.test.ts`
- **Verification:** All 16 pricing tests pass with corrected expected values
- **Committed in:** `853d0dd`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in test expected values from plan typo)
**Impact on plan:** No scope change. Fix was essential for correct test behavior.

## Issues Encountered

- CLI `dry-run.test.ts` factory helpers (`makeEntry`, `makePlan`) didn't include new required fields — caused typecheck failure. Fixed inline as part of Task 2 commit (Rule 3 - Blocking).

## Next Phase Readiness

- `TestPlanEntry.estimatedCostUsd` and `TestPlan.totalEstimatedCostUsd` are populated and ready for the dry-run formatter (plan 11-02) to display
- DRY-04 requirement satisfied

---
*Phase: 11-dry-run*
*Completed: 2026-04-02*
