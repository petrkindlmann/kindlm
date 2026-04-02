# Requirements: KindLM v2.3.0

**Defined:** 2026-04-02
**Core Value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## v2.3.0 Requirements

Requirements for v2.3.0 Developer Experience & Depth. Each maps to roadmap phases.

### Rich Tool Call Failure Output

- [ ] **TCOUT-01**: When a tool call assertion fails, the pretty reporter shows the full list of actual tool calls with names and arguments
- [ ] **TCOUT-02**: When `argsMatch` fails, the failure output highlights which specific argument fields differ (expected vs received)
- [ ] **TCOUT-03**: Tool call failure output includes a numbered call sequence showing all tool calls in execution order
- [ ] **TCOUT-04**: Tool call arguments longer than 500 characters are truncated with a `...(truncated)` indicator
- [ ] **TCOUT-05**: Passing tool call assertions show only the tool name and argument count (no full args)
- [ ] **TCOUT-06**: All rich failure formatting uses the injected `Colorize` interface (no direct chalk calls in core)

### Response Caching

- [ ] **CACHE-01**: `CacheStore` interface defined in `@kindlm/core` with `get`, `set`, `clear` methods
- [ ] **CACHE-02**: File-based cache implementation in CLI stores responses in `.kindlm/cache/` as JSON files
- [ ] **CACHE-03**: Cache key is SHA-256 of model + sorted params + messages + tools (deterministic regardless of object key order)
- [ ] **CACHE-04**: Only successful responses are cached (`finishReason !== "error"` AND non-empty text or tool calls)
- [ ] **CACHE-05**: `--no-cache` flag on `kindlm test` bypasses cache entirely (no reads, no writes)
- [ ] **CACHE-06**: `kindlm cache clear` subcommand deletes all cached responses
- [ ] **CACHE-07**: Pretty reporter shows `[cached]` indicator next to test name when response was served from cache
- [ ] **CACHE-08**: Cache entries expire after configurable TTL (default 24 hours, checked on read)

### Watch Mode

- [ ] **WATCH-01**: `kindlm test --watch` watches the config file and all referenced files for changes using chokidar
- [ ] **WATCH-02**: On file change, the previous test run is killed before starting a new one (no zombie processes)
- [ ] **WATCH-03**: File change detection uses chokidar `awaitWriteFinish` with 300ms stabilization threshold
- [ ] **WATCH-04**: Between runs, a separator line with timestamp is printed (not full terminal clear)
- [ ] **WATCH-05**: Cumulative API cost is tracked and displayed across the watch session
- [ ] **WATCH-06**: `Ctrl+C` cleanly exits watch mode, killing any running test process and closing the file watcher
- [ ] **WATCH-07**: Watch mode works with response cache — config-only changes re-run from cache instantly

### Multi-Turn Agent Testing

- [ ] **CONV-01**: Users can define multi-turn conversations in YAML with labeled turns under a `conversation:` block
- [ ] **CONV-02**: Each turn has its own `expect:` block supporting all existing assertion types
- [ ] **CONV-03**: Users can define mock tool responses via `onToolCall` mapping (tool name → response payload)
- [ ] **CONV-04**: `maxTurns` config field limits conversation length (default 10, max 20), failing with `MAX_TURNS_EXCEEDED` if exceeded
- [ ] **CONV-05**: Conversation state (messages array) is isolated per test case — never shared across test boundaries
- [ ] **CONV-06**: The conversation runner lives in `@kindlm/core` as a pure state machine with no I/O dependencies
- [ ] **CONV-07**: Pretty reporter groups assertion results by turn label
- [ ] **CONV-08**: Zod schema validates conversation config with clear error messages for missing turn labels or invalid structure

### GitHub Action

- [ ] **ACTION-01**: `kindlm/test@v2` GitHub Action works on ubuntu-latest, macos-latest, and windows-latest runners
- [ ] **ACTION-02**: Action accepts inputs: `config` (path), `reporter` (type), `args` (extra CLI args), `cloud-token` (optional)
- [ ] **ACTION-03**: Action outputs: `pass-rate`, `total`, `passed`, `failed`, `exit-code`
- [ ] **ACTION-04**: Action uploads JUnit XML as a GitHub artifact for test summary integration
- [ ] **ACTION-05**: Action posts a PR comment with test summary (pass/fail count, failing test names)
- [ ] **ACTION-06**: When `cloud-token` input is set, action auto-uploads results to KindLM Cloud
- [ ] **ACTION-07**: Action is bundled as a JS action (`runs.using: node20`) with `dist/index.js` via @vercel/ncc
- [ ] **ACTION-08**: Action never writes raw model responses to step summary (security: prevent API key/sensitive data leaks)

### Dashboard Team Features

- [ ] **DASH-01**: Run history page shows paginated list of runs with pass rate, duration, git branch, commit, date
- [ ] **DASH-02**: Run history supports filtering by branch, suite name, and date range
- [ ] **DASH-03**: Trend chart shows pass rate over time as a line chart (recharts, last 30 runs by default)
- [ ] **DASH-04**: Trend chart shows cost over time as a secondary line
- [ ] **DASH-05**: Run comparison page shows side-by-side diff of two runs highlighting which tests changed status
- [ ] **DASH-06**: Test detail drill-down shows assertion results, tool calls, and model response for a specific test
- [ ] **DASH-07**: All chart components use `dynamic(() => import(), { ssr: false })` to prevent SSR crashes
- [ ] **DASH-08**: Dashboard API returns UTC timestamps; date bucketing happens client-side with user's timezone
- [ ] **DASH-09**: Cloud API supports `GET /v1/projects/:id/runs/trends` endpoint with day-bucketed aggregation
- [ ] **DASH-10**: Cloud API supports `GET /v1/runs/:id/compare/:otherId` endpoint for run comparison data

## Future Requirements

Deferred to v2.4.0+. Tracked but not in current roadmap.

### Multi-Turn Extensions
- **CONV-F01**: Conditional branching — define expected paths based on tool call results
- **CONV-F02**: Decision tree assertions — assert on the path taken through the conversation

### Watch Mode Extensions
- **WATCH-F01**: Interactive mode — filter tests by name, re-run only failed tests
- **WATCH-F02**: Source file watching — re-run when agent source code changes (not just config)

### Dashboard Extensions
- **DASH-F01**: Flaky test detection — flag tests with inconsistent pass/fail across runs
- **DASH-F02**: Branch comparison — compare pass rates between git branches
- **DASH-F03**: Custom alerting — configure thresholds that trigger notifications

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual conversation flow editor | Complexity not justified for YAML-first tool |
| Cloud-side response caching | Local cache sufficient for dev workflow; adds cloud complexity |
| Docker-based GitHub Action | Fails on macOS/Windows runners |
| Interactive watch mode (v2.3.0) | Over-engineered; simple re-run-all is sufficient for initial release |
| Real-time dashboard collaboration | Not a collaboration tool; test results are async by nature |
| Custom dashboard builder | Fixed layouts sufficient for v2.3.0 |
| Recursive $ref scanning in cache key | Single-level sufficient; document as known limitation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TCOUT-01 | Phase 13 | Pending |
| TCOUT-02 | Phase 13 | Pending |
| TCOUT-03 | Phase 13 | Pending |
| TCOUT-04 | Phase 13 | Pending |
| TCOUT-05 | Phase 13 | Pending |
| TCOUT-06 | Phase 13 | Pending |
| CACHE-01 | Phase 14 | Pending |
| CACHE-02 | Phase 14 | Pending |
| CACHE-03 | Phase 14 | Pending |
| CACHE-04 | Phase 14 | Pending |
| CACHE-05 | Phase 14 | Pending |
| CACHE-06 | Phase 14 | Pending |
| CACHE-07 | Phase 14 | Pending |
| CACHE-08 | Phase 14 | Pending |
| WATCH-01 | Phase 15 | Pending |
| WATCH-02 | Phase 15 | Pending |
| WATCH-03 | Phase 15 | Pending |
| WATCH-04 | Phase 15 | Pending |
| WATCH-05 | Phase 15 | Pending |
| WATCH-06 | Phase 15 | Pending |
| WATCH-07 | Phase 15 | Pending |
| CONV-01 | Phase 16 | Pending |
| CONV-02 | Phase 16 | Pending |
| CONV-03 | Phase 16 | Pending |
| CONV-04 | Phase 16 | Pending |
| CONV-05 | Phase 16 | Pending |
| CONV-06 | Phase 16 | Pending |
| CONV-07 | Phase 16 | Pending |
| CONV-08 | Phase 16 | Pending |
| ACTION-01 | Phase 17 | Pending |
| ACTION-02 | Phase 17 | Pending |
| ACTION-03 | Phase 17 | Pending |
| ACTION-04 | Phase 17 | Pending |
| ACTION-05 | Phase 17 | Pending |
| ACTION-06 | Phase 17 | Pending |
| ACTION-07 | Phase 17 | Pending |
| ACTION-08 | Phase 17 | Pending |
| DASH-01 | Phase 18 | Pending |
| DASH-02 | Phase 18 | Pending |
| DASH-03 | Phase 18 | Pending |
| DASH-04 | Phase 18 | Pending |
| DASH-05 | Phase 18 | Pending |
| DASH-06 | Phase 18 | Pending |
| DASH-07 | Phase 18 | Pending |
| DASH-08 | Phase 18 | Pending |
| DASH-09 | Phase 18 | Pending |
| DASH-10 | Phase 18 | Pending |

**Coverage:**
- v2.3.0 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
