---
phase: 20-trajectory-metrics
plan: 02
subsystem: core/assertions
tags: [trajectory, assertions, config-schema, vertex-ai, tool-calls]
requires:
  - "20-01: createTrajectoryAssertion factory + 3 trajectory FailureCode literals"
provides:
  - "expect.trajectory config surface (precision/recall/exactMatch + ordered/matchArgs)"
  - "registry wiring: expect.trajectory -> createTrajectoryAssertion"
  - "public @kindlm/core export of createTrajectoryAssertion + TrajectoryConfig/TrajectoryAction"
affects:
  - "any kindlm.yaml suite that adds an expect.trajectory block"
tech-stack:
  added: []
  patterns: ["zod strict sub-schema + .refine", "factory wiring in createAssertionsFromExpect"]
key-files:
  created: []
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/schema.test.ts
    - packages/core/src/assertions/registry.ts
    - packages/core/src/assertions/registry.test.ts
    - packages/core/src/assertions/index.ts
decisions:
  - "Followed RESEARCH.md shape exactly: precision/recall as {minScore} objects, exactMatch/ordered/matchArgs booleans with Zod defaults, .refine requiring >=1 metric, reference .min(1).max(500)."
  - "Did NOT touch interface.ts — the 3 trajectory FailureCode literals are owned by 20-01."
metrics:
  duration: ~35m
  completed: 2026-05-30
---

# Phase 20 Plan 02: Wire Trajectory Metrics into Config + Registry Summary

Makes `expect.trajectory` a usable, strict-validated config surface: a kindlm.yaml test now parses a trajectory block, the registry builds the 20-01 assertion from it, and precision/recall/exact_match (incl. the ordered toggle) run end-to-end — completing TRAJ-01..04. Final plan of Phase 20.

## What Was Built

- **Schema (Task 1):** Added `TrajectoryActionSchema` (`tool`, `args` default `{}`, strict) and `TrajectoryExpectSchema` (`reference .min(1).max(500)`, `precision?`/`recall?` `{minScore}` objects, `exactMatch`/`ordered`/`matchArgs` booleans with defaults `false`/`true`/`true`, `.refine` requiring at least one metric), all `.strict()`. Declared `trajectory` as an optional key on the strict `ExpectSchema`; exported `TrajectoryExpect`/`TrajectoryActionConfig` types.
- **Registry (Task 2):** Added `if (expect.trajectory)` branch in `createAssertionsFromExpect` mapping reference actions to `{ tool, args: a.args ?? {} }` and forwarding precision/recall/exactMatch/ordered/matchArgs to `createTrajectoryAssertion`. Coexists with legacy `toolCalls`.
- **Barrel:** Exported `createTrajectoryAssertion` + `TrajectoryConfig`/`TrajectoryAction` from `assertions/index.ts`.

## TRAJ Criteria (config -> result, verified by registry.test.ts)

- TRAJ-01 precision: penalizes extra calls (0.5 on lookup+spam vs lookup+refund reference).
- TRAJ-02 recall: 0.5 when one of two reference steps missing.
- TRAJ-03 exact_match: ordered=true FAILS (score 0) on reordered calls.
- TRAJ-04 ordered toggle: ordered=false PASSES (score 1) on the same reorder.
- All three metric results emitted when all enabled; coexistence with `toolCalls` proven.

## Strict-Schema Acceptance (both hold)

- Existing valid non-trajectory config still round-trips under strict (GATING test passes; Phase 18.1 strict / unrecognized-key tests stay green).
- Trajectory config with precision/recall/exactMatch + ordered parses under strict (GATING test passes). Empty reference, no-metric, and unknown-key configs are correctly rejected.

## Deviations from Plan

None — implemented to RESEARCH.md shape. interface.ts was NOT re-touched (FailureCode literals owned by 20-01; confirmed via `git diff 856c467..HEAD` = exactly the 5 planned files, interface.ts absent).

## Verification (phase exit gates)

- `npm run typecheck` — 5/5 packages pass.
- `npm run test` — 5/5 package tasks green (turbo), 0 failures.
- `cd packages/core && npx vitest run` — 1037 passed / 86 files (up from 1021 baseline, +16 new).
- `npx eslint --quiet` on the 5 changed files — clean.

## Commits

- 9b3f7c5 feat(20-02): add TrajectoryExpectSchema to STRICT ExpectSchema
- 2066269 feat(20-02): wire trajectory metrics into config schema + assertion registry

## Self-Check: PASSED

- 5/5 modified files committed.
- Both commit SHAs (9b3f7c5, 2066269) exist on phase-20-trajectory-metrics.
- interface.ts NOT in the 20-02 diff (856c467..HEAD = exactly the 5 planned files).
