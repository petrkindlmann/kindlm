# Research Summary — KindLM v2.3.0 Developer Experience & Depth

**Synthesized:** 2026-04-02

---

## Key Decisions Made

### Multi-Turn Agent Testing
- **Turn-label-based assertions** (not positional index) — prevents flaky tests when branching changes path length
- **`onToolCall` response mapping** in YAML — users define mock tool responses per tool name, enabling deterministic multi-turn testing without live tool backends
- **`maxTurns: 10` default** with hard cap at 20 — prevents infinite loops from stubborn agents
- **Fresh conversation state per test** — never share messages array across test boundaries
- **Conversation runner in core** (`conversation-runner.ts`) — pure logic, I/O injected

### Response Caching
- **Cache key = SHA-256(model + sortedParams + messages + tools)** — all response-affecting fields included, sorted keys prevent insertion-order collisions
- **Only cache `finishReason !== "error"` AND non-empty responses** — prevents cache poisoning
- **TTL: 24h default**, configurable in `.kindlm/config.json`
- **`[cached]` indicator** in pretty reporter — user always knows what was cached
- **`CacheStore` interface in core**, `fs`-backed implementation in CLI — respects zero-I/O boundary
- **`kindlm cache clear` subcommand** + `--no-cache` flag

### Rich Tool Call Failure Output
- **Full tool call sequence on failure** (numbered list with args)
- **Arg diff** when `argsMatch` fails (which fields differ)
- **Pass: tool name only** (no args) — prevents information overload
- **Truncate args >500 chars** with indicator
- **Uses `Colorize` interface** — no direct chalk, CI-safe

### GitHub Action
- **JS action (`runs.using: node20`)** — works on all runner OSes (not Docker)
- **Separate repo: `kindlm/test-action`** — keeps bundled `dist/` out of monorepo
- **Bundled with `@vercel/ncc`** — single `dist/index.js`
- **PR comment with summary** (not raw model responses — security)
- **Optional cloud upload** when `KINDLM_API_TOKEN` is set

### Watch Mode
- **chokidar 4.x** with `awaitWriteFinish: { stabilityThreshold: 300 }` — handles atomic writes, slow FS
- **Kill previous run before respawn** — no zombie processes
- **Separator line with timestamp** between runs (not full terminal clear)
- **Cumulative cost tracking** across watch session
- **`SIGINT` handler** cleans up watcher + child process

### Dashboard
- **recharts 2.x** for charts — React-native API, SSR-safe with dynamic import
- **All charts: `dynamic(() => import(), { ssr: false })`** — prevents SSR crashes
- **Timezone: UTC from API, client-side bucketing** with user's timezone
- **Paginated API (max 500 data points)** — prevents chart freezing on large datasets
- **4 new features:** run filtering/search, trend charts, run comparison, test detail drill-down

---

## Stack Additions

| Package | Version | Where | Why |
|---------|---------|-------|-----|
| chokidar | 4.x | CLI | File watching for --watch |
| recharts | 2.15.x | Dashboard | Time-series charts |
| @vercel/ncc | latest | Action repo (dev) | Bundle JS action |
| @actions/core | latest | Action repo | GitHub Action toolkit |

No new dependencies in `@kindlm/core`.

---

## Build Order

| Phase | Feature | Complexity | Dependencies |
|-------|---------|------------|--------------|
| 13 | Rich tool call failure output | LOW | None |
| 14 | Response caching | MEDIUM | None (enables 15) |
| 15 | Watch mode | MEDIUM | Benefits from 14 |
| 16 | Multi-turn agent testing | HIGH | None |
| 17 | GitHub Action | MEDIUM | None |
| 18 | Dashboard team features | HIGH | None |

Total: 6 phases, estimated 30-40 requirements.

---

## Top Pitfalls to Watch

1. **Conversation state leaking between tests** — isolate per execution
2. **Cache poisoning from error responses** — only cache successful responses
3. **Watch mode zombie processes** — kill previous before respawn
4. **GitHub Action Docker runtime** — use JS action, not Docker
5. **Dashboard SSR crashes** — dynamic import all chart components
6. **Zero-I/O boundary violation** — interfaces in core, implementations in CLI
7. **Cache key object insertion order** — sort keys before hashing

---

*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
