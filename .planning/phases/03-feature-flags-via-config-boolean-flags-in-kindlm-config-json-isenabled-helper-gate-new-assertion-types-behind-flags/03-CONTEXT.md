# Phase 3: Feature flags via config - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

CLI-layer feature flag system: read `.kindlm/config.json`, expose `isEnabled()`, gate `betaJudge` / `costGating` / `runArtifacts` flags in `run-tests.ts`. Core package must remain zero-I/O — flags are CLI-only.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Pre-written plan (03-01-PLAN.md) defines the exact implementation shape, file locations, and acceptance criteria.

</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- `packages/cli/src/utils/run-tests.ts` — primary integration point, receives new `featureFlags` field in options and result
- `packages/cli/src/commands/test.ts` — calls `runTestsInner`, will receive featureFlags in result
- `packages/cli/src/utils/artifacts.ts` — already written in phase 02, will be gated behind `runArtifacts` flag

</code_context>

<specifics>
## Specific Ideas

See 03-01-PLAN.md — full implementation spec already written. No deviations needed.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
