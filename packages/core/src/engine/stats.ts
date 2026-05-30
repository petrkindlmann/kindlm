// Pure statistical primitives for reliability metrics (Phase 19).
//
// Zero I/O, zero runtime dependencies — only vanilla TypeScript arithmetic.
// Formulas map to established references:
//   - pass^k / pass@k: τ-bench (arxiv.org/abs/2406.12045)
//   - percentile: NIST R-7 linear interpolation (numpy default)
//   - bootstrap CI: Anthropic statistical approach to model evals (percentile method)

/**
 * pass^k — probability that all k independent trials succeed.
 *
 * τ-bench (arxiv.org/abs/2406.12045) defines this as the reliability metric for
 * agent evals. Returns p^k where p = passCount / totalRuns.
 *
 * Guards `totalRuns === 0 || k < 1` → returns 0 (not NaN).
 */
export function passK(passCount: number, totalRuns: number, k: number): number {
  if (totalRuns === 0 || k < 1) return 0;
  const p = passCount / totalRuns;
  return Math.pow(p, k);
}

/**
 * pass@k — probability that at least one of k trials succeeds.
 *
 * Complement of all-failing: 1 - (1-p)^k where p = passCount / totalRuns.
 *
 * Guards `totalRuns === 0 || k < 1` → returns 0 (not NaN).
 */
export function passAtK(passCount: number, totalRuns: number, k: number): number {
  if (totalRuns === 0 || k < 1) return 0;
  const p = passCount / totalRuns;
  return 1 - Math.pow(1 - p, k);
}

/**
 * Linear-interpolation percentile, NIST method R-7 (same as numpy default,
 * Excel PERCENTILE.INC).
 *
 * `p` is expressed as a percentage in [0, 100]. Returns NaN for empty input;
 * caller must check. A single-element array returns that element directly
 * (no interpolation).
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  if (values.length === 1) return values[0] as number;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = sorted[lo] as number;
  if (lo === hi) return loVal;
  const hiVal = sorted[hi] as number;
  const frac = rank - lo;
  return loVal * (1 - frac) + hiVal * frac;
}

/**
 * Sample standard deviation with Bessel correction (n-1).
 *
 * Used for per-test variance across repeat runs (REL-04). Returns 0 for n < 2
 * (no variance can be estimated from fewer than two observations).
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
 * Bootstrap 95% CI via the percentile method (B=1000 by default).
 *
 * Anthropic's statistical-approach-to-model-evals recommends this for n < 30;
 * for n >= 30 the normal approximation `score ± 1.96 * SEM` is equivalent.
 *
 * B = 1000 is the standard choice: tight enough for 2.5%/97.5% percentile
 * stability, cheap enough to run on every test.
 *
 * Randomness: uses `Math.random()` by default. This is INTENTIONALLY
 * NON-cryptographic — bootstrap resampling does not require cryptographic
 * randomness, and `Math.random` is Workers-safe and fast. Do NOT reuse this
 * RNG for any security-sensitive purpose. For reproducible tests, pass a
 * seeded rng via `opts.rng`.
 */
export function bootstrapCI(
  values: number[],
  statistic: (sample: number[]) => number,
  opts: { resamples?: number; rng?: () => number } = {},
): ConfidenceInterval {
  const B = opts.resamples ?? 1000;
  const rng = opts.rng ?? Math.random;
  if (values.length === 0) {
    return { lo: 0, hi: 0, level: 0.95, method: "bootstrap-percentile", resamples: B };
  }

  const stats = new Array<number>(B);
  const n = values.length;
  const sample = new Array<number>(n);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) {
      sample[i] = values[Math.floor(rng() * n)] as number;
    }
    stats[b] = statistic(sample);
  }
  stats.sort((a, b) => a - b);
  // Percentile indices for a 95% CI: floor(0.025 * B), floor(0.975 * B) - 1.
  const loIdx = Math.floor(0.025 * B);
  const hiIdx = Math.floor(0.975 * B) - 1; // 974 for B=1000
  return {
    lo: stats[loIdx] as number,
    hi: stats[hiIdx] as number,
    level: 0.95,
    method: "bootstrap-percentile",
    resamples: B,
  };
}
