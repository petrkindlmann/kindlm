import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Mock node:fs so we don't touch the real filesystem
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Import after mocking
import {
  computeCacheKey,
  readCacheEntry,
  writeCacheEntry,
  deepSortKeys,
  getCacheTtlMs,
  type CacheEntry,
} from "./cache.js";
import type { ProviderRequest, ProviderResponse } from "@kindlm/core";

const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

function makeRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "gpt-4o",
    messages: [{ role: "user", content: "hello" }],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

function makeResponse(overrides: Partial<ProviderResponse> = {}): ProviderResponse {
  return {
    text: "hello world",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    raw: {},
    latencyMs: 100,
    modelId: "gpt-4o",
    finishReason: "stop",
    ...overrides,
  };
}

// ============================================================
// deepSortKeys
// ============================================================

describe("deepSortKeys", () => {
  it("sorts top-level object keys alphabetically", () => {
    expect(deepSortKeys({ b: 1, a: 2 })).toEqual({ a: 2, b: 1 });
  });

  it("sorts nested object keys recursively", () => {
    expect(deepSortKeys({ b: { d: 1, c: 2 }, a: 3 })).toEqual({
      a: 3,
      b: { c: 2, d: 1 },
    });
  });

  it("sorts objects within arrays", () => {
    expect(deepSortKeys([{ b: 1, a: 2 }])).toEqual([{ a: 2, b: 1 }]);
  });

  it("returns null unchanged", () => {
    expect(deepSortKeys(null)).toBeNull();
  });

  it("returns numbers unchanged", () => {
    expect(deepSortKeys(42)).toBe(42);
  });

  it("returns strings unchanged", () => {
    expect(deepSortKeys("hello")).toBe("hello");
  });

  it("returns booleans unchanged", () => {
    expect(deepSortKeys(true)).toBe(true);
  });

  it("handles deeply nested objects", () => {
    const input = { z: { y: { x: 1 }, w: 2 }, a: 3 };
    expect(deepSortKeys(input)).toEqual({ a: 3, z: { w: 2, y: { x: 1 } } });
  });
});

// ============================================================
// computeCacheKey
// ============================================================

describe("computeCacheKey", () => {
  it("produces the same hash for requests with same params in different key order", () => {
    const req1 = makeRequest({ params: { temperature: 0, maxTokens: 1024, topP: 0.9 } });
    const req2 = makeRequest({ params: { topP: 0.9, temperature: 0, maxTokens: 1024 } });
    expect(computeCacheKey(req1)).toBe(computeCacheKey(req2));
  });

  it("produces different hashes for different models", () => {
    const req1 = makeRequest({ model: "gpt-4o" });
    const req2 = makeRequest({ model: "claude-3-5-sonnet" });
    expect(computeCacheKey(req1)).not.toBe(computeCacheKey(req2));
  });

  it("produces different hashes for different messages", () => {
    const req1 = makeRequest({ messages: [{ role: "user", content: "hello" }] });
    const req2 = makeRequest({ messages: [{ role: "user", content: "goodbye" }] });
    expect(computeCacheKey(req1)).not.toBe(computeCacheKey(req2));
  });

  it("returns a 64-char hex string (SHA-256)", () => {
    const key = computeCacheKey(makeRequest());
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ============================================================
// getCacheTtlMs
// ============================================================

describe("getCacheTtlMs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 86_400_000 when config.json does not exist", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(getCacheTtlMs()).toBe(86_400_000);
  });

  it("returns custom TTL from config.json when valid", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ cacheTtlMs: 3_600_000 }));
    expect(getCacheTtlMs()).toBe(3_600_000);
  });

  it("returns default when cacheTtlMs is not a number", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ cacheTtlMs: "1hour" }));
    expect(getCacheTtlMs()).toBe(86_400_000);
  });

  it("returns default when cacheTtlMs is zero", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ cacheTtlMs: 0 }));
    expect(getCacheTtlMs()).toBe(86_400_000);
  });

  it("returns default when cacheTtlMs is negative", () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ cacheTtlMs: -100 }));
    expect(getCacheTtlMs()).toBe(86_400_000);
  });

  it("returns default when config.json is malformed JSON", () => {
    mockReadFileSync.mockReturnValue("not json{{{");
    expect(getCacheTtlMs()).toBe(86_400_000);
  });
});

// ============================================================
// readCacheEntry
// ============================================================

describe("readCacheEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when file does not exist", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(readCacheEntry("abc123")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).endsWith(".json") && !String(path).includes("config")) {
        return "{{invalid";
      }
      throw new Error("ENOENT");
    });
    expect(readCacheEntry("abc123")).toBeNull();
  });

  it("returns the entry when it is within TTL", () => {
    const entry: CacheEntry = {
      response: makeResponse(),
      cachedAt: new Date(Date.now() - 1_000).toISOString(), // 1 second ago
    };
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).endsWith(".json") && !String(path).includes("config")) {
        return JSON.stringify(entry);
      }
      // config.json not found — use default TTL
      throw new Error("ENOENT");
    });
    const result = readCacheEntry("abc123");
    expect(result).not.toBeNull();
    expect(result?.response.text).toBe("hello world");
  });

  it("returns null for entries older than default TTL (24h)", () => {
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    const entry: CacheEntry = {
      response: makeResponse(),
      cachedAt: new Date(twentyFiveHoursAgo).toISOString(),
    };
    mockReadFileSync.mockImplementation((path) => {
      if (String(path).endsWith(".json") && !String(path).includes("config")) {
        return JSON.stringify(entry);
      }
      // config.json not found — use default TTL
      throw new Error("ENOENT");
    });
    expect(readCacheEntry("abc123")).toBeNull();
  });

  it("respects custom TTL from config.json", () => {
    // Entry is 2 hours old
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const entry: CacheEntry = {
      response: makeResponse(),
      cachedAt: new Date(twoHoursAgo).toISOString(),
    };
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.includes("config.json")) {
        return JSON.stringify({ cacheTtlMs: 1 * 60 * 60 * 1000 }); // 1 hour TTL
      }
      return JSON.stringify(entry);
    });
    // Entry is 2h old, TTL is 1h — should be expired
    expect(readCacheEntry("abc123")).toBeNull();
  });

  it("returns entry when within custom TTL", () => {
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    const entry: CacheEntry = {
      response: makeResponse(),
      cachedAt: new Date(thirtyMinsAgo).toISOString(),
    };
    mockReadFileSync.mockImplementation((path) => {
      const p = String(path);
      if (p.includes("config.json")) {
        return JSON.stringify({ cacheTtlMs: 1 * 60 * 60 * 1000 }); // 1 hour TTL
      }
      return JSON.stringify(entry);
    });
    const result = readCacheEntry("abc123");
    expect(result).not.toBeNull();
  });
});

// ============================================================
// writeCacheEntry
// ============================================================

describe("writeCacheEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates directory and writes file", () => {
    const response = makeResponse();
    writeCacheEntry("abc123def456", response);

    expect(mockMkdirSync).toHaveBeenCalledOnce();
    expect(mockWriteFileSync).toHaveBeenCalledOnce();

    const [, content] = mockWriteFileSync.mock.calls[0] as [unknown, string, unknown];
    const parsed = JSON.parse(content) as CacheEntry;
    expect(parsed.response.text).toBe("hello world");
    expect(parsed.cachedAt).toBeDefined();
  });

  it("sets file permissions to 0o600", () => {
    writeCacheEntry("abc123def456", makeResponse());
    const [, , options] = mockWriteFileSync.mock.calls[0] as [unknown, unknown, { mode: number }];
    expect(options.mode).toBe(0o600);
  });
});
