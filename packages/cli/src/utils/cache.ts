import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ProviderRequest, ProviderResponse } from "@kindlm/core";

// ============================================================
// Cache Key Computation
// ============================================================

/**
 * Builds a deterministic SHA-256 cache key from a provider request.
 * Includes model, messages, params, tools, and toolChoice so that
 * identical requests return identical keys.
 */
export function computeCacheKey(request: ProviderRequest): string {
  const payload = {
    model: request.model,
    messages: request.messages,
    params: request.params,
    tools: request.tools,
    toolChoice: request.toolChoice,
  };
  const json = JSON.stringify(payload);
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
 * Returns null if the entry doesn't exist or is corrupt.
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
  const dir = filePath.slice(0, filePath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });

  const entry: CacheEntry = {
    response,
    cachedAt: new Date().toISOString(),
  };

  writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });
}
