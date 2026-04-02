---
phase: 14
plan: "01"
subsystem: "cli/cache, core/types, core/engine"
tags: [caching, determinism, ttl, fromCache, types]
dependency_graph:
  requires: []
  provides: [CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05, CACHE-08]
  affects: [packages/cli/src/utils/cache.ts, packages/cli/src/utils/caching-adapter.ts, packages/core/src/types/provider.ts, packages/core/src/engine/runner.ts, packages/core/src/engine/aggregator.ts]
tech_stack:
  added: []
  patterns: [deepSortKeys for deterministic JSON, isCacheable guard, fromCache flag threading]
key_files:
  created:
    - packages/cli/src/utils/cache.test.ts
    - packages/cli/src/utils/caching-adapter.test.ts
  modified:
    - packages/cli/src/utils/cache.ts
    - packages/cli/src/utils/caching-adapter.ts
    - packages/core/src/types/provider.ts
    - packages/core/src/engine/aggregator.ts
    - packages/core/src/engine/runner.ts
decisions:
  - deepSortKeys recurses into arrays and objects; primitives and null pass through unchanged
  - Stale cache files are NOT deleted on TTL expiry — they remain for possible future use or manual eviction
  - isCacheable guard checks both finishReason !== "error" AND non-empty content (text or toolCalls)
  - fromCache threaded from ProviderResponse → ConversationResult → TestCaseRunResult → TestRunResult
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-02"
  tasks_completed: 2
  files_modified: 7
---

# Phase 14 Plan 01: Cache Correctness Foundation Summary

Cache key determinism, TTL expiry, error response guard, and `fromCache` field threading from caching adapter through core types to `TestRunResult`.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Cache key sorting, TTL expiry, and error guard | 8015c00 | cache.ts, caching-adapter.ts + tests |
| 2 | Thread fromCache through core types | d660dd0 | provider.ts, aggregator.ts, runner.ts |

## What Was Built

### Task 1: Cache correctness in CLI utils

**`packages/cli/src/utils/cache.ts`**
- `deepSortKeys(value: unknown): unknown` — recursively sorts object keys alphabetically so identical requests serialize identically regardless of insertion order
- `computeCacheKey` updated to use `JSON.stringify(deepSortKeys(payload))` before hashing
- `getCacheTtlMs()` reads `.kindlm/config.json` for `cacheTtlMs`; falls back to 86,400,000ms (24h)
- `readCacheEntry` now checks age against TTL before returning — stale entries return `null` without deleting the file
- `writeCacheEntry` fixed Windows path bug: replaced `filePath.slice(0, filePath.lastIndexOf("/"))` with `dirname(filePath)` from `node:path`

**`packages/cli/src/utils/caching-adapter.ts`**
- Added `isCacheable` guard: only calls `writeCacheEntry` when `response.finishReason !== "error"` AND `(response.text !== "" || response.toolCalls.length > 0)`
- Cache hits now return `{ ...cached.response, latencyMs: 0, fromCache: true }`

**Tests: 40 passing** across `cache.test.ts` and `caching-adapter.test.ts`

### Task 2: fromCache field threading

- `ProviderResponse.fromCache?: boolean` — set by caching adapter on cache hits
- `ConversationResult.fromCache?: boolean` — true when all turns are cache hits
- `TestCaseRunResult.fromCache?: boolean` — propagated from executeUnit
- `TestRunResult.fromCache?: boolean` — threaded from representativeRun in aggregation
- `executeUnit` computes `fromCache = turns.every(t => t.response.fromCache === true)`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run packages/cli/src/utils/cache.test.ts packages/cli/src/utils/caching-adapter.test.ts` — 40/40 pass
- `npm run typecheck` — 0 errors across all packages
- `npx vitest run` — 1242/1245 pass (3 pre-existing skips)

## Self-Check: PASSED

Files exist:
- packages/cli/src/utils/cache.ts — FOUND
- packages/cli/src/utils/cache.test.ts — FOUND
- packages/cli/src/utils/caching-adapter.ts — FOUND
- packages/cli/src/utils/caching-adapter.test.ts — FOUND
- packages/core/src/types/provider.ts — FOUND
- packages/core/src/engine/runner.ts — FOUND
- packages/core/src/engine/aggregator.ts — FOUND

Commits exist:
- 8015c00 — FOUND
- d660dd0 — FOUND
