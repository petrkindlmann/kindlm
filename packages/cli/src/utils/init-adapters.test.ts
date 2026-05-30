import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  KindLMConfig,
} from "@kindlm/core";

// --- Mock the HTTP client (init-adapters constructs one eagerly) ---
vi.mock("./http.js", () => ({
  createHttpClient: () => ({}) as unknown,
}));

// --- Mock @kindlm/core's createProvider with a counter-incrementing fake ---
// Each `complete()` call returns a strictly higher counter in its text, so two
// consecutive calls against an UNCACHED adapter must differ. If a caching layer
// were (incorrectly) wrapped under --no-cache, the second call would replay the
// first cached value and the counter would NOT advance.
let providerCounter = 0;

function makeCounterAdapter(name: string): ProviderAdapter {
  return {
    name,
    initialize: vi.fn().mockResolvedValue(undefined),
    async complete(_request: ProviderRequest): Promise<ProviderResponse> {
      providerCounter += 1;
      return {
        text: `response-${providerCounter}`,
        toolCalls: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        latencyMs: 1,
        modelId: name,
        finishReason: "stop",
        raw: {},
      };
    },
    estimateCost: () => null,
    supportsTools: () => false,
  };
}

vi.mock("@kindlm/core", () => ({
  createProvider: vi.fn((name: string) => makeCounterAdapter(name)),
}));

// --- In-memory cache so the default (cached) path is observable without fs ---
// The real cache.ts is backed by the filesystem; we replace it with a Map so
// the contrast assertion (caching ON => second call replays first response)
// is deterministic and I/O-free.
const memoryCache = new Map<string, { response: ProviderResponse }>();

vi.mock("./cache.js", () => ({
  computeCacheKey: (request: ProviderRequest) => JSON.stringify(request),
  readCacheEntry: (key: string) => memoryCache.get(key) ?? null,
  writeCacheEntry: (key: string, response: ProviderResponse) => {
    memoryCache.set(key, { response });
  },
}));

// Import AFTER mocks are registered.
const { initProviderAdapters } = await import("./init-adapters.js");

function fakeConfig(): KindLMConfig {
  return {
    providers: {
      // `ollama` is exempt from the apiKeyEnv requirement (init-adapters.ts),
      // so no real API key / env var is needed to construct it.
      ollama: { apiKeyEnv: undefined },
    },
    defaults: { timeoutMs: 1000 },
  } as unknown as KindLMConfig;
}

function sameRequest(): ProviderRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "hi" }],
    params: { temperature: 0, maxTokens: 16 },
  };
}

describe("initProviderAdapters --no-cache cache-read bypass (ROADMAP #6)", () => {
  beforeEach(() => {
    providerCounter = 0;
    memoryCache.clear();
  });

  it("bypasses cache reads when noCache is set: two identical calls return DISTINCT responses", async () => {
    const adapters = await initProviderAdapters(fakeConfig(), { noCache: true });
    const adapter = adapters.get("ollama");
    expect(adapter).toBeDefined();

    const first = await adapter!.complete(sameRequest());
    const second = await adapter!.complete(sameRequest());

    // Counter advanced on BOTH calls => no cache layer intercepted the second.
    expect(first.text).toBe("response-1");
    expect(second.text).toBe("response-2");
    expect(second.text).not.toBe(first.text);

    // The adapter under --no-cache is the bare provider, never wrapped:
    // it does not carry the caching layer's fromCache flag.
    expect(second.fromCache).toBeUndefined();
  });

  it("contrast: with caching enabled, the same request replays the first (cached) response", async () => {
    const adapters = await initProviderAdapters(fakeConfig(), {
      noCache: false,
    });
    const adapter = adapters.get("ollama");
    expect(adapter).toBeDefined();

    const first = await adapter!.complete(sameRequest());
    const second = await adapter!.complete(sameRequest());

    // Second call is a cache HIT: same text as first, counter did NOT advance.
    expect(first.text).toBe("response-1");
    expect(second.text).toBe("response-1");
    expect(second.fromCache).toBe(true);
  });
});
