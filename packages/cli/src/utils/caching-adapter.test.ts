import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the cache module before importing the adapter
vi.mock("./cache.js", () => ({
  computeCacheKey: vi.fn().mockReturnValue("test-cache-key"),
  readCacheEntry: vi.fn().mockReturnValue(null),
  writeCacheEntry: vi.fn(),
}));

import { createCachingAdapter } from "./caching-adapter.js";
import { computeCacheKey, readCacheEntry, writeCacheEntry } from "./cache.js";
import type { ProviderAdapter, ProviderResponse, ProviderRequest } from "@kindlm/core";
import type { CacheEntry } from "./cache.js";

const mockComputeCacheKey = vi.mocked(computeCacheKey);
const mockReadCacheEntry = vi.mocked(readCacheEntry);
const mockWriteCacheEntry = vi.mocked(writeCacheEntry);

function makeResponse(overrides: Partial<ProviderResponse> = {}): ProviderResponse {
  return {
    text: "hello world",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    raw: {},
    latencyMs: 200,
    modelId: "gpt-4o",
    finishReason: "stop",
    ...overrides,
  };
}

function makeRequest(): ProviderRequest {
  return {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    params: { temperature: 0, maxTokens: 1024 },
  };
}

function makeMockAdapter(responseOverrides: Partial<ProviderResponse> = {}): ProviderAdapter {
  return {
    name: "mock",
    initialize: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(makeResponse(responseOverrides)),
    estimateCost: vi.fn().mockReturnValue(0.001),
    supportsTools: vi.fn().mockReturnValue(true),
  };
}

describe("createCachingAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockComputeCacheKey.mockReturnValue("test-cache-key");
    mockReadCacheEntry.mockReturnValue(null);
  });

  // ============================================================
  // Cache miss → calls inner adapter
  // ============================================================

  it("calls inner adapter on cache miss", async () => {
    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);

    const result = await adapter.complete(makeRequest());
    expect(inner.complete).toHaveBeenCalledOnce();
    expect(result.text).toBe("hello world");
  });

  it("writes successful text response to cache", async () => {
    const inner = makeMockAdapter({ text: "some text", finishReason: "stop" });
    const adapter = createCachingAdapter(inner);

    await adapter.complete(makeRequest());
    expect(mockWriteCacheEntry).toHaveBeenCalledOnce();
  });

  it("writes successful tool-call-only response to cache", async () => {
    const inner = makeMockAdapter({
      text: "",
      toolCalls: [{ id: "1", name: "search", arguments: {}, index: 0 }],
      finishReason: "tool_calls",
    });
    const adapter = createCachingAdapter(inner);

    await adapter.complete(makeRequest());
    expect(mockWriteCacheEntry).toHaveBeenCalledOnce();
  });

  it("does NOT write fromCache on cache miss (live response)", async () => {
    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);

    const result = await adapter.complete(makeRequest());
    expect(result.fromCache).toBeUndefined();
  });

  // ============================================================
  // Error guard — do NOT cache error responses
  // ============================================================

  it("does NOT write to cache when finishReason is 'error'", async () => {
    const inner = makeMockAdapter({ finishReason: "error", text: "error message" });
    const adapter = createCachingAdapter(inner);

    await adapter.complete(makeRequest());
    expect(mockWriteCacheEntry).not.toHaveBeenCalled();
  });

  it("does NOT cache error response even on second call (adapter called again)", async () => {
    const inner = makeMockAdapter({ finishReason: "error", text: "error text" });
    const adapter = createCachingAdapter(inner);

    await adapter.complete(makeRequest());
    await adapter.complete(makeRequest());

    // Inner adapter called twice since nothing was written to cache
    expect(inner.complete).toHaveBeenCalledTimes(2);
  });

  // ============================================================
  // Empty response guard — do NOT cache empty responses
  // ============================================================

  it("does NOT write to cache when text is empty and toolCalls is empty", async () => {
    const inner = makeMockAdapter({ text: "", toolCalls: [], finishReason: "stop" });
    const adapter = createCachingAdapter(inner);

    await adapter.complete(makeRequest());
    expect(mockWriteCacheEntry).not.toHaveBeenCalled();
  });

  // ============================================================
  // Cache hit → returns cached response with fromCache: true
  // ============================================================

  it("returns cached response on cache hit", async () => {
    const cachedResponse = makeResponse({ text: "cached response", latencyMs: 500 });
    const entry: CacheEntry = {
      response: cachedResponse,
      cachedAt: new Date().toISOString(),
    };
    mockReadCacheEntry.mockReturnValue(entry);

    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);

    const result = await adapter.complete(makeRequest());
    expect(inner.complete).not.toHaveBeenCalled();
    expect(result.text).toBe("cached response");
  });

  it("sets fromCache: true on cache hit", async () => {
    const cachedResponse = makeResponse({ text: "cached response" });
    const entry: CacheEntry = {
      response: cachedResponse,
      cachedAt: new Date().toISOString(),
    };
    mockReadCacheEntry.mockReturnValue(entry);

    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);

    const result = await adapter.complete(makeRequest());
    expect(result.fromCache).toBe(true);
  });

  it("sets latencyMs to 0 on cache hit", async () => {
    const cachedResponse = makeResponse({ latencyMs: 999 });
    const entry: CacheEntry = {
      response: cachedResponse,
      cachedAt: new Date().toISOString(),
    };
    mockReadCacheEntry.mockReturnValue(entry);

    const adapter = createCachingAdapter(makeMockAdapter());
    const result = await adapter.complete(makeRequest());
    expect(result.latencyMs).toBe(0);
  });

  // ============================================================
  // Passthrough methods
  // ============================================================

  it("delegates initialize to inner adapter", async () => {
    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);
    await adapter.initialize({ apiKey: "key", timeoutMs: 5000, maxRetries: 3 });
    expect(inner.initialize).toHaveBeenCalledOnce();
  });

  it("delegates estimateCost to inner adapter", () => {
    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);
    const cost = adapter.estimateCost("gpt-4o", { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
    expect(inner.estimateCost).toHaveBeenCalledOnce();
    expect(cost).toBe(0.001);
  });

  it("delegates supportsTools to inner adapter", () => {
    const inner = makeMockAdapter();
    const adapter = createCachingAdapter(inner);
    const result = adapter.supportsTools("gpt-4o");
    expect(inner.supportsTools).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it("exposes name from inner adapter", () => {
    const adapter = createCachingAdapter(makeMockAdapter());
    expect(adapter.name).toBe("mock");
  });
});
