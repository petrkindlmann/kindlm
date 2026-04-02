# Pitfalls Research

**Domain:** KindLM v2.3.0 — multi-turn testing, response caching, watch mode, GitHub Action, dashboard features, rich failure output
**Researched:** 2026-04-02
**Confidence:** HIGH (codebase-informed) / MEDIUM (ecosystem patterns)

---

## Critical Pitfalls

### Pitfall 1: Multi-Turn State Leaking Across Test Cases

**What goes wrong:** Conversation history (messages array) from one test case bleeds into the next. Tests that share a provider adapter or conversation runner instance carry over tool call history, system messages, and model context, making later tests non-deterministic and dependent on execution order.

**Why it happens:** The existing `ProviderAdapter` pattern is stateless (request → response). Multi-turn extends this to a stateful message list. If `conversation.ts` holds the message accumulator as module-level state or as a field on a shared adapter instance, it is never reset between test cases.

**How to avoid:** Isolate conversation state per test case execution, not per adapter instance. Each `ConversationRunner` invocation must receive a fresh messages array. The messages array must never be mutated in place — always produce a new array per turn (immutable accumulation). Core owns this logic; CLI must not pass a shared messages reference across test boundaries.

**Warning signs:** Test results differ when run in isolation vs. suite order. A test that should fail (agent did not call expected tool) passes when run after a test where the agent did call it.

**Phase to address:** Multi-turn testing phase. Design the `ConversationRunner` interface with explicit `messages: ProviderMessage[]` input (not accumulated internally). Vitest test: run two multi-turn tests sequentially with a mock adapter; assert adapter.complete call history is disjoint.

---

### Pitfall 2: Non-Deterministic Branch Paths Break Assertion Mapping

**What goes wrong:** Conditional branching (if agent calls tool X, send follow-up Y; else send follow-up Z) produces variable-length turn sequences. Assertions written as "turn 2 output contains X" fail when the branch taken has a different length. The test always fails on the non-expected branch, even if the overall agent behavior is correct.

**Why it happens:** Users model decision trees as flat arrays of expected turns. The engine evaluates assertions positionally. When branching produces a different path, assertion positions shift and every downstream assertion fails with confusing messages.

**How to avoid:** Assertions on multi-turn tests must be scoped to a named turn label, not a positional index. The YAML schema must require `turn.id` labels and assertions must reference `turn: "clarification-response"` not `turn: 2`. The assertion registry must resolve turn results by label before evaluating.

**Warning signs:** Flaky multi-turn tests that pass/fail depending on model temperature. Assertion failure messages reference wrong turn content.

**Phase to address:** Multi-turn schema design phase. Define `turn.id` as required in Zod schema before any assertion binding is built. Build assertion registry extension to resolve by label.

---

### Pitfall 3: Cache Key Collision Between Similar Prompts

**What goes wrong:** Two test cases with the same model and temperature but different variable interpolation resolve to the same cache key. The cache returns a stale response for a prompt that was actually different. Tests pass against cached wrong responses.

**Why it happens:** Cache keys are often computed from `hash(model + systemPrompt + userPrompt)`. Variable interpolation happens before the key is computed — that part is correct. The problem is when `params` (temperature, maxTokens, seed, stopSequences) are omitted from the key. Two runs with `temperature: 0` and `temperature: 0.7` share a cache entry and the non-deterministic run silently gets a cached deterministic response.

**How to avoid:** Cache key = `SHA-256(model + JSON.stringify(sortedParams) + systemPrompt + userPrompt + JSON.stringify(sortedTools))`. All fields that affect the response must be in the key. Use `JSON.stringify` with sorted keys (not insertion-order) to prevent key divergence from object construction order. Implement in `@kindlm/core` as a pure `computeCacheKey(request: ProviderRequest): string` function — no I/O.

**Warning signs:** Two tests with different temperatures return identical responses. Cache hit rate is suspiciously high (>90%) on first run.

**Phase to address:** Response caching phase. Define `computeCacheKey` in core as a tested pure function before any file I/O is wired in CLI.

---

### Pitfall 4: Cache Poisoning from Partial/Error Responses

**What goes wrong:** A provider returns a 500, rate-limit, or malformed response. The caching layer caches the error result. All subsequent runs (including retries) serve the cached failure. The test always fails, and clearing the cache is non-obvious to users.

**Why it happens:** The wrapping adapter pattern (`createCachingAdapter` wraps `ProviderAdapter.complete`) catches the resolved promise value but not whether it represents an error. If `ProviderResponse.finishReason === "error"` is not checked before writing to cache, errors are persisted.

**How to avoid:** Only cache responses where `finishReason !== "error"` AND `text !== ""` AND `toolCalls` is a valid (possibly empty) array. Never cache `Result<never, KindlmError>` error branches. Add a `kindlm cache clear` subcommand and document it in the error output when a cached test fails.

**Warning signs:** A test that was failing (provider error) continues failing after the provider recovers. `--no-cache` flag makes the test pass.

**Phase to address:** Response caching phase. Implement cache-write guard as an explicit predicate `isCacheableResponse(r: ProviderResponse): boolean` so the rule is tested independently of the adapter.

---

### Pitfall 5: Watch Mode Zombie Processes on Config Parse Failure

**What goes wrong:** `kindlm test --watch` spawns a child process (or re-uses the current process) to run tests. If the config fails to parse (Zod error), the watch loop continues but the previous test child process is not cleaned up. On the next config save, a second child process spawns. After several saves, multiple test runners execute concurrently against the same provider, multiplying cost and producing interleaved output.

**Why it happens:** File watchers (chokidar / `fs.watch`) trigger on every save event. If the restart logic does not explicitly `kill()` the previous child before spawning a new one, processes accumulate. This is especially bad during rapid iteration (save → compile → save again before tests finish).

**How to avoid:** The watch loop must hold a reference to the currently-running child process. On any new config change event (debounced 300ms): (1) if child is running, send SIGTERM and await its exit; (2) only then spawn the next run. Use `child.killed` to guard against double-kill. Register `SIGINT`/`SIGTERM` handlers on the watch process to kill the child before exiting.

**Warning signs:** Provider bills spike unexpectedly during development sessions. Terminal shows interleaved output from multiple runs. `ps aux | grep kindlm` shows multiple instances.

**Phase to address:** Watch mode phase. Write an integration test that simulates rapid config saves and verifies only one child process is alive at any time.

---

### Pitfall 6: GitHub Action Using Docker Runtime on macOS Runners

**What goes wrong:** A `uses: docker://...` or `image:` GitHub Action fails silently on macOS (`macos-latest`) and Windows runners because Docker is not available. If the action.yml specifies `runs.using: docker`, it only works on Linux runners. Teams that run KindLM on macOS CI jobs get a confusing "Docker daemon not available" error that looks unrelated to KindLM.

**Why it happens:** Docker-based actions are the fastest to build (no bundling) but only work on Linux. JavaScript/TypeScript actions (`runs.using: node20`) work on all platforms. Composite actions (shell steps) work everywhere but have no action-level secrets isolation.

**How to avoid:** Use `runs.using: node20` with a pre-bundled `dist/index.js`. Bundle with `@vercel/ncc` or `esbuild` to produce a single file with all dependencies — do not rely on `node_modules` being present in the action repo. Check in `dist/` to the action repo (GitHub requires this for JS actions).

**Warning signs:** Action works in one team's CI but not another's. Error messages mention Docker rather than KindLM.

**Phase to address:** GitHub Action phase. Test the action on `ubuntu-latest`, `macos-latest`, and `windows-latest` runners in the action's own CI before release.

---

### Pitfall 7: Dashboard Chart SSR Crash from Window/Document Access

**What goes wrong:** Recharts, Chart.js, and similar charting libraries access `window`, `document`, or `navigator` at module evaluation time. In Next.js App Router with SSR, this throws `ReferenceError: window is not defined` at build time or on the server render, crashing the page.

**Why it happens:** Next.js App Router renders components on the server by default. Chart components that assume browser globals fail immediately. Dynamic imports with `{ ssr: false }` are the escape hatch, but developers forget to apply them and only discover the crash in production (dev mode with `next dev` may not expose it if the component is client-side hydrated differently).

**How to avoid:** All chart components must be wrapped in `dynamic(() => import("./Chart"), { ssr: false })`. Add an ESLint rule or custom lint check that flags direct imports of known browser-only charting packages in non-`"use client"` files. Test the production build (`next build && next start`) not just `next dev`.

**Warning signs:** Chart renders in dev mode but 500s in production. Error stack trace shows chart library code, not application code. Error only appears on first load (SSR), not after hydration.

**Phase to address:** Dashboard phase. Add `next build` to CI for dashboard package — catches SSR crashes that `next dev` hides.

---

## Moderate Pitfalls

### Pitfall 8: Cache Key Depends on Object Insertion Order (ESM/Workers)

**What goes wrong:** `JSON.stringify({ temperature: 0, maxTokens: 1024 })` produces a different string from `JSON.stringify({ maxTokens: 1024, temperature: 0 })`. If `ProviderRequest.params` is constructed in different orders across code paths (e.g., CLI override merges fields differently than the config parser), cache misses occur for semantically identical requests.

**Why it happens:** JavaScript object key order is insertion-order-dependent. `JSON.stringify` preserves insertion order. Two structurally identical objects with different construction order produce different JSON strings and therefore different cache keys.

**How to avoid:** In `computeCacheKey`, always sort object keys recursively before serializing: `JSON.stringify(deepSortKeys(params))`. This is a pure function, belongs in core, and should be tested with object-order permutations.

**Phase to address:** Response caching phase.

---

### Pitfall 9: Watch Mode Debounce Too Short on Slow File Systems

**What goes wrong:** On networked file systems (NFS, Docker volume mounts, WSL2) or when using editors that write files in two operations (truncate + rewrite), a 100ms debounce triggers twice per save: once on truncate (empty file) and once on the full write. The first trigger attempts to parse an empty config file, fails with a Zod error, and the error output appears in the terminal before the second trigger runs successfully.

**Why it happens:** Many editors (including vim, nano, and some JetBrains configurations) do not write atomically. They truncate and rewrite. A 100ms debounce catches both events as one only on fast local SSDs. On slower file systems, the two events are >100ms apart.

**How to avoid:** Use 300ms debounce minimum. Also validate the config file is non-empty before attempting parse: `if (fileSize === 0) return` early in the handler. Use chokidar's `awaitWriteFinish: { stabilityThreshold: 200 }` option rather than manual debounce — it waits for file size to stabilize.

**Phase to address:** Watch mode phase.

---

### Pitfall 10: Rich Failure Output — ANSI Codes Break CI Log Parsers

**What goes wrong:** Rich tool call failure output uses chalk for colored diff formatting, box drawing characters, and multi-line structured output. In CI environments (GitHub Actions, GitLab CI), the output is parseable — but JUnit reporters and log parsers that scan for `FAIL` or assertion patterns break when ANSI escape codes are embedded in lines they try to parse.

**Why it happens:** Chalk detects CI environments via `FORCE_COLOR` and `NO_COLOR` environment variables, but not all CI systems set these consistently. GitLab CI in particular does not set `NO_COLOR`, so chalk emits colors even when the log viewer strips them incorrectly.

**How to avoid:** The `Colorize` interface (already used in reporters) must be injected into the rich output formatter — never call chalk directly. The pretty reporter passes a colorize implementation; CI detection (checking `process.env.CI` and `process.env.NO_COLOR`) lives in CLI, not core. Add a `--no-color` flag to the CLI that forces `Colorize` to identity functions.

**Warning signs:** CI log grep for `FAILED` returns zero results despite visible failures. JUnit XML contains ANSI escape sequences in `<message>` elements.

**Phase to address:** Rich failure output phase.

---

### Pitfall 11: Multi-Turn Tool Call Loop Produces Infinite Turns

**What goes wrong:** An agent that always returns a tool call (never a final text response) causes the multi-turn runner to loop indefinitely, exhausting the timeout or running up provider costs.

**Why it happens:** `conversation.ts` implements a tool-call loop (`while finishReason === "tool_calls"`). Without a hard turn limit, a stubborn agent or a misconfigured test runs forever. The existing timeout (`timeoutMs`) guards wall-clock time but not turn count, and on fast providers the turn limit can be hit before the timeout fires.

**How to avoid:** Add `maxTurns` to the multi-turn config (Zod schema, required field, max 20). The conversation runner must fail with a clear error (`MAX_TURNS_EXCEEDED`) if `maxTurns` is reached before `finishReason === "stop"`. Default `maxTurns: 10` in schema defaults.

**Warning signs:** Tests that use tool calls run longer than expected. Provider cost for a single test is unexpectedly high. Test times out rather than completing.

**Phase to address:** Multi-turn testing phase. Add `maxTurns` enforcement as the first guard in the conversation loop, before any assertion evaluation.

---

### Pitfall 12: GitHub Action Leaks API Keys in Step Summary

**What goes wrong:** The action logs the full test output (including model responses) to the GitHub Actions step summary. If a test prompt includes a real API key in a variable (e.g., testing that an agent does NOT include secrets in output), the key appears in the public step summary.

**Why it happens:** Step summaries are written to `$GITHUB_STEP_SUMMARY`. If the action appends `kindlm test` stdout directly to the summary, anything in stdout (including model responses) becomes visible to anyone with repo read access.

**How to avoid:** The action must only write structured summary data (pass/fail counts, test names, assertion results) — never raw model responses. Raw responses go only to the local artifact. Add a `mask-responses: true` input (default true) that strips response text from summary output.

**Phase to address:** GitHub Action phase. Review all action output paths before publishing v2.

---

### Pitfall 13: Dashboard Trend Charts — Timezone Mismatch Between Client and Server

**What goes wrong:** Test run timestamps stored in D1 as UTC ISO strings (`datetime('now')` → UTC) are displayed in trend charts. When the chart groups by day (`2026-04-01`), a run at `2026-04-01T23:30:00Z` appears on April 1 UTC but on April 2 for a user in UTC+3. Trend lines shift by one day for non-UTC users.

**Why it happens:** D1/SQLite `datetime('now')` returns UTC. Chart date bucketing logic (day/week grouping) must apply the user's timezone offset, not UTC. If the API returns UTC timestamps and the frontend groups naively with `new Date().getDate()`, timezone-naive grouping produces wrong day boundaries.

**How to avoid:** Return raw UTC ISO timestamps from the API. Apply timezone-aware bucketing in the frontend using the user's `Intl.DateTimeFormat().resolvedOptions().timeZone`. Never bucket dates server-side unless timezone is passed as a query parameter. Use `date-fns-tz` or `Temporal` for client-side timezone-aware date arithmetic.

**Phase to address:** Dashboard phase.

---

### Pitfall 14: Zero-I/O Boundary Violation in Multi-Turn and Caching

**What goes wrong:** Multi-turn conversation state or cache read/write logic creeps into `@kindlm/core`. The cache store (`readFromCache`, `writeToCache`) requires `fs` access — placing this in core violates the zero-I/O constraint and breaks Workers compatibility.

**Why it happens:** Multi-turn and caching feel like "test execution logic" and core already owns the test runner. Developers add `fs.readFileSync` calls directly into `conversation.ts` or a new `cache.ts` in core.

**How to avoid:** Follow the established injection pattern. Core defines interfaces:
- `CacheStore { get(key: string): Promise<ProviderResponse | null>; set(key: string, value: ProviderResponse): Promise<void> }`
- `ConversationRunner` receives `CacheStore` as an injected dependency (nullable — if null, caching is disabled)

CLI provides the `fs`-backed implementation in `utils/file-cache.ts`. This mirrors how `FileReader`, `HttpClient`, and `BaselineIO` are already handled.

**Warning signs:** `import { readFileSync } from "fs"` appears in any file under `packages/core/src/`. TypeScript build passes but Workers deploy fails with "fs is not defined".

**Phase to address:** All v2.3.0 phases. Define interfaces in core before any implementation is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Positional turn assertions (index-based) | Simple schema, no label required | Breaks on any branching, confusing failures | Never — label-based from day 1 |
| Cache all responses including errors | Simple implementation | Poison cache causes persistent failures | Never |
| Inline chalk calls in rich output formatter | Fast to write | Uninjectable, untestable, breaks CI | Never |
| Docker-based GitHub Action | No bundling step | Fails on macOS/Windows runners | Never for a cross-platform tool |
| Chart components without `ssr: false` | Simpler imports | SSR crash in production | Never |
| Global conversation state in conversation.ts | Avoids passing messages around | Test isolation failure, ordering bugs | Never |
| Hard-code debounce at 100ms | Simple | Breaks on slow/network file systems | Never — use chokidar `awaitWriteFinish` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Actions JS action | Forget to bundle `dist/`, use `node_modules` | Bundle with `ncc`/`esbuild`, check in `dist/index.js` |
| GitHub Actions step summary | Append raw stdout | Write structured summary only (pass/fail stats) |
| Recharts/Chart.js in Next.js App Router | Direct import in Server Component | `dynamic(() => import(...), { ssr: false })` |
| D1 timestamps in charts | Server-side date bucketing | Return UTC, bucket client-side with timezone |
| chokidar in watch mode | Manual debounce | Use `awaitWriteFinish` option |
| Caching adapter in Workers | `fs`-backed cache store in cloud package | Inject `CacheStore` interface; Workers uses KV-backed implementation |
| Multi-turn in Workers-based cloud | Conversation state on request scope | Stateless — reconstruct from stored run data per request |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cache reads block test concurrency | Tests run sequentially despite `concurrency: 8` | Cache reads must be non-blocking; use concurrent `Promise.all` for cache lookups | >4 concurrent tests with cache enabled |
| Dashboard trend chart renders all runs | Chart freezes on load for teams with 1000+ runs | Paginate API to return max 500 points; aggregate server-side | >200 runs in date range |
| Watch mode re-runs full suite on any change | Slow feedback loop | Future: filter to changed tests; v2.3.0 acceptable to re-run all | >50 tests in suite |
| Multi-turn maxTurns=20 × concurrency=8 | 160 provider calls for one test run | Warn when `maxTurns × concurrency > 50` | Immediately on misconfigured suites |
| Rich output writes all tool call args | Terminal scroll floods for large payloads | Truncate args at 500 chars with "…(truncated)" indicator | Tool call args >1KB |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cache stores provider API responses on disk unencrypted | API response may contain sensitive data from user prompts | Cache dir is `.kindlm/cache/` (gitignored by default); document that cache is local-only, never upload |
| GitHub Action logs model responses | Secrets in prompts become visible in CI logs | Strip response text from action summary; offer `mask-responses` input |
| Multi-turn stores full conversation in run artifacts | Conversation may contain PII from test fixtures | PII guardrail assertions apply to each turn individually; document scope |
| Watch mode runs `kindlm test` in cwd of project | Config file is user-controlled; path traversal in schemaFile | Existing path traversal guard (Pitfall 3 from v2.1.0) must be validated in watch mode too |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Rich output shows all tool call args by default | Information overload for passing tests | Show full args only on failure; passing tests show tool name + arg count only |
| Watch mode clears terminal on each run | Hides previous failure context during iteration | Print separator line with timestamp, not full clear |
| Cache hit/miss not visible | User doesn't know if tests ran or served cache | Print `[cached]` indicator next to test name in pretty reporter when cache hit |
| Multi-turn output shows all turns inline | Long tests produce screens of output | Collapse passing turns; expand only the failing turn |
| GitHub Action PR comment shows all test names | Large suites flood PR comments | Summarize: X/Y passed, link to full log |

---

## "Looks Done But Isn't" Checklist

- [ ] **Multi-turn:** Turn labels required in Zod schema — verify positional index is rejected with a clear error
- [ ] **Multi-turn:** `maxTurns` enforced — verify `MAX_TURNS_EXCEEDED` error fires before timeout
- [ ] **Caching:** Error responses not cached — verify `finishReason === "error"` skips cache write
- [ ] **Caching:** Object key order in cache key — verify two params objects with swapped keys produce same cache key
- [ ] **Watch mode:** Previous child killed before respawn — verify `ps aux` shows one process after rapid saves
- [ ] **Watch mode:** `SIGINT` handler kills child — verify `Ctrl+C` in watch mode terminates the child process too
- [ ] **GitHub Action:** Works on `macos-latest` — verify in action's own CI matrix
- [ ] **GitHub Action:** Model responses not in step summary — verify by inspecting summary HTML after a run
- [ ] **Dashboard charts:** `next build` succeeds without SSR errors — add to dashboard package CI
- [ ] **Dashboard charts:** Timezone bucketing correct for UTC+12 user — manual test or unit test with mocked timezone
- [ ] **Rich output:** `--no-color` flag disables all ANSI — verify with `kindlm test --no-color | cat`
- [ ] **Zero-I/O:** No `fs`/`fetch`/`console` in core — verify with `grep -r "from 'fs'" packages/core/src`

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cache poisoned with error responses | LOW | `kindlm cache clear` command; document in CLI help |
| Zombie watch processes | LOW | Kill by PID; add process cleanup to watch mode exit handler |
| Multi-turn infinite loop (no maxTurns) | MEDIUM | Add `maxTurns` to schema with migration path; existing configs without it default to 10 |
| Docker Action breaks Windows/macOS CI | HIGH | Republish action as JS action; teams must update `uses:` pin |
| SSR chart crash in production | MEDIUM | Add `ssr: false` dynamic import; fix is a patch release |
| Turn index assertions break on branching | HIGH | Requires schema migration; existing configs must add `turn.id` labels — semver minor with deprecation warning |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Multi-turn state leaking (P1) | Multi-turn testing | Vitest: two sequential tests, assert disjoint adapter call history |
| Non-deterministic branch assertions (P2) | Multi-turn schema design | Schema rejects turn index; accepts turn label only |
| Cache key collision (P3) | Response caching | Unit test: identical request, different param order → same key |
| Cache poisoning from errors (P4) | Response caching | Unit test: error response not written to cache store |
| Watch mode zombie processes (P5) | Watch mode | Integration test: rapid config saves, one process alive |
| GitHub Action Docker runtime (P6) | GitHub Action | CI matrix: ubuntu + macos + windows |
| Dashboard SSR crash (P7) | Dashboard features | `next build` in CI |
| Object insertion order in cache key (P8) | Response caching | Unit test: permuted params produce same key |
| Debounce too short (P9) | Watch mode | chokidar `awaitWriteFinish` in implementation |
| ANSI in CI (P10) | Rich failure output | `--no-color` flag; CI detection in Colorize injection |
| Multi-turn infinite loop (P11) | Multi-turn testing | `maxTurns` in schema; `MAX_TURNS_EXCEEDED` error test |
| Action leaks API keys in summary (P12) | GitHub Action | Review action output before publish |
| Dashboard timezone mismatch (P13) | Dashboard features | Unit test: UTC+12 timezone bucketing |
| Zero-I/O boundary violation (P14) | All v2.3.0 phases | `grep -r "from 'fs'" packages/core/src` in CI |

---

## Sources

- Codebase: `/Users/petr/projects/kindlm/packages/core/src/providers/conversation.ts` (tool-call loop pattern)
- Codebase: `/Users/petr/projects/kindlm/packages/cli/src/utils/run-tests.ts` (concurrency model, process handling)
- Codebase: `/Users/petr/projects/kindlm/packages/cli/src/utils/worktree.ts` (I/O boundary examples)
- Codebase: `/Users/petr/projects/kindlm/packages/core/src/reporters/interface.ts` (Colorize injection pattern)
- KindLM v2.1.0 PITFALLS.md (prior art: zero-I/O boundary, worktree file copy, ESM mocking)
- GitHub Actions JS action bundling: https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action (MEDIUM confidence — verified pattern)
- Next.js dynamic import SSR: https://nextjs.org/docs/pages/building-your-application/optimizing/lazy-loading#with-no-ssr (HIGH confidence)
- chokidar awaitWriteFinish: https://github.com/paulmillr/chokidar#api (MEDIUM confidence)

---
*Pitfalls research for: KindLM v2.3.0 feature additions*
*Researched: 2026-04-02*
