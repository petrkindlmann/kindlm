# Requirements: KindLM

**Defined:** 2026-04-02
**Core Value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## v2.2.0 Requirements

Requirements for Core Quality milestone. Each maps to roadmap phases.

### Reporting

- [x] **RPT-01**: User sees judge reasoning text in pretty reporter output when a judge assertion fails
- [x] **RPT-02**: User sees judge reasoning text (dimmed) in pretty reporter output when a judge assertion passes

### Gate Integrity

- [ ] **GATE-01**: User sees a warning when `judgeAvgMin` gate evaluates against zero judge assertions
- [ ] **GATE-02**: User sees a warning when `driftScoreMax` gate evaluates against zero drift assertions
- [ ] **GATE-03**: User sees a warning when `deterministicPassRate` or `probabilisticPassRate` gate evaluates against zero assertions of that category

### Dry Run

- [ ] **DRY-01**: User can run `kindlm test --dry-run` to see execution plan without making API calls
- [ ] **DRY-02**: Dry-run output shows each test name, target model(s), and repeat count
- [ ] **DRY-03**: Dry-run output shows assertion types configured per test (toolCalls, judge, pii, etc.)
- [ ] **DRY-04**: Dry-run output shows estimated cost per test and total estimated cost based on model pricing
- [ ] **DRY-05**: Dry-run output shows total API call count (tests x models x repeats)

### Validation

- [ ] **VAL-01**: Config validation errors include the test name where the error occurred
- [ ] **VAL-02**: Config validation errors include the field path (e.g. `tests[2].expect.judge[0].minScore`)
- [ ] **VAL-03**: Config validation suggests corrections for undefined prompt references
- [ ] **VAL-04**: Config validation suggests corrections for undefined provider/model references

## Future Requirements

None — scope is tight for this milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tool call details in failure output | Deferred — good idea but not in this milestone |
| Fail-on-empty gate policy (configurable) | Warn-only is sufficient for now; revisit if users request |
| Watch mode | Separate concern, not core quality |
| Response caching | Optimization, not core quality |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RPT-01 | Phase 10 | Complete |
| RPT-02 | Phase 10 | Complete |
| GATE-01 | Phase 10 | Pending |
| GATE-02 | Phase 10 | Pending |
| GATE-03 | Phase 10 | Pending |
| DRY-01 | Phase 11 | Pending |
| DRY-02 | Phase 11 | Pending |
| DRY-03 | Phase 11 | Pending |
| DRY-04 | Phase 11 | Pending |
| DRY-05 | Phase 11 | Pending |
| VAL-01 | Phase 12 | Pending |
| VAL-02 | Phase 12 | Pending |
| VAL-03 | Phase 12 | Pending |
| VAL-04 | Phase 12 | Pending |

**Coverage:**
- v2.2.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
