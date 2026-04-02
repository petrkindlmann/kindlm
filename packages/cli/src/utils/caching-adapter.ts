import type {
  ProviderAdapter,
  ProviderAdapterConfig,
  ProviderRequest,
  ProviderResponse,
} from "@kindlm/core";
import { computeCacheKey, readCacheEntry, writeCacheEntry } from "./cache.js";

/**
 * Wraps a ProviderAdapter with response caching.
 * Cache hits return instantly with latencyMs set to 0 and fromCache: true.
 * Cache misses call through to the real adapter and store the result,
 * but only when the response is cacheable (not an error, not empty).
 *
 * Uses factory function pattern (no classes).
 */
export function createCachingAdapter(inner: ProviderAdapter): ProviderAdapter {
  let _cacheHits = 0;
  let _cacheMisses = 0;

  return {
    get name() {
      return inner.name;
    },

    initialize(config: ProviderAdapterConfig): Promise<void> {
      return inner.initialize(config);
    },

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const key = computeCacheKey(request);
      const cached = readCacheEntry(key);

      if (cached) {
        _cacheHits++;
        // Return cached response with zeroed latency and fromCache flag
        return {
          ...cached.response,
          latencyMs: 0,
          fromCache: true,
        };
      }

      _cacheMisses++;
      const response = await inner.complete(request);

      // Guard: only cache responses that carry real content
      const isCacheable =
        response.finishReason !== "error" &&
        (response.text !== "" || response.toolCalls.length > 0);

      if (isCacheable) {
        try {
          writeCacheEntry(key, response);
        } catch {
          // Cache write failures are silently ignored
        }
      }

      return response;
    },

    estimateCost(
      model: string,
      usage: ProviderResponse["usage"],
    ): number | null {
      return inner.estimateCost(model, usage);
    },

    supportsTools(model: string): boolean {
      return inner.supportsTools(model);
    },

    embed: inner.embed
      ? (text: string, model?: string) => inner.embed?.(text, model) ?? Promise.resolve([])
      : undefined,
  };
}

/**
 * Returns cache statistics for logging/reporting.
 */
export function getCacheStats(_adapter: ProviderAdapter): {
  hits: number;
  misses: number;
} | null {
  // The caching adapter tracks stats in its closure.
  // This function exists as a placeholder for future instrumentation.
  return null;
}
