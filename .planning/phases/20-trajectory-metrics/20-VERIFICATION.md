---
phase: 20-trajectory-metrics
verified: 2026-05-30T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification:
  performed: false
---

# Phase 20: Trajectory Metrics Verification Report

**Phase Goal:** Users can assert on the quality of an agent's tool-call trajectory against a reference sequence.
**Verified:** 2026-05-30
**Status:** passed
**Branch/HEAD:** phase-20-trajectory-metrics @ d6d1ef2 (confirmed via `git rev-parse`)

## Goal Achievement

### Observable Truths

| Criterion | TRAJ id | Implementing file | Test file | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| `trajectory_precision` = \|pred ∩ ref\| / \|pred\| (multiset) | TRAJ-01 | `core/src/assertions/trajectory.ts` L94-109 (`multisetIntersectionSize` + `matched/pred.length`) | `trajectory.test.ts` L141-166; `registry.test.ts` L534-557 | ✓ VERIFIED | True multiset intersection: `refCounts` map, each predicted consumes one slot (`set(p, n-1)`). Golden duplicate test pred=[search×3] vs ref=[search×2] → precision `toBeCloseTo(2/3)`. Registry config→result: lookup+spam vs lookup+refund → precision 0.5. Empty pred → 0 (L96 guard). |
| `trajectory_recall` = \|pred ∩ ref\| / \|ref\| (multiset) | TRAJ-02 | `trajectory.ts` L111-126 (`matched/ref.length`) | `trajectory.test.ts` L59-89, L141-166; `registry.test.ts` L559-581 | ✓ VERIFIED | Same multiset helper. Duplicate golden → recall `toBe(1)` (2/2). recall=0.5 when 1 of 2 ref steps missing (pure + registry). Empty ref → 0 (L113 guard). |
| `trajectory_exact_match` binary 1/0 (tools+order) | TRAJ-03 | `trajectory.ts` L128-143 (`sequencesEqual` on `predForExact`/`refForExact`) | `trajectory.test.ts` L91-123; `registry.test.ts` L583-604 | ✓ VERIFIED | Identical ordered → score 1. Reorder under ordered=true → score 0, passed false, `TRAJECTORY_EXACT_MISMATCH`. Both directions tested at pure and registry level. |
| `ordered: false` switches to any-order (multiset) matching | TRAJ-04 | `trajectory.ts` L83-84 (`config.ordered ? seq : [...seq].sort()`) + `registry.ts` L152-170 | `trajectory.test.ts` L125-139; `registry.test.ts` L583-621 | ✓ VERIFIED | Registry test `TRAJ-03 + TRAJ-04: exact_match ordered=true FAILS on reorder, ordered=false PASSES` — same `ctx` (refund,lookup), ordered=true → score 0/fail, ordered=false → score 1/pass. Both directions config→result. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `core/src/assertions/trajectory.ts` (148 ln) | precision/recall/exactMatch + multiset + ordered toggle | ✓ VERIFIED | Full read; substantive, no stubs. |
| `core/src/assertions/trajectory.test.ts` (246 ln, 13 tests) | non-hollow tests | ✓ VERIFIED | Golden multiset, edge, `__proto__`, matchArgs all present. |
| `core/src/config/schema.ts` | `trajectory` on STRICT ExpectSchema | ✓ VERIFIED | `TrajectoryExpectSchema` `.strict()` + `.refine` (≥1 metric); declared optional `trajectory:` on `.strict()` ExpectSchema (L476-479); types exported (L811-812). |
| `core/src/assertions/registry.ts` | builds trajectory assertion | ✓ VERIFIED | Import L18; `if (expect.trajectory)` branch L152-170 forwards all fields; coexists with legacy toolCalls. |
| `core/src/assertions/interface.ts` | FailureCode union extended | ✓ VERIFIED | L20-22: `TRAJECTORY_PRECISION_LOW`, `TRAJECTORY_RECALL_LOW`, `TRAJECTORY_EXACT_MISMATCH`. |
| `core/src/assertions/index.ts` | barrel export | ✓ VERIFIED | L27-28 export `createTrajectoryAssertion` + types. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `expect.trajectory` (YAML) | `TrajectoryExpectSchema` | strict ExpectSchema parse | ✓ WIRED | Declared key on `.strict()` ExpectSchema; schema.test.ts GATING tests: valid trajectory parses under strict (L435), legacy config round-trips (L416), unknown inner key rejected (L545), no-metric rejected (L511), empty reference rejected (L536). |
| Parsed config | `createTrajectoryAssertion` | `createAssertionsFromExpect` | ✓ WIRED | registry.ts L157-169; registry.test.ts builds+evaluates (config→result) for TRAJ-01..04. |

### Edge Cases

| Edge | Status | Evidence |
| --- | --- | --- |
| Empty predicted → 0 not NaN | ✓ | trajectory.ts L96 guard; test L194-207 (`Number.isNaN` false, `pred=0` msg). |
| Empty reference → 0 not NaN | ✓ | trajectory.ts L113 guard; schema rejects empty `reference: []` (schema.test.ts L536). |
| `__proto__` arg safety | ✓ | `canonicalizeArgs` uses `Object.keys().sort()` (own-enumerable only); test L231-245 asserts no pollution. |
| `matchArgs:false` ignores args | ✓ | `fingerprint` returns name only; test L180-192. |
| Coexistence with legacy `toolCalls` | ✓ | registry.test.ts L646-662 (migration path B) + schema.test.ts L490. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| trajectory/registry/schema vitest | `vitest run` (3 files) | 3 files passed: trajectory 13 + registry 37 + schema 52 = 102 tests passed, 0 failures, EXIT=0 | ✓ PASS |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder/stub in trajectory source or tests.

## Gaps / PARTIALs

None. One naming note (not a gap): the failure code is `TRAJECTORY_EXACT_MISMATCH` (the verification brief informally referenced `..._FAIL`); the actual literal is consistent across interface.ts, trajectory.ts, and the tests.

## Gaps Summary

All four ROADMAP success criteria (TRAJ-01..04) are implemented with correct **multiset** math (not set), verified by a non-hollow duplicate-call golden test (precision 2/3, recall 1). exact_match is binary with order sensitivity; the `ordered` toggle is tested in both directions at both the pure-function and registry (config→result) levels via a single shared-context test. `expect.trajectory` is a declared key on the strict ExpectSchema with refine-enforced ≥1 metric, wired through the registry, FailureCode union extended, barrel exports present. Edge cases (empty→0, `__proto__`, matchArgs, legacy coexistence) covered. Spot-run green (102/102 across the 3 relevant files). Phase goal achieved.

---

_Verified: 2026-05-30_
_Verifier: Claude (gsd-verifier)_
