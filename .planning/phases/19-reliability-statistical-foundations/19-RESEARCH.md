# Phase 19: Reliability & Statistical Foundations - Research

**Researched:** 2026-04-09
**Domain:** Statistical aggregation, reliability metrics, reporter output
**Confidence:** HIGH

## Summary

Phase 19 is a **pure-core numerical upgrade** to `@kindlm/core`'s aggregator plus a thin reporter expansion. No new dependencies are required — everything maps to pure functions over the existing `TestCaseRunResult[]` array in `packages/core/src/engine/aggregator.ts`. The aggregator already receives every piece of data we need (per-run pass/fail, latencyMs, tokenUsage, costEstimateUsd, tool-call counts via `ProviderResponse`); it just discards variance and percentile information today.

The statistical formulas are well-established and short (all fit in <30 LOC each): pass^k = p^k, pass@k = 1-(1-p)^k, percentile via sorted interpolation, bootstrap 95% CI via B=1000 resamples and [25, 975] indices. The work is not algorithmic — it's (1) extending `AggregatedTestResult` with new fields, (2) wiring the runner/reporters/JSON/JUnit schemas to surface them, and (3) changing one default from `1` to `3` in `config/schema.ts` with a migration note.

**Primary recommendation:** Implement all statistical primitives as pure helpers in a new `packages/core/src/engine/stats.ts` file, test exhaustively with `fast-check` property tests + golden values, and keep zero new runtime dependencies (no simple-statistics, no jstat). The canonical stack is trivial to hand-roll correctly and we already forbid heavy deps in core.

## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for Phase 19.** Research proceeds against the roadmap goal and REQUIREMENTS.md requirements (REL-01..04, STAT-01..04). Planner should verify with user whether a discuss-phase is needed before planning.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Default repeat count is 3 (changed from 1); docs recommend 5-8 for production | Single-line change at `config/schema.ts:682`; doc update; backwards-compat note below |
| REL-02 | User sees pass^k (probability all k trials succeed) as first-class metric | Formula `p^k` in stats.ts; new field `passK` on `AggregatedTestResult`; reporter wiring |
| REL-03 | User sees pass@k (probability at least one trial succeeds) alongside pass^k | Formula `1-(1-p)^k`; new field `passAtK`; reporter wiring |
| REL-04 | User sees per-test variance (sigma) across repeated runs | Welford/two-pass std-dev; new field `passRateStdDev` + per-assertion variance |
| STAT-01 | All aggregate scores report bootstrap 95% CIs [lo, hi] | Bootstrap percentile method B=1000; new `ConfidenceInterval` type on pass rate + assertion scores |
| STAT-02 | Latency reporting includes p50, p95, p99 (not just mean) | Percentile-via-linear-interpolation; replace `latencyAvgMs` with `LatencyStats` |
| STAT-03 | Cost-per-task and tokens-per-task tracked as efficiency metrics | Already computed per-run; add aggregate `costPerTaskUsd`, `tokensPerTask` fields + CIs |
| STAT-04 | Step efficiency (tool calls per task) reported as aggregate metric | Count tool calls per-run from `ProviderResponse.toolCalls`; add `toolCallsPerTask` |

## Standard Stack

### Core (no new runtime deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none) | — | Statistical primitives | Hand-roll: formulas are 5-30 LOC each; `@kindlm/core` bans external runtime deps that aren't zero-I/O safe |

**Rationale for zero-dep approach** `[VERIFIED: packages/core/package.json + CLAUDE.md]`:
- Core must stay Workers-compatible (cloud imports only types)
- `simple-statistics` (v7.8.9 current) is 50KB+ and pulls in accessor helpers we don't need
- `@stdlib/stats` is a monorepo with heavy transitive surface area
- Every required formula has an unambiguous 1980s-era reference implementation
- Hand-rolling lets us use `Result<T, E>` wrappers natively and avoid any/unknown escapes

### Supporting (dev-deps — already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.2.4 | Unit tests (already in stack) | Golden-value tests for percentiles, pass^k, bootstrap |
| fast-check | 3.22.0 | Property-based testing (already in core devDeps) | Invariant tests for CIs, monotonicity of pass^k vs k, percentile ordering |

`[VERIFIED: packages/core/package.json shows "fast-check": "^3.22.0", latest stable is 4.1.4 via npm registry 2026-04-09]`. Current `^3.22.0` is fine for this phase — no need to upgrade.

### Alternatives Considered
| Instead of hand-roll | Could use | Tradeoff |
|------------|-----------|----------|
| Custom percentile() | `simple-statistics@7.8.9` | +50KB bundle, violates zero-dep convention in core, forces us to audit their Workers compat |
| Custom bootstrap | `@stdlib/stats-base-dists-*` | Monorepo complexity, overkill for 1000-resample loop |
| Welford variance | Two-pass `sum`/`sumSq` | Welford is numerically more stable for large n, but we cap repeat at 100; two-pass is fine and easier to property-test |

**Decision:** Hand-roll in `packages/core/src/engine/stats.ts`. Zero runtime deps added.

## Architecture Patterns

### Recommended File Layout

```
packages/core/src/engine/
├── aggregator.ts            # MODIFIED: extend AggregatedTestResult, call stats.ts helpers
├── aggregator.test.ts       # EXTENDED: add pass^k, CI, percentile cases
├── stats.ts                 # NEW: pure numerical helpers (percentile, bootstrap, passK, passAtK, std-dev)
├── stats.test.ts            # NEW: golden values + fast-check property tests
├── runner.ts                # MODIFIED: carry new fields into TestRunResult
└── gate.ts                  # OPTIONAL: gate.ts may want to read lower CI bound for fairness
```

### Pattern 1: Pure Stats Module (zero-I/O, Result types)

```typescript
// packages/core/src/engine/stats.ts
// Source: τ-bench paper (arxiv.org/abs/2406.12045), Anthropic statistical approach paper

/**
 * pass^k — probability that all k independent trials succeed.
 * τ-bench (2024) defines this as the reliability metric for agent evals.
 * Returns p^k where p is per-trial success probability.
 */
export function passK(passCount: number, totalRuns: number, k: number): number {
  if (totalRuns === 0 || k < 1) return 0;
  const p = passCount / totalRuns;
  return Math.pow(p, k);
}

/**
 * pass@k — probability that at least one of k trials succeeds.
 * Complement of all-failing: 1 - (1-p)^k.
 */
export function passAtK(passCount: number, totalRuns: number, k: number): number {
  if (totalRuns === 0 || k < 1) return 0;
  const p = passCount / totalRuns;
  return 1 - Math.pow(1 - p, k);
}

/**
 * Linear-interpolation percentile (NIST-standard method R-7, same as numpy default).
 * Returns NaN when values is empty; caller must handle.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Sample standard deviation (n-1 Bessel correction).
 * Used for per-test variance across repeat runs (REL-04).
 */
export function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const ss = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(ss / (values.length - 1));
}

export interface ConfidenceInterval {
  lo: number;
  hi: number;
  level: 0.95;
  method: "bootstrap-percentile";
  resamples: number;
}

/**
 * Bootstrap 95% CI via percentile method.
 * Anthropic statistical approach paper recommends this for n < 30;
 * for n >= 30 the normal approximation `score ± 1.96 * SEM` is equivalent.
 *
 * B = 1000 is the standard choice: tight enough for 2.5%/97.5% percentile stability,
 * cheap enough to run on every test (1000 * ~5ns per resample ~= 5μs per metric).
 *
 * deterministic: optional seeded RNG for reproducible tests.
 */
export function bootstrapCI(
  values: number[],
  statistic: (sample: number[]) => number,
  opts: { resamples?: number; rng?: () => number } = {},
): ConfidenceInterval {
  const B = opts.resamples ?? 1000;
  const rng = opts.rng ?? Math.random;
  if (values.length === 0) return { lo: 0, hi: 0, level: 0.95, method: "bootstrap-percentile", resamples: B };

  const stats = new Array<number>(B);
  const n = values.length;
  const sample = new Array<number>(n);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) {
      sample[i] = values[Math.floor(rng() * n)];
    }
    stats[b] = statistic(sample);
  }
  stats.sort((a, b) => a - b);
  // Percentile indices for 95% CI: floor(0.025 * B), floor(0.975 * B)
  const loIdx = Math.floor(0.025 * B);
  const hiIdx = Math.floor(0.975 * B) - 1; // 974 for B=1000
  return {
    lo: stats[loIdx],
    hi: stats[hiIdx],
    level: 0.95,
    method: "bootstrap-percentile",
    resamples: B,
  };
}
```

**`[CITED: arxiv.org/abs/2406.12045]` τ-bench pass^k definition.**
**`[CITED: anthropic.com/research/statistical-approach-to-model-evals]` SEM and bootstrap guidance.**
**`[CITED: NIST 1491 engineering statistics handbook, section 7.2.5.2]` R-7 linear-interpolation percentile (same as numpy default, Excel PERCENTILE.INC).**

### Pattern 2: Extended `AggregatedTestResult`

```typescript
// packages/core/src/engine/aggregator.ts — extended type
export interface LatencyStats {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

export interface EfficiencyStats {
  /** Mean cost (USD) per trial. */
  costPerTaskUsd: number;
  /** Mean tokens per trial. */
  tokensPerTask: number;
  /** Mean tool calls per trial (STAT-04). */
  toolCallsPerTask: number;
  /** 95% CI on mean cost. Useful for cost drift detection. */
  costCI: ConfidenceInterval;
}

export interface AggregatedTestResult {
  testCaseName: string;
  modelId: string;
  runCount: number;
  passed: boolean;
  errored: boolean;

  // EXTENDED (STAT-01 + REL-02/03/04)
  passRate: number;
  passRateCI: ConfidenceInterval;       // NEW STAT-01
  passRateStdDev: number;               // NEW REL-04 (sample sigma of per-run pass {0,1})
  passK: number;                        // NEW REL-02 (p^k where k = runCount)
  passAtK: number;                      // NEW REL-03 (1-(1-p)^k where k = runCount)

  assertionScores: Record<string, {
    mean: number;
    min: number;
    max: number;
    stdDev: number;                     // NEW REL-04
    ci: ConfidenceInterval;             // NEW STAT-01
  }>;

  failureCodes: string[];

  // REPLACED: latencyAvgMs -> latency (STAT-02)
  latency: LatencyStats;                // NEW STAT-02

  // RENAMED/EXTENDED (STAT-03 + STAT-04)
  totalCostUsd: number;                 // kept for back-compat
  totalTokens: number;                  // kept for back-compat
  efficiency: EfficiencyStats;          // NEW

  runs: TestCaseRunResult[];
}
```

### Pattern 3: Backwards-Compatible Default Change (REL-01)

```typescript
// packages/core/src/config/schema.ts — line 682
defaults: z
  .object({
    repeat: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(3)  // CHANGED from 1
      .describe(
        "Default repeat count per test case. Set to 3 by default for statistical " +
        "reliability (τ-bench, 2024). For production-critical suites, set to 5-8. " +
        "Explicitly set to 1 to opt out of multi-trial execution."
      ),
```

**Migration note for users:**
- Existing configs without `defaults.repeat` will start running each test 3× instead of 1×. This ~3×s cost and runtime.
- Existing configs with `defaults.repeat: 1` explicitly set are unchanged.
- CHANGELOG.md (added by Phase 27) must call this out prominently with opt-out instructions.
- Gate: Phase 19 implementation MUST add an opt-out path via explicit `defaults.repeat: 1`, and we should add a note when a test runs with repeat=1 that it cannot compute pass^k/CI with meaningful width.

### Anti-Patterns to Avoid
- **`latencyAvgMs` as the only latency field** — mean hides the tail; market research confirms Cobalt already ships p50/p95/p99 `[CITED: .planning/research/v2.4-market-signal.md §1.5]`. Delete it from the reporter output; keep it on the struct for one minor version for back-compat only if needed.
- **Computing percentiles on every reporter call** — compute once in `aggregateRuns`, cache on the struct. Reporters read fields; they do not compute.
- **Bootstrap with B < 500 or > 10000** — B=500 produces visible jitter between runs; B>1000 wastes CPU with no tightening. Lock to 1000 with an escape hatch option for tests.
- **Using population stdev instead of sample stdev** — we always have finite samples; Bessel correction (n-1) is correct.
- **Silent failure on repeat=1 CIs** — with n=1, bootstrap CIs are degenerate ([x, x]). Reporter should render `n=1 (no CI)` not `[0.5, 0.5]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RNG for bootstrap (production) | Cryptographic PRNG | `Math.random` | Bootstrap doesn't need cryptographic randomness; default RNG is Workers-safe and fast |
| RNG for bootstrap tests | `Math.random` | Seeded LCG (15 LOC) or pass `rng` option | Reproducible property tests require determinism |
| Confidence interval on a single point | — | Return degenerate CI + reporter renders "n=1" | Document the limitation; don't invent fake intervals |
| Numerical integration for pass^k | — | `Math.pow(p, k)` | The formula is literally `p^k` |

**Key insight:** The entire Phase 19 math surface is <200 LOC of straightforward arithmetic. Adding any dependency here is net-negative — it costs bundle size, audit burden, Workers-compat risk, and learning cost for a problem we can solve trivially.

## Common Pitfalls

### Pitfall 1: Bootstrap CI jitters between runs
**What goes wrong:** `bootstrapCI` uses `Math.random`, so two consecutive runs on the same data produce slightly different [lo, hi]. This breaks snapshot tests and confuses users comparing run-to-run.
**Why it happens:** Resampling is inherently random; B=1000 still has ~0.5% jitter on the bounds.
**How to avoid:** In unit tests, always pass a seeded RNG. In production reporters, round CI bounds to 3 decimal places — the jitter is below display precision.
**Warning signs:** `aggregator.test.ts` starts flaking; snapshot diffs show `[0.711, 0.889]` vs `[0.712, 0.887]`.

### Pitfall 2: pass^k = 0 whenever any run fails
**What goes wrong:** With repeat=3 and 2/3 passing, pass^3 = (2/3)^3 = 0.296. With 0/3, pass^3 = 0. Users see "0%" and panic.
**Why it happens:** It's mathematically correct — if even one trial failed, the "all k succeed" probability estimate is zero (or a biased-low estimate based on the empirical rate).
**How to avoid:** Reporter should render pass^k *alongside* pass rate and pass@k so the context is clear. Document the metric in docs/metrics.md with a worked example. `[CITED: .planning/research/v2.4-market-signal.md §3.2]` the τ-bench quote "<25% pass^8 in retail" is the canonical example.
**Warning signs:** Users file issues asking why their "90% pass rate" shows "0% pass^3".

### Pitfall 3: Percentile with n < 10 is meaningless
**What goes wrong:** With 3 latency observations, p95 and p99 are essentially the max. Reporting them as "p95 = 4200ms" misleads users.
**Why it happens:** Linear-interpolation on tiny samples collapses to the last element.
**How to avoid:** Reporter should check `runCount` and render `p95 = 4200ms (n=3, insufficient for tail estimation)` when n < 20. The aggregator stores the raw numbers; the reporter decides what to render.
**Warning signs:** p50 == p95 == p99 in output.

### Pitfall 4: Variance of a boolean series
**What goes wrong:** `passRateStdDev` on [1, 1, 0] is `sqrt(0.333) ≈ 0.577`. Looks like noise; is actually the true sample sigma of a Bernoulli series.
**Why it happens:** It's correct — Bernoulli variance `p(1-p)` peaks at 0.5 for p=0.5.
**How to avoid:** Document in docs/metrics.md. Show the formula, show that 0.577 is the expected value for 2/3. Consider reporting as SE instead of stdev (SE = stdev/sqrt(n)) since that's what's actually compared to the mean.
**Warning signs:** User issues of the form "why is my sigma 0.5 when all tests passed 2/3 of the time?"

### Pitfall 5: Default change breaking existing CI pipelines
**What goes wrong:** User has `kindlm test` in CI with 500 tests. Phase 19 ships. Next CI run takes 3× as long and costs 3× as much because of the silent default change.
**Why it happens:** REL-01 is a breaking behavioral change even though no config is invalid.
**How to avoid:**
  1. Change is a minor version bump (v2.4.0), MUST be called out in CHANGELOG as BREAKING BEHAVIOR (per the "users trust us in CI" core value in CLAUDE.md).
  2. When running with implicit default (no `defaults.repeat` in config), emit a one-line notice: `ℹ default repeat=3; set defaults.repeat: 1 to restore v2.3 behavior`.
  3. Docs/metrics.md explains the rationale with τ-bench evidence.
**Warning signs:** Post-release issue flood about CI runtime/cost.

## Code Examples

### Percentile with golden values
```typescript
// packages/core/src/engine/stats.test.ts
// Golden values from numpy 2.0.0: np.percentile([1,2,3,4,5,6,7,8,9,10], [50, 95, 99])
// = array([5.5, 9.55, 9.91])
import { describe, it, expect } from "vitest";
import { percentile } from "./stats.js";

describe("percentile (R-7, matches numpy default)", () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("p50 = 5.5", () => expect(percentile(data, 50)).toBeCloseTo(5.5, 10));
  it("p95 = 9.55", () => expect(percentile(data, 95)).toBeCloseTo(9.55, 10));
  it("p99 = 9.91", () => expect(percentile(data, 99)).toBeCloseTo(9.91, 10));
  it("single value", () => expect(percentile([42], 50)).toBe(42));
  it("empty", () => expect(percentile([], 50)).toBeNaN());
});
```

### Property test: pass^k monotonic in k, pass@k monotonic in k
```typescript
// packages/core/src/engine/stats.test.ts
import { fc, it } from "@fast-check/vitest";
import { passK, passAtK } from "./stats.js";

it.prop([fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 })])(
  "passK is non-increasing in k",
  (totalRuns, passCountRaw) => {
    const passCount = Math.min(passCountRaw, totalRuns);
    const pk1 = passK(passCount, totalRuns, 1);
    const pk5 = passK(passCount, totalRuns, 5);
    return pk5 <= pk1;
  },
);

it.prop([fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 })])(
  "passAtK is non-decreasing in k",
  (totalRuns, passCountRaw) => {
    const passCount = Math.min(passCountRaw, totalRuns);
    const ak1 = passAtK(passCount, totalRuns, 1);
    const ak5 = passAtK(passCount, totalRuns, 5);
    return ak5 >= ak1;
  },
);

it.prop([fc.integer({ min: 1, max: 100 }), fc.integer({ min: 0, max: 100 })])(
  "passK <= passRate <= passAtK",
  (totalRuns, passCountRaw) => {
    const passCount = Math.min(passCountRaw, totalRuns);
    const p = passCount / totalRuns;
    const pk = passK(passCount, totalRuns, totalRuns);
    const ak = passAtK(passCount, totalRuns, totalRuns);
    return pk <= p + 1e-9 && p <= ak + 1e-9;
  },
);
```

### Seeded bootstrap test
```typescript
// Deterministic RNG (mulberry32) for reproducible bootstrap tests.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

it("bootstrap 95% CI on 10-sample uniform is reproducible with seed", () => {
  const data = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const ci1 = bootstrapCI(data, (s) => s.reduce((a, b) => a + b, 0) / s.length, { rng: mulberry32(42) });
  const ci2 = bootstrapCI(data, (s) => s.reduce((a, b) => a + b, 0) / s.length, { rng: mulberry32(42) });
  expect(ci1.lo).toBeCloseTo(ci2.lo, 10);
  expect(ci1.hi).toBeCloseTo(ci2.hi, 10);
  // Golden values will be pinned after first run
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-shot test runs, report pass/fail | Multi-trial (k>=3), report pass^k with CI | τ-bench June 2024, widely adopted 2025-2026 | `[CITED: arxiv.org/abs/2406.12045]` GPT-4o drops from 60%+ pass@1 to <25% pass^8 |
| Mean latency only | p50/p95/p99 percentiles | Cobalt 2026 | `[CITED: .planning/research/v2.4-market-signal.md §1.5]` direct competitor ships per-evaluator p50/p95/p99 |
| Bare point scores (0.82) | `0.82 [0.71, 0.89] (n=5)` | Anthropic statistical approach paper 2025 | `[CITED: anthropic.com/research/statistical-approach-to-model-evals]` SEM-based CIs are the baseline ask for rigor |

**Deprecated/outdated:**
- Reporting only `mean` latency for agent evals — hides tail behavior that determines actual user/CI experience.
- Defaulting repeat to 1 — τ-bench paper shows <25% pass^8 for frontier models; single runs are professionally unacceptable.
- Using normal approximation CIs (`1.96 * SEM`) for small samples (n<30) — bootstrap percentile is the correct default for the typical test-run sample sizes KindLM sees.

## Runtime State Inventory

Not applicable — Phase 19 is a greenfield addition to `@kindlm/core` aggregation logic. No renames, no migrations of stored data, no OS-registered state. The one cross-system touch point is:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — aggregated results live in `.kindlm/last-run.json` and D1 `test_runs`/`test_results` tables; these are append-only and new fields are additive | Plan must add new columns to D1 migration OR serialize via `assertions_json`/new JSON blob column for forward-compat |
| Live service config | **None** | — |
| OS-registered state | **None** | — |
| Secrets/env vars | **None** | — |
| Build artifacts | **None** — all packages are rebuilt on every `npm run build` | — |

**Cloud API note:** The D1 `test_runs` table (schema at `packages/cloud/migrations/`) does NOT currently store pass^k/CI/percentile data. For Phase 19, the MINIMUM requirement is that `kindlm upload` passes a JSON payload that the Cloud API accepts without rejecting new fields. Full D1 schema update for the new metrics is **out of scope for Phase 19** — track as follow-up for Phase 18/Cloud work or add as a Phase 19 sub-task if the user wants cloud parity immediately. The planner should ASK the user.

## Environment Availability

Not applicable — Phase 19 is pure-TypeScript in `@kindlm/core`. No external runtime dependencies, no services, no CLIs beyond the existing `npm`/`vitest`/`tsc` toolchain already in use. All test infrastructure (vitest 3.2.4, fast-check 3.22.0) is already installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 + fast-check 3.22.0 (`[VERIFIED: packages/core/package.json]`) |
| Config file | `/Users/petr/projects/kindlm/vitest.config.ts` (root, shared across workspaces) |
| Quick run command | `npx vitest run packages/core/src/engine/stats.test.ts packages/core/src/engine/aggregator.test.ts` |
| Full suite command | `npm run test` (turbo-orchestrated across all packages) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REL-01 | Default repeat=3 when config omits `defaults.repeat` | unit | `npx vitest run packages/core/src/config/parser.test.ts -t "default repeat"` | parser.test.ts exists; **new test case needed** (Wave 0) |
| REL-02 | `passK` field present and equals `p^k` | unit | `npx vitest run packages/core/src/engine/aggregator.test.ts -t "passK"` | aggregator.test.ts exists; **new case needed** |
| REL-03 | `passAtK` field present and equals `1-(1-p)^k` | unit | `npx vitest run packages/core/src/engine/aggregator.test.ts -t "passAtK"` | aggregator.test.ts exists; **new case needed** |
| REL-04 | Per-test `passRateStdDev` and per-assertion `stdDev` present | unit | `npx vitest run packages/core/src/engine/aggregator.test.ts -t "variance"` | **new case** |
| STAT-01 | Every aggregate score carries `ConfidenceInterval` | unit + property | `npx vitest run packages/core/src/engine/stats.test.ts -t "bootstrap"` | ❌ **Wave 0: create stats.test.ts** |
| STAT-02 | `LatencyStats.{p50,p95,p99}` match golden values | unit | `npx vitest run packages/core/src/engine/stats.test.ts -t "percentile"` | ❌ **Wave 0: create stats.test.ts** |
| STAT-03 | `EfficiencyStats.costPerTaskUsd` + `tokensPerTask` | unit | `npx vitest run packages/core/src/engine/aggregator.test.ts -t "efficiency"` | **new case** |
| STAT-04 | `EfficiencyStats.toolCallsPerTask` | unit | `npx vitest run packages/core/src/engine/aggregator.test.ts -t "tool calls per task"` | **new case** |
| Reporter | Pretty/JSON/JUnit surface new fields | unit + snapshot | `npx vitest run packages/core/src/reporters/` | Snapshots will update; require review |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/engine/` (~2 seconds)
- **Per wave merge:** `npm run test` + `npm run typecheck` (~30-60 seconds)
- **Phase gate:** Full suite green + reporter golden snapshots approved before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/src/engine/stats.ts` — new pure-stats module (implementation)
- [ ] `packages/core/src/engine/stats.test.ts` — golden values for percentile, passK, passAtK; property tests via `@fast-check/vitest`; seeded bootstrap tests (`mulberry32`)
- [ ] Extend `packages/core/src/engine/aggregator.test.ts` — new cases for CI, stdDev, passK, passAtK, latency stats, efficiency stats
- [ ] Extend `packages/core/src/reporters/{pretty,json,junit}.test.ts` — snapshots for new fields
- [ ] Extend `packages/core/src/config/parser.test.ts` — assert default `repeat` is 3 when omitted; assert explicit `1` is preserved
- [ ] (Optional) `docs/metrics.md` (Phase 27 scope per ROADMAP) but a brief inline JSDoc on `stats.ts` is REQUIRED for Phase 19

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so defaulting to enabled per the template.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 19 is pure numerical code, no auth surface |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod schema already validates `defaults.repeat` (`min(1).max(100)`); extend no new untrusted input |
| V6 Cryptography | no | Bootstrap RNG is `Math.random`, intentionally NON-cryptographic; document this in JSDoc to prevent future misuse |
| V10 Malicious Code | yes | No new dependencies = no supply chain exposure added |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Numerical overflow on huge sample sums | Tampering (data corruption) | `sampleStdDev` uses two-pass; cap `repeat` remains at 100 via Zod |
| Bootstrap DoS (large B * large n CPU burn) | Denial of Service | Lock B=1000 as a compile-time constant; `repeat <= 100`; 100*1000 = 100K resamples per metric ~= <10ms |
| Accidental PII leak in variance reporting | Information disclosure | New fields are all scalar (number), no free-text output from stats.ts |

**No new security surface is introduced by Phase 19.** The primary risk is the (non-security) pitfalls listed above — numerical correctness, semantic misinterpretation of metrics, and the breaking-behavior default change.

## Project Constraints (from CLAUDE.md)

Extracted from `/Users/petr/projects/kindlm/CLAUDE.md` and `/Users/petr/projects/kindlm/.claude/CLAUDE.md`:

| Constraint | Impact on Phase 19 |
|------------|---------------------|
| `@kindlm/core` must have zero I/O dependencies — no `fs`, no `fetch`, no `console.log` | `stats.ts` must be pure functions; no logging, no side effects. Verify via ESLint + code review. |
| No classes except error types | Use factory functions / plain functions / interfaces. `stats.ts` exports pure functions — no class needed. |
| Result types over exceptions | Not applicable to the inner math helpers (they take validated numbers). `aggregateRuns` already returns `Result<AggregatedTestResult, string>` — preserve that signature. |
| `verbatimModuleSyntax: true` — `import type` for types | Use `import type { ConfidenceInterval } from "./stats.js"` where applicable. |
| `.js` extension on all relative imports (ESM) | `import { percentile } from "./stats.js"` — NOT `"./stats"`. |
| No `any`, use `unknown` + narrowing | Not applicable — math helpers take `number[]`. |
| One file per concern | `stats.ts` for pure math, `aggregator.ts` for aggregation orchestration. Do not bundle bootstrap into aggregator.ts. |
| Barrel exports per directory | `packages/core/src/engine/index.ts` must re-export new public types (`ConfidenceInterval`, `LatencyStats`, `EfficiencyStats`). |
| No classes except `ProviderError extends Error` | (See above — no classes needed.) |
| Workers-compat in cloud (types only from core) | New types must be pure TypeScript (no runtime values imported across package boundary). `ConfidenceInterval` as `interface` satisfies this. |
| Run `npx tsc --noEmit && npx eslint . --quiet` after changes | Task-level verification step; non-negotiable. |
| Start work via GSD command | Planner already operating inside GSD flow. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hand-rolling stats primitives is preferred over `simple-statistics` | Standard Stack | Low — if user prefers a dep, it's a 1-line swap. Noted as a decision to confirm. |
| A2 | D1 schema update (persisting new metrics to cloud) is **out of Phase 19 scope** | Runtime State Inventory | Medium — if user wants cloud parity immediately, Phase 19 needs an extra plan/wave. Planner should ASK. |
| A3 | B=1000 bootstrap resamples is the right default for B | Pattern 1 | Low — well-established choice; bounded by property tests and cost analysis above. |
| A4 | Linear-interpolation percentile (R-7/numpy default) is the right method | Pattern 1 | Low — matches user mental model via numpy/Excel; alternative methods (R-4..R-9) differ <1% on typical samples. |
| A5 | Reporter output format for CIs is `0.82 [0.71, 0.89] (n=5)` | Pitfalls | Low — cosmetic, easy to change in plan stage. |
| A6 | Default `repeat` should change from 1 to 3 in `v2.4.0` (a minor version) despite behavioral change | Pattern 3 | **MEDIUM — user should confirm.** Semver-conservative readers would call this a major bump. REQUIREMENTS.md has it locked as REL-01, so treating it as approved. |
| A7 | No new runtime dependencies need to be added to `@kindlm/core` | Standard Stack | Low — confirmed via constraints in CLAUDE.md. |
| A8 | `fast-check` 3.22.0 is sufficient (no upgrade to 4.x needed for Phase 19) | Standard Stack | Low — fast-check 3.x has `it.prop` via `@fast-check/vitest`; confirm this plugin is already installed or add to devDeps. Planner to verify. |
| A9 | `@fast-check/vitest` (plugin) is installed alongside `fast-check` | Code Examples | **MEDIUM — planner must verify.** If not installed, Wave 0 must add `@fast-check/vitest` as devDep or use standard `fast-check` patterns with manual `describe`/`it`. |

## Open Questions

1. **Cloud parity for new metrics.** Should Phase 19 also ship a D1 migration + Cloud API update + Dashboard render for the new pass^k/CI/percentile fields? ROADMAP lists Phase 18 as done and doesn't explicitly scope cloud updates into Phase 19.
   - What we know: D1 schema stores `pass_rate`, `duration_ms`, `assertions_json`; nothing for percentiles/CIs/pass^k.
   - What's unclear: Whether `kindlm upload` JSON payload is strict (would reject new fields) or lenient (stores as opaque JSON).
   - Recommendation: **Plan scope restricted to `@kindlm/core` + CLI reporter surface.** Add follow-up task tagged `[follow-up]` for Cloud parity. User confirmation via discuss-phase recommended.

2. **Gate integration.** Should gates (`gate.ts`) use lower CI bound or point estimate for `passRateMin`?
   - What we know: Current `gate.ts` uses point `passRate`.
   - What's unclear: Whether reading `passRateCI.lo` (conservative) would break existing user configs that are tuned to point passRate.
   - Recommendation: **Keep current gate behavior in Phase 19** (use point passRate). Add "conservative gating" as a follow-up feature. Document in docs/metrics.md.

3. **Reporter verbosity — default vs --verbose.** With 8 new metrics per test (passK, passAtK, stdDev, CI, p50, p95, p99, toolCallsPerTask), the pretty reporter could become noisy.
   - What we know: Pretty reporter currently prints assertions + latency + cost per test.
   - What's unclear: User preference for default-verbose vs `--verbose` gate for the new fields.
   - Recommendation: Planner should **draft two reporter layouts** (compact vs expanded) and let user choose in discuss-phase OR default to expanded and add `--compact` later.

4. **`@fast-check/vitest` dependency status.** Does the repo already have this installed?
   - Recommendation: Planner runs `grep "@fast-check/vitest" packages/core/package.json` as the first verification step. If missing, add to devDeps in task 1.

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: packages/core/src/engine/aggregator.ts]` — current aggregator has only `latencyAvgMs`, no CIs, no percentiles, no pass^k
- `[VERIFIED: packages/core/src/config/schema.ts:682]` — default `repeat: 1` confirmed
- `[VERIFIED: packages/core/package.json]` — fast-check 3.22.0, vitest 3.2.4 in devDeps; no simple-statistics
- `[VERIFIED: .planning/REQUIREMENTS.md]` — REL-01..04, STAT-01..04 are locked requirements
- `[VERIFIED: .planning/ROADMAP.md Phase 19 section]` — success criteria confirmed
- `[VERIFIED: CLAUDE.md]` — zero-I/O + no-classes + Result-types + `.js`-extensions constraints
- `[CITED: arxiv.org/abs/2406.12045]` τ-bench paper — pass^k definition, <25% retail pass^8 finding
- `[CITED: anthropic.com/research/statistical-approach-to-model-evals]` — SEM + bootstrap + clustered errors
- `[CITED: .planning/research/v2.4-market-signal.md §3.2, §3.5, §3.6]` — canonical stack, formulas, sample sizes
- `[VERIFIED: npm view fast-check version = 4.1.4 (latest), 3.22.0 acceptable]` — stable
- `[VERIFIED: npm view vitest version = 4.6.0 (latest), 3.2.4 acceptable]` — stable

### Secondary (MEDIUM confidence)
- NIST handbook 7.2.5.2 (R-7 percentile method) — matches numpy default; unambiguous
- Cobalt competitor ships p50/p95/p99 per evaluator `[CITED: .planning/research/v2.4-market-signal.md §1.5]`

### Tertiary (LOW confidence)
- `@fast-check/vitest` plugin installation status — planner must verify
- Cloud D1 schema forward-compat for new JSON fields — not directly verified in this research

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — constraints explicit in CLAUDE.md, all deps verified in package.json
- Architecture (stats.ts split, extended AggregatedTestResult): HIGH — minimal, obvious, follows existing codebase conventions
- Formulas (passK, passAtK, percentile, bootstrap, stdDev): HIGH — textbook, cited to τ-bench / Anthropic / NIST
- Default change migration: MEDIUM — needs user confirmation that v2.4.0 minor bump is acceptable for this behavioral change
- Cloud D1 scope boundary: MEDIUM — planner should confirm with user

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days; stack is stable, only risk is fast-check / vitest minor bumps which don't affect the API surface used)
