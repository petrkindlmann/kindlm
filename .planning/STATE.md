---
gsd_state_version: 1.0
milestone: v2.4.0
milestone_name: Rigor & Reach
status: Phase 20 COMPLETE (verified 4/4). 18.1→PR#8, 19→PR#9, 20→PR#10. Phase 21 next.
last_updated: "2026-05-30T14:45:00.000Z"
last_activity: 2026-05-30 — Phase 20 executed + verified (trajectory metrics, 2 plans, branch phase-20-trajectory-metrics)
progress:
  total_phases: 11
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 9
---

## Current Position

Phase: 20 (Trajectory Metrics) — ✅ COMPLETE (VERIFICATION status: passed, 4/4 criteria)
Plan: 2/2 plans executed (20-01, 20-02)
Status: Executed + verified on branch `phase-20-trajectory-metrics` (built on Phase 19). Phase 21 (Judge Rigor) is next — has RESEARCH.md, needs /gsd-plan-phase.
Last activity: 2026-05-30 — Phase 20 executed; all 4 TRAJ criteria verified TRUE end-to-end (core 1004 passed)

Progress: [███░░░░░░░] ~27% (3 of 11 phases this milestone)

**Next recommended run:** `/gsd-plan-phase 21` (Judge Rigor), or merge the open PR stack first

## Shipped / Merged
- **v2.3.1 PUBLISHED to npm** (2026-05-31): `@kindlm/core@2.3.1` + `@kindlm/cli@2.3.1`. Tags + GitHub Releases created. Published locally via `npm publish` with 2FA OTP (CI NPM_TOKEN secret is expired — see Blockers).
- All feature work merged to `main` (HEAD c792865): PR #8 (18.1 false-green bugfixes), #9 (Phase 19), #12 (Phase 20; #10 auto-closed when its stacked base was deleted, re-opened as #12), #11 (version-packages bump). Feature branches deleted.

## Blockers/Concerns
- ⚠️ **CI Release workflow is broken**: repo secret `NPM_TOKEN` (dated 2026-03-28) is expired/non-automation → Release run 26705226733 failed with E404. Also, the npm account requires 2FA on publish (EOTP). Fix before next release: set a fresh **Automation** token via `gh secret set NPM_TOKEN` (automation tokens bypass 2FA). Until then, releases must be published locally with an OTP.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-09)

**Core value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code
**Current focus:** v2.4.0 Phase 21 — Judge Rigor (Phases 18.1 + 19 + 20 complete & verified)

## Tech Debt

- ⚠️ STALE CLAIM: the "5 pre-existing `scenarios.test.ts` failures" (Phase 28 premise) did NOT reproduce during Phase 18.1 — full suite is green (cli 344 passed / 3 skipped, scenarios.test.ts passing; core 921 passed). Verify and re-scope Phase 28 before executing it; it may already be satisfied or need a different target.

## Decisions

Recent decisions affecting v2.4.0 work:

- Phase 18.1 (v2.3.1) ships verified false-green bugfixes BEFORE Phase 19. Items #1-#5 from external fix-plan are real (re-verified vs local source 2026-05-30); #6 already fixed (regression test only); #7 flakiness folds into Phase 19. Scope for #3/#5 is broad. Evidence: `.planning/research/v2.3.1-bugfix-verification.md`.
- Phase 20 COMPLETE (2026-05-30, verified 4/4): trajectory_precision/recall/exact_match + ordered toggle; multiset intersection (handles duplicate calls); FailureCodes TRAJECTORY_PRECISION_LOW/RECALL_LOW/EXACT_MISMATCH; wired into strict ExpectSchema + registry; coexists with legacy toolCalls. Pure module packages/core/src/assertions/trajectory.ts.
- Phase 19 COMPLETE (2026-05-30, verified 5/5): stats.ts primitives, aggregator stats fields, repeat=3 default, reporters surface pass^k/pass@k/variance/CI/p50-p95-p99/efficiency. Delivered the deferred fix-plan #7 flakiness display. Caveat: STAT-04 toolCallsPerTask uses a documented proxy (counts tool_called assertions, not ProviderResponse.toolCalls) — exact sourcing is a future follow-up.
- Phase 19 is the foundation: repeat default, aggregator, CIs, efficiency metrics must land before other phases
- Phases 20, 21, 22, 25, 26, 28 can run in parallel after 19; Phase 23 depends on 22; Phase 24 depends on 20; Phase 27 depends on 19+20+22

Full decision log: `.planning/PROJECT.md` Key Decisions table.

## Accumulated Context

### Roadmap Evolution

- Phase 18.1 inserted after Phase 18: v2.3.1 false-green bugfixes (verified regressions #1-#5 + #6 test) before resuming Phase 19 (URGENT)

### Research

Deep market & technical research at `.planning/research/v2.4-market-signal.md` covering trajectory metrics formulas, pass^k reliability, judge bias magnitudes, Anthropic statistical eval methodology, EU AI Act Annex IV deadline (Aug 2, 2026).

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-09
Stopped at: Roadmap created for v2.4.0 Rigor & Reach
Resume file: None
