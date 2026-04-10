# KindLM Roadmap

## Milestones

- ✅ **v2.0.0 Launch Ops** — Phases 1-5 (shipped 2026-04-01)
- ✅ **v2.1.0 Gap Closure** — Phases 6-9 (shipped 2026-04-02)
- ✅ **v2.2.0 Core Quality** — Phases 10-12 (shipped 2026-04-02)
- ✅ **v2.3.0 Developer Experience & Depth** — Phases 13-18 (shipped 2026-04-03)
- 🚧 **v2.4.0 Rigor & Reach** — Phases 19-28 (in progress)

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

<details>
<summary>✅ v2.2.0 Core Quality (Phases 10-12) — SHIPPED 2026-04-02</summary>

- [x] Phase 10: Reporter Output + Gate Integrity (2/2 plans) — completed 2026-04-02
- [x] Phase 11: Dry Run (2/2 plans) — completed 2026-04-02
- [x] Phase 12: Validation Diagnostics (2/2 plans) — completed 2026-04-02

See `.planning/milestones/v2.2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.3.0 Developer Experience & Depth (Phases 13-18) — SHIPPED 2026-04-03</summary>

- [x] Phase 13: Rich Tool Call Failure Output (1/1 plans) — completed 2026-04-02
- [x] Phase 14: Response Caching (2/2 plans) — completed 2026-04-02
- [x] Phase 15: Watch Mode (2/2 plans) — completed 2026-04-03
- [x] Phase 16: Multi-Turn Agent Testing (2/2 plans) — completed 2026-04-03
- [x] Phase 17: GitHub Action (2/2 plans) — completed 2026-04-03
- [x] Phase 18: Dashboard Team Features (3/3 plans) — completed 2026-04-03

See `.planning/milestones/v2.3.0-ROADMAP.md` for full details.

</details>

### 🚧 v2.4.0 Rigor & Reach (In Progress)

**Milestone Goal:** Close the methodological rigor gap and CI UX gap to make KindLM the provably-correct choice for serious agent testing teams.

- [ ] **Phase 19: Reliability & Statistical Foundations** - Default repeat=3, pass^k/pass@k metrics, percentile latency, bootstrap CIs, efficiency metrics
- [ ] **Phase 20: Trajectory Metrics** - Precision, recall, exact_match assertions against reference tool-call sequences
- [ ] **Phase 21: Judge Rigor** - Different-family default, position randomization, bootstrap CI for judge reliability
- [ ] **Phase 22: Failure-First Terminal** - Failures first in reporter, repro commands, failure clustering, significance display, per-evaluator percentiles
- [ ] **Phase 23: CI Integration** - GitHub Actions annotations, sticky PR comment with delta table, collapsed passing tests
- [ ] **Phase 24: Tool-Call Diffing** - Side-by-side trajectory diff, arg-level highlighting, markdown diff for PR comments
- [ ] **Phase 25: Config at Scale** - include: directive, tests/**/*.kindlm.yaml discovery, kindlm lint
- [ ] **Phase 26: Compliance PDF Restructure** - Executive summary page, Annex IV element structure, dated/signed test logs
- [ ] **Phase 27: Documentation Refresh** - README repositioning, CLAUDE.md update, metrics documentation
- [ ] **Phase 28: Tech Debt Cleanup** - Fix 5 pre-existing scenarios.test.ts failures

## Phase Details

### Phase 19: Reliability & Statistical Foundations
**Goal**: Users get statistically meaningful test results by default, with confidence intervals and efficiency metrics on every run
**Depends on**: Phase 18 (v2.3.0 complete)
**Requirements**: REL-01, REL-02, REL-03, REL-04, STAT-01, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):
  1. Running `kindlm test` without explicit `repeat:` executes each test 3 times (not 1)
  2. Reporter output shows pass^k, pass@k, and per-test variance for every test with repeat > 1
  3. Latency is reported as p50/p95/p99 (not just mean) in all reporter formats
  4. All aggregate scores display bootstrap 95% confidence intervals [lo, hi]
  5. Cost-per-task, tokens-per-task, and tool-calls-per-task appear as efficiency metrics in output
**Plans**: 19-01 (stats.ts), 19-02 (aggregator), 19-03 (schema/runner/CLI), 19-04 (reporters/gate)

### Phase 20: Trajectory Metrics
**Goal**: Users can assert on the quality of an agent's tool-call trajectory against a reference sequence
**Depends on**: Phase 19
**Requirements**: TRAJ-01, TRAJ-02, TRAJ-03, TRAJ-04
**Success Criteria** (what must be TRUE):
  1. User can add `trajectory_precision` to expect block and see precision score computed against a reference tool-call sequence
  2. User can add `trajectory_recall` to expect block and see recall score computed against a reference
  3. User can add `trajectory_exact_match` and get a binary 0/1 score for exact sequence match
  4. Setting `ordered: false` on any trajectory assertion switches from ordered to any-order matching
**Plans**: TBD

### Phase 21: Judge Rigor
**Goal**: LLM-as-judge evaluations are bias-mitigated and report their own reliability
**Depends on**: Phase 19
**Requirements**: JUDGE-02, JUDGE-03, JUDGE-04
**Success Criteria** (what must be TRUE):
  1. Judge defaults to a different model family than the generator; a visible warning appears if same family is used
  2. Judge runs with position randomization (swapped order, averaged scores) by default
  3. Judge reliability is reported as a bootstrap CI when multiple judge runs occur per test
**Plans**: TBD

### Phase 22: Failure-First Terminal
**Goal**: Terminal output surfaces failures immediately with actionable context, so users fix problems faster
**Depends on**: Phase 19
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05
**Success Criteria** (what must be TRUE):
  1. Pretty reporter shows all failures before passing tests; passing assertions collapse to a single summary line
  2. Each failure line includes a copy-pasteable `kindlm test -t <test-name>` repro command
  3. Failures with the same signature are clustered (e.g., "7 tests failed on search_orders with same arg mismatch")
  4. Score deltas display significance notation: `0.82 -> 0.74 (-0.08, n=5, not significant)`
  5. Per-evaluator stats include p50, p95, p99 percentiles
**Plans**: TBD
**UI hint**: yes

### Phase 23: CI Integration
**Goal**: KindLM test failures appear inline in GitHub PRs with zero manual setup beyond the existing Action
**Depends on**: Phase 22
**Requirements**: CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. When running in GitHub Actions, failing tests emit `::error file=kindlm.yaml,line=N::` annotations visible on the PR Files tab
  2. `kindlm test --pr-comment` creates/updates a sticky PR comment with a delta table (test|baseline|new|delta|verdict)
  3. PR comment collapses passing tests under `<details>` and highlights regressions at top
**Plans**: TBD

### Phase 24: Tool-Call Diffing
**Goal**: Users can visually compare expected vs actual tool-call trajectories in terminal and PR comments
**Depends on**: Phase 20
**Requirements**: DIFF-01, DIFF-02, DIFF-03
**Success Criteria** (what must be TRUE):
  1. Terminal shows side-by-side two-column diff of expected vs actual tool-call sequences
  2. Arg-level character differences are highlighted (color in terminal, bold/strikethrough in markdown)
  3. Tool-call diff is available in PR comment output as markdown-formatted diff
**Plans**: TBD
**UI hint**: yes

### Phase 25: Config at Scale
**Goal**: Users with large test suites can compose, discover, and validate configs without manual bookkeeping
**Depends on**: Phase 19
**Requirements**: SCALE-01, SCALE-02, SCALE-03
**Success Criteria** (what must be TRUE):
  1. User can add `include: [path/to/other.yaml]` in kindlm.yaml to compose suites from multiple files
  2. Running `kindlm test` in a directory with `tests/**/*.kindlm.yaml` auto-discovers and runs all matching files
  3. `kindlm lint` reports duplicate test names, undefined prompt/model refs, dead variables, and stale baselines
**Plans**: TBD

### Phase 26: Compliance PDF Restructure
**Goal**: Compliance reports meet EU AI Act Annex IV structure with executive summary for non-technical stakeholders
**Depends on**: Phase 19
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. Page 1 of compliance report shows executive summary with pass rate, risk categories, and trend vs last audit
  2. Report body is structured by Annex IV elements (system architecture, data provenance, testing/validation, risk management)
  3. Report includes a dated/signed test logs section with per-test timestamps
**Plans**: TBD

### Phase 27: Documentation Refresh
**Goal**: Documentation reflects v2.4.0 capabilities and positions KindLM around rigor, framework-agnostic, local-first, CI-gating
**Depends on**: Phase 22, Phase 20, Phase 19
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. README leads with rigor positioning (trajectory metrics, pass^k, CIs) and framework-agnostic + local-first messaging
  2. CLAUDE.md files (root + .claude/) document new commands, metrics, conventions, and competitor context
  3. docs/metrics.md exists with formulas, sample size guidance, and worked examples for trajectory metrics, pass^k, and CIs
**Plans**: TBD

### Phase 28: Tech Debt Cleanup
**Goal**: Integration test suite is green -- no pre-existing failures
**Depends on**: Phase 19
**Requirements**: DEBT-01
**Success Criteria** (what must be TRUE):
  1. All 5 previously-failing tests in scenarios.test.ts pass
  2. `npm run test` exits 0 with no skipped integration tests
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28
(Phases 20, 21, 22, 25, 26, 28 can run in parallel after 19; dependency graph allows flexibility.)

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
| 10. Reporter Output + Gate Integrity | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 11. Dry Run | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 12. Validation Diagnostics | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 13. Rich Tool Call Failure Output | v2.3.0 | 1/1 | Complete | 2026-04-02 |
| 14. Response Caching | v2.3.0 | 2/2 | Complete | 2026-04-02 |
| 15. Watch Mode | v2.3.0 | 2/2 | Complete | 2026-04-03 |
| 16. Multi-Turn Agent Testing | v2.3.0 | 2/2 | Complete | 2026-04-03 |
| 17. GitHub Action | v2.3.0 | 2/2 | Complete | 2026-04-03 |
| 18. Dashboard Team Features | v2.3.0 | 3/3 | Complete | 2026-04-03 |
| 19. Reliability & Statistical Foundations | v2.4.0 | 0/? | Not started | - |
| 20. Trajectory Metrics | v2.4.0 | 0/? | Not started | - |
| 21. Judge Rigor | v2.4.0 | 0/? | Not started | - |
| 22. Failure-First Terminal | v2.4.0 | 0/? | Not started | - |
| 23. CI Integration | v2.4.0 | 0/? | Not started | - |
| 24. Tool-Call Diffing | v2.4.0 | 0/? | Not started | - |
| 25. Config at Scale | v2.4.0 | 0/? | Not started | - |
| 26. Compliance PDF Restructure | v2.4.0 | 0/? | Not started | - |
| 27. Documentation Refresh | v2.4.0 | 0/? | Not started | - |
| 28. Tech Debt Cleanup | v2.4.0 | 0/? | Not started | - |
