# KindLM Roadmap

## Milestones

- ✅ **v2.0.0 Launch Ops** — Phases 1-5 (shipped 2026-04-01)
- ✅ **v2.1.0 Gap Closure** — Phases 6-9 (shipped 2026-04-02)
- 🚧 **v2.2.0 Core Quality** — Phases 10-12 (in progress)

## Phases

<details>
<summary>✅ v2.0.0 Launch Ops (Phases 1-5) — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Deploy Everything (3/3 plans) — completed 2026-04-01
- [x] Phase 2: Append-only Run Artifacts + Versioned Baselines (1/1 plans) — completed 2026-04-01
- [x] Phase 3: Feature Flags via Config (1/1 plans) — completed 2026-04-01
- [x] Phase 4: MCP Provider Adapter (1/1 plans) — completed 2026-04-01
- [x] Phase 5: Worktree Isolation for Test Runs (1/1 plans) — completed 2026-04-01

See `.planning/milestones/v2.0.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.1.0 Gap Closure (Phases 6-9) — SHIPPED 2026-04-02</summary>

- [x] Phase 6: Cost Gating + CLI Overrides (1/1 plans) — completed 2026-04-01
- [x] Phase 7: betaJudge Multi-Pass Scoring (1/1 plans) — completed 2026-04-01
- [x] Phase 8: Worktree File Copy (1/1 plans) — completed 2026-04-01
- [x] Phase 9: CLI Utility Unit Tests (1/1 plans) — completed 2026-04-02

See `.planning/milestones/v2.1.0-ROADMAP.md` for full details.

</details>

### 🚧 v2.2.0 Core Quality (In Progress)

**Milestone Goal:** Make the existing core deliver on its promise — actionable failures, honest gates, zero-cost validation.

## Phases (v2.2.0)

- [x] **Phase 10: Reporter Output + Gate Integrity** - Judge reasoning visible in failures/passes; gates warn when they have no data to evaluate (completed 2026-04-02)
- [x] **Phase 11: Dry Run** - `--dry-run` flag shows execution plan, assertion types, estimated cost, and call count without making API calls (completed 2026-04-02)
- [ ] **Phase 12: Validation Diagnostics** - Config errors name the failing test, the exact field path, and suggest fixes for bad references

## Phase Details

### Phase 10: Reporter Output + Gate Integrity
**Goal**: Users get honest, actionable feedback — judge failures explain why, and gates never silently pass on empty data
**Depends on**: Phase 9
**Requirements**: RPT-01, RPT-02, GATE-01, GATE-02, GATE-03
**Success Criteria** (what must be TRUE):
  1. User sees judge reasoning text in pretty output when a judge assertion fails
  2. User sees judge reasoning text (dimmed) in pretty output when a judge assertion passes
  3. User sees a warning when `judgeAvgMin` gate has zero judge assertions to evaluate
  4. User sees a warning when `driftScoreMax` gate has zero drift assertions to evaluate
  5. User sees a warning when `deterministicPassRate` or `probabilisticPassRate` gate has zero assertions of that category
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Add judge reasoning display to pretty reporter
- [x] 10-02-PLAN.md — Add emptyData warning flag to gate evaluation and reporter

### Phase 11: Dry Run
**Goal**: Users can preview exactly what will run — models, tests, assertions, estimated cost — without spending API credits
**Depends on**: Phase 10
**Requirements**: DRY-01, DRY-02, DRY-03, DRY-04, DRY-05
**Success Criteria** (what must be TRUE):
  1. User can run `kindlm test --dry-run` and no provider API calls are made
  2. Dry-run output lists each test name, target model(s), and repeat count
  3. Dry-run output lists assertion types configured per test
  4. Dry-run output shows estimated cost per test and total estimated cost
  5. Dry-run output shows total API call count (tests × models × repeats)
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Add KINDLM_PRICING table and estimateDryRunCost to core; add cost fields to TestPlanEntry/TestPlan
- [x] 11-02-PLAN.md — Update formatTestPlan CLI formatter to display per-entry and total cost

### Phase 12: Validation Diagnostics
**Goal**: Config errors give users enough context to fix the problem without reading source code
**Depends on**: Phase 11
**Requirements**: VAL-01, VAL-02, VAL-03, VAL-04
**Success Criteria** (what must be TRUE):
  1. Validation error output names the test where the error occurred
  2. Validation error output includes the exact field path (e.g. `tests[2].expect.judge[0].minScore`)
  3. Referencing an undefined prompt name in a test produces a suggestion showing defined prompt names
  4. Referencing an undefined provider or model produces a suggestion showing defined provider/model names
**Plans**: 2 plans

Plans:
- [x] 12-01-PLAN.md — Fix Zod error paths to bracket notation (tests[2].expect.judge[0].minScore)
- [ ] 12-02-PLAN.md — Add "Did you mean?" suggestions to undefined prompt/model/provider errors

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Deploy Everything | v2.0.0 | 3/3 | Complete | 2026-04-01 |
| 2. Append-only Run Artifacts + Versioned Baselines | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 3. Feature Flags via Config | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 4. MCP Provider Adapter | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 5. Worktree Isolation for Test Runs | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 6. Cost Gating + CLI Overrides | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 7. betaJudge Multi-Pass Scoring | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 8. Worktree File Copy | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 9. CLI Utility Unit Tests | v2.1.0 | 1/1 | Complete | 2026-04-02 |
| 10. Reporter Output + Gate Integrity | v2.2.0 | 2/2 | Complete    | 2026-04-02 |
| 11. Dry Run | v2.2.0 | 2/2 | Complete    | 2026-04-02 |
| 12. Validation Diagnostics | v2.2.0 | 1/2 | In Progress|  |
