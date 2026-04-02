# Architecture — KindLM v2.3.0 Developer Experience & Depth

**Researched:** 2026-04-02
**Confidence:** HIGH (all from codebase analysis)

---

## Integration Map

### 1. Multi-Turn Agent Testing

**Core changes:**
- `core/src/config/schema.ts` — New `conversation` schema block in test config:
  ```yaml
  tests:
    - name: agent-booking-flow
      conversation:
        - turn: initial-request
          prompt: booking
          vars: { destination: "Paris" }
          expect:
            toolCalls:
              - tool: search_flights
          onToolCall:
            search_flights:
              respond: '{"flights": [{"id": 1, "price": 450}]}'
        - turn: confirmation
          expect:
            output:
              contains: ["Paris", "450"]
  ```
- `core/src/providers/conversation.ts` — Refactor from simple tool loop to turn-based state machine. Each turn: send message → get response → evaluate turn assertions → prepare next turn based on `onToolCall` responses.
- `core/src/assertions/registry.ts` — `createAssertionsFromExpect` must accept turn context (turn label, turn index) for scoped assertion results.
- `core/src/engine/runner.ts` — `executeUnit` detects `test.conversation` and delegates to conversation runner instead of single-shot provider call.

**CLI changes:**
- `cli/src/utils/run-tests.ts` — Thread conversation runner deps (same as provider deps).

**Reporter changes:**
- `core/src/reporters/pretty.ts` — Group assertions by turn label in output.

**Key constraint:** Conversation state (messages array) must be created fresh per test execution. Never shared across tests. The `ConversationRunner` receives `messages: ProviderMessage[]` as input, returns `ConversationResult` with per-turn results.

**New files:**
- `core/src/engine/conversation-runner.ts` — Turn-based execution engine
- `core/src/types/conversation.ts` — ConversationTurn, ConversationResult types

---

### 2. Response Caching

**Core changes (interfaces only):**
- `core/src/types/cache.ts` — New file:
  ```typescript
  interface CacheStore {
    get(key: string): Promise<ProviderResponse | null>;
    set(key: string, value: ProviderResponse): Promise<void>;
    clear(): Promise<void>;
  }
  ```
- `core/src/providers/cache-key.ts` — Pure function `computeCacheKey(request: ProviderRequest): string` using deterministic serialization (sorted keys + SHA-256).

**CLI changes:**
- `cli/src/utils/file-cache.ts` — `createFileCacheStore()` implementation:
  - Storage: `.kindlm/cache/{key-prefix}/{full-hash}.json`
  - TTL: check `mtime` against configurable TTL (default 24h)
  - Never cache `finishReason === "error"` or empty responses
- `cli/src/utils/run-tests.ts` — Wrap provider adapters with caching:
  ```typescript
  function createCachingAdapter(adapter: ProviderAdapter, cache: CacheStore): ProviderAdapter
  ```
  The wrapper intercepts `complete()`, checks cache, returns cached or delegates + stores.
- `cli/src/commands/cache.ts` — New `kindlm cache clear` command.
- `cli/src/commands/test.ts` — `--no-cache` flag.

**Reporter changes:**
- Assertion metadata gains `cached: boolean` flag. Pretty reporter shows `[cached]` indicator.

**Key constraint:** `CacheStore` interface in core, implementation in CLI. Core never touches `fs`. The caching adapter wraps the real adapter — transparent to all downstream code.

---

### 3. Rich Tool Call Failure Output

**Core changes:**
- `core/src/assertions/tool-calls.ts` — Enrich `AssertionResult.metadata` on failure:
  ```typescript
  metadata: {
    expected: { tool: string; argsMatch?: Record<string, unknown> },
    received: ProviderToolCall[],  // full list with args
    callSequence: string[],        // ordered tool names
    argDiffs?: Record<string, { expected: unknown; received: unknown }>
  }
  ```

**Reporter changes:**
- `core/src/reporters/pretty.ts` — `formatToolCallFailure()` helper:
  - Shows expected vs received tool names
  - Shows numbered call sequence
  - Shows arg diffs for `argsMatch` failures
  - Truncates args >500 chars
  - Uses `Colorize` interface (no direct chalk)
  - On pass: show tool name only (no args)

**Key constraint:** All data flows through existing `AssertionResult.metadata`. No new interfaces needed. Reporter reads metadata and formats.

---

### 4. GitHub Action

**Separate repo or package?** Separate repo: `kindlm/test-action`. Reasons:
- GitHub requires `action.yml` at repo root (or in a subdirectory with path ref)
- Action needs `dist/index.js` checked in — pollutes monorepo
- Independent release cycle from CLI

**Structure:**
```
kindlm/test-action/
├── action.yml          # runs.using: node20, inputs, outputs
├── src/
│   └── index.ts        # Install kindlm, run tests, post results
├── dist/
│   └── index.js        # Bundled with @vercel/ncc
├── package.json
└── tsconfig.json
```

**action.yml inputs:**
- `config`: path to kindlm.yaml (default: `kindlm.yaml`)
- `reporter`: reporter type (default: `junit`)
- `args`: additional CLI args passed through
- `cloud-token`: optional KINDLM_API_TOKEN for upload
- `comment`: post PR comment with summary (default: `true`)

**action.yml outputs:**
- `pass-rate`, `total`, `passed`, `failed`, `exit-code`

**Implementation:** The action installs `@kindlm/cli` globally, runs `kindlm test`, parses output, uploads JUnit artifact, optionally posts PR comment.

---

### 5. Watch Mode

**CLI changes only:**
- `cli/src/commands/test.ts` — `--watch` flag. When set, instead of running once and exiting:
  1. Run tests once (normal flow)
  2. Start chokidar watcher on config file + all referenced files
  3. On change: kill previous run (if still running), re-run
  4. Print separator with timestamp between runs
  5. Track cumulative cost across session
  6. Handle `SIGINT` to clean up watcher + child process

**New file:**
- `cli/src/utils/watch.ts` — `createWatchRunner()`:
  ```typescript
  interface WatchRunner {
    start(configPath: string, runFn: () => Promise<number>): Promise<never>;
    stop(): void;
  }
  ```

**Key constraint:** Watch mode is purely CLI. Core is unaware of it. The watch loop calls the same `runTests()` function as single-run mode.

---

### 6. Dashboard Team Features

**Cloud API changes (new routes):**
- `GET /v1/projects/:id/runs` — already exists, add `?branch=X&suite=Y&from=DATE&to=DATE` filters
- `GET /v1/projects/:id/runs/trends` — NEW: aggregated pass rate + cost over time, bucketed by day
- `GET /v1/runs/:id/compare/:otherId` — NEW: side-by-side diff of two runs
- `GET /v1/runs/:id/results/:testId` — NEW: detailed single test result with full assertion data

**Cloud D1 queries:**
- Trends: `SELECT date(created_at) as day, AVG(pass_rate) as rate, SUM(cost_usd) as cost FROM test_runs WHERE project_id = ? GROUP BY day ORDER BY day`
- Comparison: Two queries for each run's results, diff in application layer

**Dashboard pages:**
- `/projects/[id]/runs` — enhanced with filters, search, pagination
- `/projects/[id]/trends` — NEW: recharts line chart (pass rate + cost over time)
- `/projects/[id]/runs/[id]` — enhanced with test result drill-down
- `/projects/[id]/compare` — NEW: side-by-side run comparison

**Dashboard components:**
- `TrendChart` — recharts `LineChart` with pass rate + cost lines
- `RunComparison` — two-column layout showing test status changes
- `TestDetail` — assertion results, tool calls, model response
- `RunFilters` — branch, suite, date range filter bar

**Key constraint:** All chart components use `dynamic(() => import(), { ssr: false })`. Data fetched via SWR (already in use). Timezone-aware date bucketing on the client side.

---

## Build Order

```
Phase 13: Rich tool call failure output
  → Core: enrich assertion metadata
  → Reporter: format failure details
  → No deps on other features
  
Phase 14: Response caching  
  → Core: CacheStore interface + computeCacheKey
  → CLI: file cache implementation + --no-cache + cache clear command
  → Enables watch mode cost savings

Phase 15: Watch mode
  → CLI: chokidar watcher + process management
  → Benefits from cache (instant re-runs)

Phase 16: Multi-turn agent testing
  → Core: config schema + conversation runner + assertion scoping
  → CLI: wire conversation deps
  → Reporter: turn-grouped output
  → Independent but highest complexity

Phase 17: GitHub Action
  → Separate repo
  → Uses existing CLI
  → Independent of other features

Phase 18: Dashboard team features
  → Cloud: new API routes + D1 queries
  → Dashboard: new pages + components + charts
  → Independent of CLI features
```

Phase numbering continues from v2.2.0's last phase (12).

---

## Component Boundary Summary

| Feature | Core (zero I/O) | CLI (Node.js) | Cloud (Workers) | Dashboard (Next.js) | New Repo |
|---------|-----------------|---------------|-----------------|--------------------|---------| 
| Multi-turn | Schema, runner, assertions | Wire deps | — | — | — |
| Response cache | Interface, cache key | File cache, --no-cache | — | — | — |
| Rich failure output | Assertion metadata | — | — | — | — |
| GitHub Action | — | — | — | — | test-action |
| Watch mode | — | chokidar, process mgmt | — | — | — |
| Dashboard features | — | — | API routes, queries | Pages, charts, components | — |
