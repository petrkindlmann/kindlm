# Phase 14: Response Caching - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the response caching system so developers can iterate on assertions and config without burning API credits. The foundation (cache.ts, caching-adapter.ts, --no-cache flag) already exists. This phase closes the remaining gaps: sorted cache keys, error response filtering, TTL expiry, cache clear command, and [cached] indicator in the reporter.

</domain>

<decisions>
## Implementation Decisions

### Cache key determinism (CACHE-03)
- **D-01:** `computeCacheKey` must sort object keys recursively before hashing to prevent insertion-order-dependent cache misses. Replace current `JSON.stringify(payload)` with `JSON.stringify(deepSortKeys(payload))`.
- **D-02:** Add a `deepSortKeys(obj)` pure helper in `cache.ts` — recursive key sorting for objects and arrays.

### Error response guard (CACHE-04)
- **D-03:** `createCachingAdapter` must NOT write to cache when `response.finishReason === "error"` OR `response.text === "" && response.toolCalls.length === 0`. Only cache successful, non-empty responses.
- **D-04:** The guard lives in `caching-adapter.ts` `complete()` method, before the `writeCacheEntry` call.

### Cache clear command (CACHE-06)
- **D-05:** New `kindlm cache clear` subcommand that deletes all files in `.kindlm/cache/`.
- **D-06:** Implemented as a new Commander command group in `cli/src/commands/cache.ts`.
- **D-07:** Outputs count of cleared entries and total bytes freed.

### [cached] reporter indicator (CACHE-07)
- **D-08:** When a response is served from cache, set `latencyMs: 0` (already done) AND add a `cached: true` field to the response metadata.
- **D-09:** Thread the `cached` flag through `TestRunResult` (or assertion metadata) so the pretty reporter can show `[cached]` next to the test name.
- **D-10:** Pretty reporter shows `[cached]` in dim/cyan after the test name when the response was cached.

### TTL-based expiry (CACHE-08)
- **D-11:** `readCacheEntry` checks the `cachedAt` timestamp against a configurable TTL (default 24 hours).
- **D-12:** TTL is read from `.kindlm/config.json` as `cacheTtlMs` (feature flag pattern). If absent, default to 86400000 (24h).
- **D-13:** Expired entries return null (treated as cache miss). The stale file is NOT deleted on read (lazy cleanup, keep it simple).

### CacheStore interface (CACHE-01)
- **D-14:** The existing `cache.ts` + `caching-adapter.ts` pattern is already the correct architecture (cache in CLI, not core). Rather than adding a CacheStore interface to core, keep the current direct-implementation pattern. Core remains zero-I/O.
- **D-15:** If a CacheStore interface is needed in the future (e.g., Workers KV-backed cache), it can be extracted then. For now, the CLI-only implementation satisfies all requirements.

### Claude's Discretion
- Exact error message format for `kindlm cache clear` output
- Whether to add a `--ttl` flag to override TTL per-run (defer to future if not needed)
- How to surface cache stats (hits/misses) — currently `getCacheStats` is a placeholder

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing cache implementation
- `packages/cli/src/utils/cache.ts` — computeCacheKey, readCacheEntry, writeCacheEntry, CacheEntry type. ALREADY EXISTS — extend, don't rewrite.
- `packages/cli/src/utils/caching-adapter.ts` — createCachingAdapter wrapping ProviderAdapter. ALREADY EXISTS — add error guard and cached flag.
- `packages/cli/src/utils/run-tests.ts` lines 258-263 — Cache wiring with `options.noCache` check. ALREADY EXISTS.
- `packages/cli/src/commands/test.ts` line 56 — `--no-cache` flag. ALREADY EXISTS.

### Types and interfaces
- `packages/core/src/types/provider.ts` — ProviderRequest, ProviderResponse types
- `packages/core/src/engine/runner.ts` — TestRunResult type used in reporters

### Reporter (for [cached] indicator)
- `packages/core/src/reporters/pretty.ts` — formatTest function where [cached] indicator goes
- `packages/core/src/reporters/interface.ts` — Colorize interface

### Feature flags
- `packages/cli/src/utils/features.ts` — isEnabled() pattern for .kindlm/config.json

### Research
- `.planning/research/PITFALLS.md` §Pitfall 3-4 — Cache key collision and cache poisoning
- `.planning/research/SUMMARY.md` — Key decisions on caching architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (CRITICAL — foundation already exists)
- `cache.ts` — `computeCacheKey()`, `readCacheEntry()`, `writeCacheEntry()`, `CacheEntry` interface. Needs: sorted keys, TTL check.
- `caching-adapter.ts` — `createCachingAdapter()` wrapping ProviderAdapter. Needs: error guard, cached flag propagation.
- `run-tests.ts` line 258 — Already wires caching adapter when `!options.noCache`.
- `test.ts` line 56 — `--no-cache` flag already registered in Commander.
- `features.ts` — `isEnabled()` for .kindlm/config.json feature flags.

### Established Patterns
- Factory function pattern: `createCachingAdapter()` follows `createRetryAdapter()` pattern
- CLI commands: Commander with `.command()` groups (see `baseline.ts` for subcommand pattern)
- Feature flags: `.kindlm/config.json` read by `isEnabled()` in CLI layer

### Integration Points
- `caching-adapter.ts` `complete()` — add error guard + cached flag
- `cache.ts` `readCacheEntry()` — add TTL check
- `cache.ts` `computeCacheKey()` — add deep key sorting
- `cli/src/commands/cache.ts` — new file for `kindlm cache clear`
- `cli/src/index.ts` — register cache command
- `pretty.ts` `formatTest()` — add [cached] indicator
- `TestRunResult` or equivalent — thread cached flag from adapter to reporter

</code_context>

<specifics>
## Specific Ideas

- The cache foundation is ~80% built. This phase is gap closure + polish, not greenfield.
- promptfoo's caching is the reference — hash of prompt+model, local file storage, [cached] indicator.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-response-caching*
*Context gathered: 2026-04-02*
