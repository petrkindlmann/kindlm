# Phase 14: Response Caching - Research

**Researched:** 2026-04-02
**Domain:** CLI caching layer — file I/O, cache key determinism, TTL, reporter threading
**Confidence:** HIGH

## Summary

The cache foundation is ~80% complete. `cache.ts` and `caching-adapter.ts` exist and are wired into `run-tests.ts`. The `--no-cache` flag is registered. This phase closes six concrete gaps: (1) deterministic cache keys via deep key sorting, (2) error response guard before writing, (3) TTL-based expiry on read, (4) `kindlm cache clear` command, (5) `[cached]` indicator in the pretty reporter, and (6) a `CacheStore` interface.

The trickiest gap is the `[cached]` indicator. The cache hit happens inside `caching-adapter.ts` (CLI layer), but the reporter lives in `@kindlm/core`. The core zero-I/O boundary means you cannot push the cached flag down into core types without either (a) adding `fromCache?: boolean` to `TestRunResult` in core, or (b) keeping the flag entirely CLI-side and threading it through the reporter invocation. The CONTEXT.md decision (D-08/D-09/D-10) chooses option (a): add `cached: true` to response metadata and thread `fromCache` through `TestRunResult`. This is the correct approach and is achievable without violating the zero-I/O constraint — it is purely a data field.

The `CacheStore` interface requirement (CACHE-01) is in tension with CONTEXT.md decision D-14/D-15, which says NOT to add a CacheStore interface to core. REQUIREMENTS.md says `CacheStore` must be in `@kindlm/core`; CONTEXT.md overrides this to keep it CLI-only. The planner must honor the CONTEXT.md locked decision.

**Primary recommendation:** Implement all six gaps in two waves: (1) cache.ts + caching-adapter.ts fixes, (2) cache clear command + reporter indicator.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `computeCacheKey` must sort object keys recursively before hashing. Replace `JSON.stringify(payload)` with `JSON.stringify(deepSortKeys(payload))`.
- **D-02:** Add `deepSortKeys(obj)` pure helper in `cache.ts`.
- **D-03:** `createCachingAdapter` must NOT write to cache when `response.finishReason === "error"` OR `response.text === "" && response.toolCalls.length === 0`.
- **D-04:** Error guard lives in `caching-adapter.ts` `complete()` method, before `writeCacheEntry`.
- **D-05:** New `kindlm cache clear` subcommand deletes all files in `.kindlm/cache/`.
- **D-06:** Implemented as new Commander command group in `cli/src/commands/cache.ts`.
- **D-07:** Outputs count of cleared entries and total bytes freed.
- **D-08:** Cache hit: set `latencyMs: 0` AND add `cached: true` field to response metadata.
- **D-09:** Thread `cached` flag through `TestRunResult` (or assertion metadata) to pretty reporter.
- **D-10:** Pretty reporter shows `[cached]` in dim/cyan after test name when response was cached.
- **D-11:** `readCacheEntry` checks `cachedAt` timestamp against configurable TTL (default 24h).
- **D-12:** TTL is read from `.kindlm/config.json` as `cacheTtlMs`. If absent, default to 86400000.
- **D-13:** Expired entries return null. Stale file is NOT deleted on read (lazy cleanup).
- **D-14:** No CacheStore interface in core. Keep direct-implementation pattern in CLI.
- **D-15:** CacheStore interface extraction deferred to future if Workers KV-backed cache is needed.

### Claude's Discretion
- Exact error message format for `kindlm cache clear` output
- Whether to add a `--ttl` flag to override TTL per-run (defer if not needed)
- How to surface cache stats (hits/misses) — currently `getCacheStats` is a placeholder

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACHE-01 | `CacheStore` interface in `@kindlm/core` with `get`, `set`, `clear` methods | OVERRIDDEN by D-14/D-15 — keep CLI-only, no core interface |
| CACHE-02 | File-based cache in `.kindlm/cache/` as JSON files | Already exists in `cache.ts`. No new work needed. |
| CACHE-03 | Cache key = SHA-256(model + sorted params + messages + tools) | Needs `deepSortKeys()` in `cache.ts` + `computeCacheKey` update |
| CACHE-04 | Only successful responses cached | Needs error guard in `caching-adapter.ts` `complete()` |
| CACHE-05 | `--no-cache` bypasses cache entirely | Already exists (test.ts line 56, run-tests.ts lines 259-263). No work needed. |
| CACHE-06 | `kindlm cache clear` deletes all cached responses | New file: `cli/src/commands/cache.ts` + register in `cli/src/index.ts` |
| CACHE-07 | Pretty reporter shows `[cached]` when response served from cache | Requires `fromCache?: boolean` on `TestRunResult` + `formatTest` update |
| CACHE-08 | Cache entries expire after configurable TTL (default 24h) | Needs TTL check in `readCacheEntry` + `cacheTtlMs` from config.json |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | built-in | SHA-256 hashing | Already used in `cache.ts` |
| `node:fs` | built-in | File read/write/readdir/stat | Already used in `cache.ts` |
| `node:path` | built-in | Path construction | Already used in `cache.ts` |

No new npm dependencies required. All operations use Node.js built-ins already imported.

## Architecture Patterns

### Existing Structure (what already works)
```
packages/cli/src/utils/
├── cache.ts              # computeCacheKey, readCacheEntry, writeCacheEntry, CacheEntry
├── caching-adapter.ts    # createCachingAdapter wrapping ProviderAdapter
└── features.ts           # loadFeatureFlags — pattern for reading .kindlm/config.json

packages/cli/src/commands/
├── baseline.ts           # Reference: subcommand pattern (baseline set|compare|list)
└── test.ts               # Line 56: --no-cache flag already registered

packages/cli/src/utils/run-tests.ts
└── Lines 258-263: caching adapter wired when !options.noCache

packages/core/src/engine/
├── runner.ts             # TestRunResult type, executeUnit, aggregation pipeline
└── aggregator.ts         # TestCaseRunResult — the per-run data structure

packages/core/src/reporters/
└── pretty.ts             # formatTest() at line 96 — where [cached] indicator goes
```

### Pattern 1: deepSortKeys for Deterministic Cache Keys
**What:** Recursively sort object keys before JSON.stringify to prevent insertion-order-dependent cache misses.
**When to use:** Any time a request object is hashed.
**Example:**
```typescript
// In cache.ts — pure helper, no I/O
function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepSortKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, deepSortKeys((value as Record<string, unknown>)[k])])
    );
  }
  return value;
}

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
```

### Pattern 2: TTL Check in readCacheEntry
**What:** Read `cacheTtlMs` from `.kindlm/config.json` (or default 86400000). On each read, compare `cachedAt` to `Date.now()` — return null if expired.
**When to use:** Every `readCacheEntry` call.
**Example:**
```typescript
// In cache.ts
function getCacheTtlMs(): number {
  try {
    const raw = readFileSync(join(process.cwd(), ".kindlm", "config.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const ttl = parsed["cacheTtlMs"];
    if (typeof ttl === "number" && ttl > 0) return ttl;
  } catch {
    // absent or malformed — use default
  }
  return 86_400_000; // 24 hours
}

export function readCacheEntry(key: string): CacheEntry | null {
  try {
    const raw = readFileSync(getCachePath(key), "utf-8");
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed.response || typeof parsed.cachedAt !== "string") return null;
    // TTL check
    const age = Date.now() - new Date(parsed.cachedAt).getTime();
    if (age > getCacheTtlMs()) return null;
    return parsed;
  } catch {
    return null;
  }
}
```

### Pattern 3: Error Guard in caching-adapter.ts
**What:** Before writing to cache, check that the response is not an error and has content.
**When to use:** In `createCachingAdapter` `complete()`, after `inner.complete()`.
```typescript
const isCacheable =
  response.finishReason !== "error" &&
  (response.text !== "" || response.toolCalls.length > 0);

if (isCacheable) {
  try {
    writeCacheEntry(key, response);
  } catch {
    // non-fatal
  }
}
```

### Pattern 4: Cache Clear Command (subcommand pattern)
**What:** New `cli/src/commands/cache.ts` file following the `baseline.ts` subcommand pattern.
**Reference:** `packages/cli/src/commands/baseline.ts` — uses `.command()` groups with Commander.
**Registration:** `cli/src/index.ts` must import and register the cache command.
**Output:** count of cleared files + total bytes freed.
```typescript
// Uses node:fs readdirSync + statSync + rmSync (recursive glob via subdir structure)
// Cache dir layout: .kindlm/cache/{2-char-subdir}/{sha256-hash}.json
```

### Pattern 5: [cached] Indicator Threading
**What:** Thread a `fromCache` boolean from `caching-adapter.ts` through to `TestRunResult` and `formatTest()`.
**Challenge:** The cache hit is in the CLI adapter; `TestRunResult` is a core type. Must add `fromCache?: boolean` to core's `TestRunResult`.
**Thread path:**
1. `caching-adapter.ts` `complete()`: return `{ ...cached.response, latencyMs: 0, fromCache: true }` — but `ProviderResponse` doesn't have `fromCache`. Two options:
   - Add `fromCache?: boolean` to `ProviderResponse` in core (cleanest but touches core types)
   - Store cache hit state in adapter closure and expose it as metadata on the result
   
   **Recommended approach (per D-08/D-09):** Add `fromCache?: boolean` to `ProviderResponse` in `packages/core/src/types/provider.ts`. It's a pure data field, not I/O. The caching adapter sets it; core passes it through.
2. `runner.ts` `executeUnit()`: `conversation.totalLatencyMs` is used for latency, but `fromCache` must come from the final `ProviderResponse`. The conversation runner returns a `ConversationResult` — check if it exposes the underlying response's `fromCache`.
3. `TestCaseRunResult` in `aggregator.ts`: add `fromCache?: boolean`.
4. `TestRunResult` in `runner.ts`: add `fromCache?: boolean`.
5. `pretty.ts` `formatTest()`: check `test.fromCache` and append `c.dim(c.cyan("[cached]"))`.

### Anti-Patterns to Avoid
- **Deleting expired cache files on read:** D-13 says lazy cleanup only — don't add `rmSync` in `readCacheEntry`. Keep it simple.
- **Adding `isEnabled()` feature flag for caching:** TTL is config (`.kindlm/config.json` `cacheTtlMs`), not a feature flag — don't add it to `FeatureFlags` type. It's a configuration value, not a boolean toggle.
- **Touching core I/O:** `cache.ts` is CLI-only. Core (`runner.ts`, `aggregator.ts`) only gets a `fromCache` data field — no file system imports.
- **Using glob or third-party for cache clear:** Use `readdirSync` recursively on `.kindlm/cache/` — no new dependencies.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hashing | Custom hash function | `node:crypto` `createHash` | Already used, cryptographically sound |
| File enumeration for cache clear | Custom recursive walker | `readdirSync` with subdir pattern | Cache dir is exactly 2 levels deep (known structure) |
| TTL parsing | Date math library | `Date.now() - new Date(cachedAt).getTime()` | ISO string parsing is reliable here |

**Key insight:** The cache directory has a fixed 2-level structure (`{2-char}/{sha256}.json`) — no need for a recursive glob. Just `readdirSync` on each 2-char subdir.

## Common Pitfalls

### Pitfall 1: ProviderResponse.fromCache breaks core zero-I/O rule?
**What goes wrong:** Developer avoids adding `fromCache` to core `ProviderResponse` because it seems like "cache metadata doesn't belong in core."
**Why it happens:** Misreads the zero-I/O constraint as "no cache-related fields in core."
**How to avoid:** Zero-I/O means no `fs`/`fetch`/`console` in core. A boolean data field on a type is not I/O. Add it.
**Warning signs:** If the planner routes around core types using side channels (closures, globals), that's the wrong path.

### Pitfall 2: ConversationResult doesn't expose fromCache
**What goes wrong:** `fromCache` is set on the `ProviderResponse` returned by `caching-adapter.ts`, but `runConversation()` in `conversation.ts` aggregates multiple responses — the final `ConversationResult` may not surface `fromCache` on a per-response basis.
**Why it happens:** The conversation runner was built before caching existed.
**How to avoid:** Check `conversation.ts` to see what `ConversationResult` exposes. If `fromCache` can't be inferred from the result, thread it through `ConversationResult` as `fromCache?: boolean` (true if ALL responses in the conversation were cache hits — i.e., `totalLatencyMs === 0` is a proxy but fragile; explicit field is safer).
**Warning signs:** `totalLatencyMs === 0` being used as a proxy for cache hit.

### Pitfall 3: Cache clear counts wrong files
**What goes wrong:** `readdirSync(".kindlm/cache/")` returns subdir names (2-char prefixes), not files. Developer counts subdirs instead of files.
**Why it happens:** The 2-level structure is easy to forget.
**How to avoid:** Enumerate both levels: `for subdir in readdirSync(cacheDir)` → `for file in readdirSync(join(cacheDir, subdir))`.

### Pitfall 4: TTL config collides with FeatureFlags type
**What goes wrong:** Developer adds `cacheTtlMs` to the `FeatureFlags` type in `features.ts` as a number feature flag, breaking the boolean-only contract.
**Why it happens:** `features.ts` already reads `.kindlm/config.json` — developer tries to reuse it.
**How to avoid:** `cacheTtlMs` is a numeric config value, not a feature flag. Read it directly in `getCacheTtlMs()` in `cache.ts`. Do NOT add it to `FeatureFlags`.

### Pitfall 5: `writeCacheEntry` uses `filePath.lastIndexOf("/")` which breaks on Windows
**What goes wrong:** Existing `writeCacheEntry` uses `filePath.slice(0, filePath.lastIndexOf("/"))` to get the directory. This is a bug on Windows where paths use `\`.
**Why it happens:** Original code didn't use `node:path.dirname()`.
**How to avoid:** Replace with `dirname(filePath)` from `node:path` when touching this function.

## Code Examples

### Cache clear implementation skeleton
```typescript
// packages/cli/src/commands/cache.ts
import { readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";

export function createCacheCommand(): Command {
  const cache = new Command("cache").description("Manage response cache");

  cache
    .command("clear")
    .description("Delete all cached responses")
    .action(() => {
      const cacheDir = join(process.cwd(), ".kindlm", "cache");
      if (!existsSync(cacheDir)) {
        console.log(chalk.dim("Cache is empty (no cache directory found)."));
        return;
      }
      let count = 0;
      let totalBytes = 0;
      for (const subdir of readdirSync(cacheDir)) {
        const subdirPath = join(cacheDir, subdir);
        for (const file of readdirSync(subdirPath)) {
          const filePath = join(subdirPath, file);
          totalBytes += statSync(filePath).size;
          rmSync(filePath);
          count++;
        }
        // Optionally remove empty subdir
        try { rmSync(subdirPath); } catch { /* not empty or already gone */ }
      }
      const kb = (totalBytes / 1024).toFixed(1);
      console.log(chalk.green(`Cleared ${count} cached response${count !== 1 ? "s" : ""} (${kb} KB freed).`));
    });

  return cache;
}
```

### Registration in cli/src/index.ts
```typescript
import { createCacheCommand } from "./commands/cache.js";
program.addCommand(createCacheCommand());
```

### formatTest update in pretty.ts
```typescript
function formatTest(test: TestRunResult, c: Colorize): string {
  const icon =
    test.status === "passed"
      ? c.green("✓")
      : test.status === "skipped"
        ? c.yellow("○")
        : c.red("✗");
  const cachedBadge = test.fromCache ? ` ${c.dim(c.cyan("[cached]"))}` : "";
  return `    ${icon} ${test.name}${cachedBadge}`;
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `JSON.stringify(payload)` (insertion-order-sensitive) | `JSON.stringify(deepSortKeys(payload))` | Eliminates cache misses from object key ordering |
| No TTL — entries live forever | TTL from `cacheTtlMs` config, default 24h | Stale responses don't persist indefinitely |
| All responses cached including errors | Guard: skip error/empty responses | Cache poisoning prevented |

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all operations use Node.js built-ins already present in the CLI package).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run packages/cli/src/utils/cache.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CACHE-03 | `deepSortKeys` produces identical hash regardless of key order | unit | `npx vitest run packages/cli/src/utils/cache.test.ts` | ❌ Wave 0 |
| CACHE-04 | Error responses not cached | unit | `npx vitest run packages/cli/src/utils/caching-adapter.test.ts` | ❌ Wave 0 |
| CACHE-08 | Expired entries return null | unit | `npx vitest run packages/cli/src/utils/cache.test.ts` | ❌ Wave 0 |
| CACHE-06 | cache clear removes files, reports count+bytes | unit | `npx vitest run packages/cli/src/commands/cache.test.ts` | ❌ Wave 0 |
| CACHE-07 | `[cached]` shown in pretty reporter output | unit | `npx vitest run packages/core/src/reporters/pretty.test.ts` | ❌ Wave 0 |
| CACHE-02 | File-based storage in `.kindlm/cache/` | unit | `npx vitest run packages/cli/src/utils/cache.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/cli/src/utils/cache.test.ts packages/cli/src/utils/caching-adapter.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cli/src/utils/cache.test.ts` — covers CACHE-02, CACHE-03, CACHE-08
- [ ] `packages/cli/src/utils/caching-adapter.test.ts` — covers CACHE-04
- [ ] `packages/cli/src/commands/cache.test.ts` — covers CACHE-06
- [ ] `packages/core/src/reporters/pretty.test.ts` — covers CACHE-07 (may already exist partially)

## Open Questions

1. **Does `ConversationResult` expose per-response `fromCache`?**
   - What we know: `conversation.ts` `runConversation()` returns `ConversationResult` with `totalLatencyMs`. Cache hits return `latencyMs: 0` from the adapter.
   - What's unclear: If a multi-turn conversation has mix of cached/live responses, how to determine if the whole conversation was "from cache"?
   - Recommendation: Add `fromCache?: boolean` to `ConversationResult` in `conversation.ts`. Set it to `true` only if ALL turns had `latencyMs === 0`. This is sound because `caching-adapter.ts` always sets `latencyMs: 0` on hits, and real responses always have `latencyMs > 0` (network round-trip).

2. **CACHE-01 vs D-14 conflict**
   - What we know: REQUIREMENTS.md says CacheStore interface in core; CONTEXT.md D-14 locks the opposite.
   - What's unclear: Nothing — CONTEXT.md wins per research protocol.
   - Recommendation: Planner should mark CACHE-01 as "satisfied by CLI-only pattern per D-14" and not add a core interface.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `cache.ts`, `caching-adapter.ts`, `run-tests.ts`, `runner.ts`, `aggregator.ts`, `pretty.ts`, `features.ts`
- CONTEXT.md locked decisions (authoritative for this phase)

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md CACHE-01 through CACHE-08

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all Node.js built-ins, no new dependencies
- Architecture: HIGH — all integration points directly inspected in source
- Pitfalls: HIGH — identified from direct code reading (Windows path bug is real)

**Research date:** 2026-04-02
**Valid until:** 60 days (stable codebase, no fast-moving external dependencies)
