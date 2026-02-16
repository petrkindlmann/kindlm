import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.js";

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
