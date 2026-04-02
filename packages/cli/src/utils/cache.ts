import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import type { ProviderRequest, ProviderResponse } from "@kindlm/core";

// ============================================================
// Deep key sorting helper
// ============================================================

/**
 * Recursively sorts object keys alphabetically so that JSON.stringify
 * produces the same output regardless of insertion order.
 * Primitive values, null, and arrays are handled without modification
 * (array elements are recursed but their order is preserved).
 */
export function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = deepSortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

// ============================================================
// Cache TTL
// ============================================================

const DEFAULT_TTL_MS = 86_400_000; // 24 hours

/**
 * Returns the cache TTL in milliseconds.
 * Reads `cacheTtlMs` from `.kindlm/config.json` if available.
 * Falls back to the 24h default on any error.
 */
export function getCacheTtlMs(): number {
  try {
    const configPath = join(process.cwd(), ".kindlm", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ttl = parsed.cacheTtlMs;
    if (typeof ttl === "number" && ttl > 0) {
      return ttl;
    }
  } catch {
    // Config absent or malformed — use default
  }
  return DEFAULT_TTL_MS;
}

// ============================================================
// Cache Key Computation
// ============================================================

/**
 * Builds a deterministic SHA-256 cache key from a provider request.
 * Includes model, messages, params, tools, and toolChoice so that
 * identical requests return identical keys regardless of property
 * insertion order.
 */
export function computeCacheKey(request: ProviderRequest): string {
  const payload = {
    model: request.model,
    messages: request.messages,
    params: request.params,
    tools: request.tools,
    toolChoice: request.toolChoice,
  };
  const json = JSON.stringify(deepSortKeys(payload));
  return createHash("sha256").update(json).digest("hex");
}

// ============================================================
// Cache Storage (.kindlm/cache/)
// ============================================================

const CACHE_DIR_NAME = "cache";

function getCacheDir(): string {
  return join(process.cwd(), ".kindlm", CACHE_DIR_NAME);
}

function getCachePath(key: string): string {
  // Use first 2 chars as subdirectory to avoid too many files in one dir
  const subdir = key.slice(0, 2);
  return join(getCacheDir(), subdir, `${key}.json`);
}

export interface CacheEntry {
  response: ProviderResponse;
  cachedAt: string;
}

/**
 * Reads a cached provider response by cache key.
 * Returns null if the entry doesn't exist, is corrupt, or has expired.
 * Stale files are NOT deleted on read — they remain until evicted externally.
 */
export function readCacheEntry(key: string): CacheEntry | null {
  try {
    const raw = readFileSync(getCachePath(key), "utf-8");
    const parsed = JSON.parse(raw) as CacheEntry;
    if (
      parsed.response &&
      typeof parsed.response.text === "string" &&
      typeof parsed.cachedAt === "string"
    ) {
      const age = Date.now() - new Date(parsed.cachedAt).getTime();
      if (age > getCacheTtlMs()) {
        return null;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Writes a provider response to the cache.
 * Creates directories as needed. Non-fatal on error.
 */
export function writeCacheEntry(
  key: string,
  response: ProviderResponse,
): void {
  const filePath = getCachePath(key);
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const entry: CacheEntry = {
    response,
    cachedAt: new Date().toISOString(),
  };

  writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });
}
