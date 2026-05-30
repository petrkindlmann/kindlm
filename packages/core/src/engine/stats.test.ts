import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  passK,
  passAtK,
  percentile,
  sampleStdDev,
  bootstrapCI,
} from "./stats.js";

/** Mulberry32 seeded RNG for reproducible bootstrap tests. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (s: number[]): number => s.reduce((a, b) => a + b, 0) / s.length;

describe("percentile (R-7, matches numpy default)", () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("p50 = 5.5", () => expect(percentile(data, 50)).toBeCloseTo(5.5, 10));
  it("p95 = 9.55", () => expect(percentile(data, 95)).toBeCloseTo(9.55, 10));
  it("p99 = 9.91", () => expect(percentile(data, 99)).toBeCloseTo(9.91, 10));
  it("p0 returns min", () => expect(percentile(data, 0)).toBe(1));
  it("p100 returns max", () => expect(percentile(data, 100)).toBe(10));
  it("single value returns that value", () =>
    expect(percentile([42], 50)).toBe(42));
  it("empty returns NaN", () => expect(percentile([], 50)).toBeNaN());
  it("does not mutate input", () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("passK", () => {
  it("p^k for 2/3 over 3 runs ≈ 0.296", () =>
    expect(passK(2, 3, 3)).toBeCloseTo((2 / 3) ** 3, 10));
  it("p^1 equals pass rate", () =>
    expect(passK(2, 3, 1)).toBeCloseTo(2 / 3, 10));
  it("all passing yields 1", () => expect(passK(3, 3, 3)).toBe(1));
  it("none passing yields 0", () => expect(passK(0, 3, 3)).toBe(0));
  it("zero totalRuns returns 0", () => expect(passK(0, 0, 3)).toBe(0));
  it("k < 1 returns 0", () => expect(passK(2, 3, 0)).toBe(0));
});

describe("passAtK", () => {
  it("1-(1-p)^k for 2/3 over 3 runs ≈ 0.963", () =>
    expect(passAtK(2, 3, 3)).toBeCloseTo(1 - (1 / 3) ** 3, 10));
  it("at k=1 equals pass rate", () =>
    expect(passAtK(2, 3, 1)).toBeCloseTo(2 / 3, 10));
  it("all passing: passAtK = 1", () => expect(passAtK(3, 3, 3)).toBe(1));
  it("none passing: passAtK = 0", () => expect(passAtK(0, 3, 3)).toBe(0));
  it("zero totalRuns returns 0", () => expect(passAtK(0, 0, 3)).toBe(0));
  it("k < 1 returns 0", () => expect(passAtK(2, 3, 0)).toBe(0));
});

describe("sampleStdDev", () => {
  it("constant series = 0", () => expect(sampleStdDev([1, 1, 1])).toBe(0));
  it("n < 2 = 0", () => expect(sampleStdDev([1])).toBe(0));
  it("empty = 0", () => expect(sampleStdDev([])).toBe(0));
  it("[0, 1] series = sqrt(0.5) ≈ 0.707", () =>
    expect(sampleStdDev([0, 1])).toBeCloseTo(Math.SQRT1_2, 10));
  it("Bessel correction: [2,4,4,4,5,5,7,9] = 2.138", () =>
    // population sigma is 2.0; sample sigma with n-1 is sqrt(32/7).
    expect(sampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(
      Math.sqrt(32 / 7),
      10,
    ));
});

describe("bootstrapCI", () => {
  const data = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  it("same seed = same result (reproducible)", () => {
    const ci1 = bootstrapCI(data, mean, { rng: mulberry32(42) });
    const ci2 = bootstrapCI(data, mean, { rng: mulberry32(42) });
    expect(ci1.lo).toBeCloseTo(ci2.lo, 10);
    expect(ci1.hi).toBeCloseTo(ci2.hi, 10);
  });

  it("carries metadata (level, method, resamples)", () => {
    const ci = bootstrapCI(data, mean, { rng: mulberry32(7) });
    expect(ci.level).toBe(0.95);
    expect(ci.method).toBe("bootstrap-percentile");
    expect(ci.resamples).toBe(1000);
  });

  it("honors custom resamples count", () => {
    const ci = bootstrapCI(data, mean, { resamples: 200, rng: mulberry32(7) });
    expect(ci.resamples).toBe(200);
  });

  it("empty values produces degenerate {lo:0, hi:0}", () => {
    const ci = bootstrapCI([], mean, { rng: mulberry32(1) });
    expect(ci.lo).toBe(0);
    expect(ci.hi).toBe(0);
  });

  it("lo <= hi always", () => {
    const ci = bootstrapCI(data, mean, { rng: mulberry32(123) });
    expect(ci.lo).toBeLessThanOrEqual(ci.hi);
  });

  it("mean of [0..1] uniform CI contains 0.5", () => {
    const ci = bootstrapCI(data, mean, { rng: mulberry32(42) });
    expect(ci.lo).toBeLessThanOrEqual(0.5);
    expect(ci.hi).toBeGreaterThanOrEqual(0.5);
  });
});

// Vanilla fast-check property tests (no @fast-check/vitest plugin).
describe("property: passK is non-increasing in k", () => {
  it("passK(p, n, k1) >= passK(p, n, k2) for k1 < k2", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (totalRuns, passCountRaw) => {
          const passCount = Math.min(passCountRaw, totalRuns);
          return (
            passK(passCount, totalRuns, 1) >=
            passK(passCount, totalRuns, 5) - 1e-9
          );
        },
      ),
    );
  });
});

describe("property: passAtK is non-decreasing in k", () => {
  it("passAtK(p, n, k1) <= passAtK(p, n, k2) for k1 < k2", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (totalRuns, passCountRaw) => {
          const passCount = Math.min(passCountRaw, totalRuns);
          return (
            passAtK(passCount, totalRuns, 5) >=
            passAtK(passCount, totalRuns, 1) - 1e-9
          );
        },
      ),
    );
  });
});

describe("property: passK <= passRate <= passAtK sandwich", () => {
  it("at k = n, passK <= passRate <= passAtK", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (totalRuns, passCountRaw) => {
          const passCount = Math.min(passCountRaw, totalRuns);
          const p = passCount / totalRuns;
          const pk = passK(passCount, totalRuns, totalRuns);
          const ak = passAtK(passCount, totalRuns, totalRuns);
          return pk <= p + 1e-9 && p <= ak + 1e-9;
        },
      ),
    );
  });
});
