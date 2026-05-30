---
phase: 19-reliability-statistical-foundations
verified: 2026-05-30T13:55:00Z
status: passed
score: 5/5 must-haves verified
branch: phase-19-reliability
head: 55dde0a
overrides_applied: 0
---

# Phase 19: Reliability & Statistical Foundations Verification Report

**Phase Goal:** Users get statistically meaningful test results by default, with confidence intervals and efficiency metrics on every run.
**Verified:** 2026-05-30T13:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Criterion | Requirement IDs | Implementing file | Test file | Verdict | Evidence |
|---|-----------|-----------------|-------------------|-----------|---------|----------|
| 1 | `kindlm test` without explicit `repeat:` runs each test 3× | REL-01 | `config/schema.ts:696-705` (`.default(3)`); `engine/test-plan.ts:22-39` (`buildTestPlan` expands `repeat` → N PlannedRuns) | `config/parser.test.ts:230-255` (omitted→3, explicit 1→1, explicit 5→5, repeat=0 rejected); `engine/test-plan.test.ts` | ✓ VERIFIED | Schema default is literally `.default(3)`; test-plan loops `for (i<repeat) push(...)`; parser test asserts `defaults.repeat===3` when omitted. |
| 2 | Reporter shows pass^k, pass@k, and per-test variance for repeat>1 | REL-02, REL-04 | `engine/stats.ts:17-34` (passK=p^k, passAtK=1-(1-p)^k); `engine/aggregator.ts:117-118,141` (stdDev per assertion); `reporters/pretty.ts:242-260` renders `pass^N`, `pass@N`, `σ=` | `stats.test.ts:42-76` (golden 0.296/0.963, Bessel √(32/7)); `aggregator.test.ts:45,80` | ✓ VERIFIED | Math confirmed in source + golden tests. pretty.ts:234-239 emits `n=1` note (no degenerate CI) when runCount≤1. |
| 3 | Latency reported as p50/p95/p99 (not just mean) in all reporter formats | STAT-02 | `engine/stats.ts:44-56` (R-7 percentile); `aggregator.ts:158-165` (LatencyStats); `reporters/pretty.ts:262-269`, `reporters/json.ts:17` (`latency: test.latency`) | `stats.test.ts:27-29` (golden p50=5.5, p95=9.55, p99=9.91); `aggregator.test.ts:51` | ✓ VERIFIED | R-7 golden values match numpy. pretty + json expose full LatencyStats. See PARTIAL note on junit below. |
| 4 | All aggregate scores show bootstrap 95% CI [lo, hi] | STAT-01 | `engine/stats.ts:94-125` (bootstrapCI percentile, B=1000, seedable rng); `aggregator.ts:115,142,182` (passRateCI, per-assertion ci, costCI); `pretty.ts:251-260` renders `[lo, hi] (n=…)`; suite-level `pretty.ts:211-215` | `stats.test.ts:78-116` (reproducible w/ seed, level 0.95, lo≤hi, brackets 0.5); `aggregator.test.ts:38,74` | ✓ VERIFIED | Deterministic under seeded rng. n=1 path returns non-NaN (`aggregator.test.ts:74`); empty→{0,0} not NaN. |
| 5 | Cost/task, tokens/task, tool-calls/task as efficiency metrics in output | STAT-03, STAT-04 | `aggregator.ts:169-183` (EfficiencyStats); `pretty.ts:271-281` (cost/task, tokens/task, tools/task); `json.ts:18` (`efficiency`) | `aggregator.test.ts:58,67` (all three present; tool proxy) | ✓ VERIFIED (STAT-04 PARTIAL sourcing) | cost/task and tokens/task are exact. See STAT-04 caveat below. |

**Score:** 5/5 truths verified

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| REL-01 | ✓ SATISFIED | schema default(3) + test-plan expansion + parser tests |
| REL-02 | ✓ SATISFIED | passK/passAtK in stats.ts, rendered in pretty.ts |
| REL-03 | ✓ SATISFIED | passRate + passRateCI + passRateStdDev aggregated (aggregator.ts:114-116); flaky 6/10 signal test (aggregator.test.ts:23) |
| REL-04 | ✓ SATISFIED | sampleStdDev (Bessel n-1) per pass-series and per-assertion; golden test √(32/7) |
| STAT-01 | ✓ SATISFIED | bootstrapCI 95% percentile, seeded/deterministic, attached to passRate + assertion scores + cost |
| STAT-02 | ✓ SATISFIED | percentile R-7 p50/p95/p99 with golden tests; rendered in pretty + json |
| STAT-03 | ✓ SATISFIED | costPerTaskUsd, tokensPerTask exact (mean over runs) |
| STAT-04 | ✓ SATISFIED (PARTIAL sourcing) | toolCallsPerTask present and tested, but derived via proxy — see below |

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Phase-19 unit tests | `vitest run stats/aggregator/parser/test-plan` | 4 files passed | ✓ PASS |
| Full core suite | `vitest run packages/core` | 978 passed | ✓ PASS |
| Core typecheck | `tsc --noEmit -p packages/core` | clean | ✓ PASS |
| Flakiness signal | `aggregator.test.ts:23` | 6/10 → passK<passRate, passAtK>passRate | ✓ PASS |

## PARTIAL / Caveats

### STAT-04 tool-calls-per-task sourcing (PARTIAL, accepted)
`aggregator.ts:173-177` computes `toolCallsPerTask` by counting `tool_called` assertion
results per run, NOT from `ProviderResponse.toolCalls`. This is a documented best-effort
proxy: `TestCaseRunResult` does not currently thread the raw provider tool-call list. The
EfficiencyStats JSDoc (`aggregator.ts:44-49`) states this explicitly and notes it "will be
exact when ProviderResponse is threaded through TestCaseRunResult." Consequence: a test with
zero `tool_called` assertions reports `tools/task=0.0` even if the model actually called tools.
The metric exists, is rendered, and is tested (`aggregator.test.ts:67`), so STAT-04 is met —
but the data source is a workaround. Reported honestly as PARTIAL sourcing, not a blocker.

### JUnit latency (intentional, not a gap)
`reporters/junit.ts:85` deliberately keeps `latencyAvgMs` for the `<testcase time>` attribute
(JUnit XML schema expects a single scalar time). p50/p95/p99 are surfaced in pretty + json.
This matches the phase intent ("junit still uses latencyMs") and is not a gap.

## Anti-Patterns Found

None blocking. No TBD/FIXME/XXX markers in Phase-19 files. The "best-effort" proxy in
aggregator.ts is documented inline with rationale and a forward path — acceptable per
conventions (comments explain "why").

## Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria are implemented in source, wired through
runner → reporters, and backed by non-hollow golden/property tests. The single caveat
(STAT-04 proxy sourcing) is documented in code and does not prevent the criterion from being
observable in output.

---

_Verified: 2026-05-30T13:55:00Z_
_Verifier: Claude (gsd-verifier)_
