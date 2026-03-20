import { describe, it, expect, vi } from "vitest";
import { withRetry, computeRetryDelayMs } from "./retry.js";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => true,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => true,
      baseDelayMs: 1,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately for non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(
      withRetry(fn, {
        maxRetries: 3,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("transient"));
    await expect(
      withRetry(fn, {
        maxRetries: 2,
        shouldRetry: () => true,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow("transient");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("uses exponential backoff", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => true,
      baseDelayMs: 100,
    });

    // First retry: 100ms * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Second retry: 100ms * 2^1 = 200ms
    await vi.advanceTimersByTimeAsync(200);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("only retries when shouldRetry returns true", async () => {
    const retryableError = new Error("retryable");
    const fatalError = new Error("fatal");

    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(fatalError);

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        shouldRetry: (err) => err === retryableError,
        baseDelayMs: 1,
      }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("computeRetryDelayMs", () => {
  it("delay is always >= baseDelayMs / 2 (floor check)", () => {
    // Run many times to test the randomized jitter floor
    for (let i = 0; i < 100; i++) {
      const delay = computeRetryDelayMs({
        attempt: 0,
        baseDelayMs: 100,
        maxDelayMs: 30000,
      });
      expect(delay).toBeGreaterThanOrEqual(50); // baseDelayMs / 2
    }
  });

  it("retryAfterMs overrides jitter calculation", () => {
    const delay = computeRetryDelayMs({
      attempt: 0,
      baseDelayMs: 100,
      maxDelayMs: 30000,
      retryAfterMs: 5000,
    });
    expect(delay).toBe(5000);
  });

  it("retryAfterMs of 0 falls through to jitter", () => {
    const delay = computeRetryDelayMs({
      attempt: 0,
      baseDelayMs: 100,
      maxDelayMs: 30000,
      retryAfterMs: 0,
    });
    // Should use jitter since retryAfterMs is not > 0
    expect(delay).toBeGreaterThanOrEqual(50);
    expect(delay).toBeLessThanOrEqual(30000);
  });

  it("delay does not exceed maxDelayMs", () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = 0; i < 10; i++) {
        const delay = computeRetryDelayMs({
          attempt,
          baseDelayMs: 500,
          maxDelayMs: 2000,
        });
        expect(delay).toBeLessThanOrEqual(2000);
      }
    }
  });

  it("higher attempts can produce larger delays up to the cap", () => {
    // With attempt=0, cap = min(30000, 500 * 2^0) = 500
    // With attempt=5, cap = min(30000, 500 * 2^5) = 16000
    // Collect a range of delays for high attempt count
    const delaysAttempt0: number[] = [];
    const delaysAttempt5: number[] = [];
    for (let i = 0; i < 200; i++) {
      delaysAttempt0.push(
        computeRetryDelayMs({ attempt: 0, baseDelayMs: 500, maxDelayMs: 30000 }),
      );
      delaysAttempt5.push(
        computeRetryDelayMs({ attempt: 5, baseDelayMs: 500, maxDelayMs: 30000 }),
      );
    }
    const maxAt0 = Math.max(...delaysAttempt0);
    const maxAt5 = Math.max(...delaysAttempt5);
    // Higher attempt should allow higher delays (probabilistically)
    expect(maxAt5).toBeGreaterThanOrEqual(maxAt0);
  });

  it("retryAfterMs can exceed maxDelayMs (server says wait longer)", () => {
    const delay = computeRetryDelayMs({
      attempt: 0,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      retryAfterMs: 5000,
    });
    // retryAfterMs is returned directly, even if > maxDelayMs
    expect(delay).toBe(5000);
  });
});
