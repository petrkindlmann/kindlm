# Requirements: KindLM

**Defined:** 2026-04-09
**Core Value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## v2.4.0 Requirements

Requirements for v2.4.0 Rigor & Reach. Each maps to roadmap phases.

### Trajectory Metrics

- [ ] **TRAJ-01**: User can define trajectory_precision assertions that compute |predicted ∩ reference| / |predicted| against a reference tool-call sequence
- [ ] **TRAJ-02**: User can define trajectory_recall assertions that compute |predicted ∩ reference| / |reference| against a reference tool-call sequence
- [ ] **TRAJ-03**: User can define trajectory_exact_match assertions that return 1 if predicted sequence is identical to reference (same tools, same order), 0 otherwise
- [ ] **TRAJ-04**: User can toggle ordering sensitivity on trajectory metrics via a config flag (ordered vs any-order matching)

### Reliability

- [ ] **REL-01**: Default repeat count is 3 (changed from 1) with documentation recommending 5–8 for production
- [ ] **REL-02**: User sees pass^k (probability all k trials succeed) as a first-class metric in all reporter outputs
- [ ] **REL-03**: User sees pass@k (probability at least one trial succeeds) alongside pass^k in reporter output
- [ ] **REL-04**: User sees per-test variance (σ) across repeated runs in reporter output

### Statistical Rigor

- [ ] **STAT-01**: All aggregate scores (pass rate, judge score, latency) report bootstrap 95% confidence intervals [lo, hi]
- [ ] **STAT-02**: Latency reporting includes p50, p95, p99 percentiles (not just mean)
- [ ] **STAT-03**: Cost-per-task and tokens-per-task tracked as efficiency metrics across runs
- [ ] **STAT-04**: Step efficiency (tool calls per task) reported as an aggregate metric

### Judge Improvements

- [ ] **JUDGE-02**: Judge defaults to a different model family than the generator; warns if same family is used
- [ ] **JUDGE-03**: Judge runs with position randomization (swapped order, averaged) to mitigate position bias
- [ ] **JUDGE-04**: Judge reliability reported as bootstrap CI across multiple judge runs per test

### Result Presentation

- [ ] **PRES-01**: Pretty reporter shows failures first, collapses passing assertions to a single summary line
- [ ] **PRES-02**: Each failure includes a copy-pasteable repro command: `kindlm test -t <test-name>`
- [ ] **PRES-03**: Failures are clustered by failure signature (e.g., "7 tests failed on search_orders with same arg mismatch")
- [ ] **PRES-04**: Score deltas display significance: `0.82 → 0.74 (-0.08, n=5, not significant)`
- [ ] **PRES-05**: Per-evaluator stats include p50, p95, p99 (matching Cobalt's output)

### CI Integration

- [ ] **CI-01**: `kindlm test` emits GitHub Actions annotations (`::error file=kindlm.yaml,line=N::`) for failing tests
- [ ] **CI-02**: `kindlm test --pr-comment` generates a sticky PR comment with delta table (test|baseline|new|Δ|verdict), edited in place
- [ ] **CI-03**: PR comment collapses passing tests under `<details>` and highlights regressions

### Tool-Call Diffing

- [ ] **DIFF-01**: Side-by-side tool-call sequence diff rendered in terminal with two columns (expected vs actual trajectory)
- [ ] **DIFF-02**: Arg-level character highlighting shows exactly which arguments changed between expected and actual
- [ ] **DIFF-03**: Tool-call diff available in PR comment output (markdown-formatted)

### Config at Scale

- [ ] **SCALE-01**: User can use `include:` directive to compose test suites from multiple YAML files
- [ ] **SCALE-02**: User can organize tests as `tests/**/*.kindlm.yaml` with automatic discovery
- [ ] **SCALE-03**: `kindlm lint` detects duplicate test names, undefined prompt/model refs, dead variables, and stale baselines

### Compliance

- [ ] **COMP-01**: Compliance PDF/markdown has page 1 executive summary (pass rate, risk categories, trend vs last audit)
- [ ] **COMP-02**: Compliance report structured by Annex IV elements (system architecture, data provenance, testing/validation, risk management)
- [ ] **COMP-03**: Compliance report includes dated/signed test logs section as required by Annex IV

### Documentation

- [ ] **DOCS-01**: README repositioned around rigor + framework-agnostic + local-first + CI-gating positioning
- [ ] **DOCS-02**: CLAUDE.md (root + .claude/) updated with new commands, metrics, conventions, and competitor context
- [ ] **DOCS-03**: New docs/metrics.md documenting trajectory metrics, pass^k, CIs, judge rigor with formulas and sample sizes

### Tech Debt

- [ ] **DEBT-01**: Fix 5 pre-existing integration test failures in scenarios.test.ts (tool call mocking)

## v2.5.0 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Workflow

- **WORK-01**: `kindlm record` ingests OTEL trace and scaffolds a regression test YAML
- **WORK-02**: `kindlm watch` runs scheduled evals with model-version drift detection
- **WORK-03**: `kindlm test --only-failed` reruns only last-run failures
- **WORK-04**: `kindlm test --bisect` finds which test/config change caused a regression
- **WORK-05**: Flaky test auto-detection flags tests whose variance exceeds threshold
- **WORK-06**: `kindlm calibrate` runs N clean evals and suggests a gate threshold

### Cloud

- **CLOUD-01**: Run-vs-run diff view (not just vs baseline)
- **CLOUD-02**: Trends view (pass rate, cost, latency over time per suite)
- **CLOUD-03**: Prod trace shadow eval (continuous scoring of live traces)
- **CLOUD-04**: Slack/webhook failure digests with top-N regressions
- **CLOUD-05**: One-click data export (open format)
- **CLOUD-06**: Web editor for non-engineers (schema-aware YAML form)

### Ecosystem

- **ECO-01**: MCP server for AI-assisted test authoring (match Cobalt)
- **ECO-02**: Programmatic JS/TS API (export core as library)
- **ECO-03**: Learned PII classifier option (supplement regex)
- **ECO-04**: Hallucination grader (claims unsupported by tool outputs)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Sandboxed code execution | Inspect AI parity — high complexity, unclear demand for KindLM's audience |
| RAG-specific metrics (faithfulness, context precision/recall) | Ragas formulas are public; not core to agent behavioral testing |
| Pre-built eval library (100+ benchmarks) | Inspect AI's domain; KindLM's value is custom tests, not benchmark suites |
| Agent Bridge (third-party framework adapters) | OTEL trace ingestion is the neutral path; framework-specific adapters add maintenance |
| Real-time production monitoring | v2.5+ scope via kindlm watch; not CI-time concern |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (Populated by roadmapper) | | |

**Coverage:**
- v2.4.0 requirements: 33 total
- Mapped to phases: 0
- Unmapped: 33 ⚠️

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial definition*
