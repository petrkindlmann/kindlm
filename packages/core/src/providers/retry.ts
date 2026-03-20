export interface RetryOptions {
  maxRetries: number;
  shouldRetry: (error: unknown) => boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  getRetryAfterMs?: (error: unknown) => number | undefined;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    shouldRetry,
    baseDelayMs = 500,
    maxDelayMs = 30_000,
    getRetryAfterMs,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }
      const retryAfterMs = getRetryAfterMs?.(error);
      const delay = computeRetryDelayMs({
        attempt,
        baseDelayMs,
        maxDelayMs,
        retryAfterMs,
      });
      await sleep(delay);
    }
  }

  throw lastError;
}

export function computeRetryDelayMs(options: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryAfterMs?: number;
}): number {
  const { attempt, baseDelayMs, maxDelayMs, retryAfterMs } = options;
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return retryAfterMs;
  }
  const cap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  return Math.max(Math.floor(baseDelayMs / 2), Math.floor(Math.random() * cap));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
