# Phase 14: Response Caching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 14-response-caching
**Areas discussed:** Cache key sorting, Error response guard, Cache clear command, [cached] indicator, TTL expiry
**Mode:** Auto (--auto)

---

## Critical Finding: Foundation Already Exists

Before gray area analysis, codebase scout revealed that ~80% of the caching infrastructure is already built:
- `packages/cli/src/utils/cache.ts` — computeCacheKey, readCacheEntry, writeCacheEntry
- `packages/cli/src/utils/caching-adapter.ts` — createCachingAdapter wrapping ProviderAdapter
- `packages/cli/src/utils/run-tests.ts` — already wires cache adapter when !options.noCache
- `packages/cli/src/commands/test.ts` — --no-cache flag already registered

This transforms Phase 14 from greenfield to gap closure.

---

## Cache Key Sorting

| Option | Description | Selected |
|--------|-------------|----------|
| Sort object keys before hashing | deepSortKeys() ensures insertion-order independence | ✓ |
| Use canonical JSON library | Import a package like fast-json-stable-stringify | |
| Keep current (no sorting) | Accept insertion-order dependency as low risk | |

**User's choice:** [auto] Sort object keys before hashing (recommended default)

---

## Error Response Guard

| Option | Description | Selected |
|--------|-------------|----------|
| Guard on finishReason + emptiness | Don't cache error or empty responses | ✓ |
| Guard on finishReason only | Cache empty but successful responses | |
| Cache everything | Let stale errors get cleared by TTL | |

**User's choice:** [auto] Guard on finishReason + emptiness (recommended default)

---

## Cache Clear Command

| Option | Description | Selected |
|--------|-------------|----------|
| kindlm cache clear subcommand | New command group with clear action | ✓ |
| kindlm test --clear-cache flag | Flag on test command | |
| Manual rm -rf .kindlm/cache | Document only, no CLI command | |

**User's choice:** [auto] kindlm cache clear subcommand (recommended default)

---

## [cached] Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata flag on response | Thread cached:true through test result to reporter | ✓ |
| latencyMs === 0 as proxy | Already set to 0 for cache hits, reporter could infer | |
| Separate cache stats section | Show cache summary at end, not per-test | |

**User's choice:** [auto] Metadata flag on response (recommended default)

---

## TTL Expiry

| Option | Description | Selected |
|--------|-------------|----------|
| Check cachedAt on read (24h default) | Lazy expiry, configurable via .kindlm/config.json | ✓ |
| Background cleanup job | Periodic scan of cache dir | |
| No TTL (manual clear only) | Simplest, cache grows forever | |

**User's choice:** [auto] Check cachedAt on read (recommended default)

---

## Claude's Discretion

- Error message format for cache clear output
- Whether to add --ttl per-run flag
- Cache stats surfacing (hits/misses)

## Deferred Ideas

None.
