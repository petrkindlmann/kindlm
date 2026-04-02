# Feature Landscape — KindLM v2.3.0 Developer Experience & Depth

**Researched:** 2026-04-02
**Confidence:** HIGH (codebase-informed) / MEDIUM (competitor patterns)

---

## 1. Multi-Turn Agent Testing

### How competitors handle it

**promptfoo:** Linear conversation arrays — each turn is a message with assertions. No branching. Users define `conversation: [{role, content, assert}]`. Simple but can't model "if tool A fails, expect tool B".

**deepeval:** `ConversationalMetric` wraps a sequence of exchanges. Assertions are on the full conversation, not per-turn. Good for coherence scoring, weak for tool-call decision trees.

**braintrust:** Traces agent execution, maps spans to assertions. Closest to decision-tree testing but requires OpenTelemetry instrumentation (KindLM already has trace support).

### Table stakes
- Multi-turn conversations defined in YAML with turn labels
- Assertions per turn (not just end-of-conversation)
- `maxTurns` limit to prevent infinite loops
- Tool call simulation (mock tool responses in config)

### Differentiators
- **Conditional branching:** Define expected paths based on tool call results. "If agent calls `search`, respond with results and expect `summarize` next. If agent calls `ask_user`, respond with clarification and expect `search` next."
- **Decision tree assertions:** Assert on the path taken, not just the final state
- **Turn-scoped assertions:** Each turn can have its own `expect:` block with all 11 assertion types

### Anti-features
- Visual flow editor — complexity not justified for YAML-first tool
- Automatic conversation generation — users should define their test scenarios explicitly

### Complexity: HIGH — touches core config schema, conversation runner, assertion registry, engine, reporters

---

## 2. Response Caching

### How competitors handle it

**promptfoo:** Built-in caching with `--no-cache` to bypass. Hash of prompt+model. Stored in `.promptfoo/cache/`. Very effective for iteration.

**braintrust:** Project-level caching with API-side deduplication.

### Table stakes
- Local file-based cache in `.kindlm/cache/`
- Cache key: SHA-256 of full request (model + params + messages + tools)
- `--no-cache` flag to bypass
- Only cache successful responses (not errors)
- `kindlm cache clear` subcommand

### Differentiators
- **[cached]** indicator in pretty reporter output — user always knows what was cached
- Cache works with `--watch` mode for instant re-runs after config-only changes
- TTL-based expiry (default 24h, configurable)

### Anti-features
- Cloud-side caching — adds complexity, local cache is sufficient for dev workflow
- Partial cache (cache some tests, run others) — all-or-nothing is simpler

### Complexity: MEDIUM — core interface + CLI implementation, touches provider adapter wrapping

---

## 3. Rich Tool Call Failure Output

### What good failure output looks like (from testing frameworks)

**Jest:** Shows expected vs received with colored diff, indented object trees
**Vitest:** Same pattern + inline diff for string comparisons
**promptfoo:** Shows full response including tool calls in failure output

### Table stakes
- On tool call assertion failure, show:
  - Expected: tool name + args pattern
  - Received: full list of actual tool calls with names + args
  - Diff highlighting (green expected, red actual)
- Truncate large args (>500 chars) with `...(truncated)` indicator

### Differentiators
- **Call sequence visualization:** Numbered list showing the order of all tool calls made
- **Arg diff:** When `argsMatch` fails, show which specific arg fields differ
- **Passing test brevity:** Only show tool name + arg count for passing assertions

### Anti-features
- Full JSON dump of all tool call args on pass — information overload
- Interactive debugger for tool call inspection — scope creep

### Complexity: LOW — extends existing reporter `formatAssertion` + assertion metadata

---

## 4. GitHub Action

### How popular testing actions work

**vitest action:** Composite action that installs, runs, and posts comment. Simple.
**playwright action:** JS action with bundled dist/. Sets up browser, runs tests, uploads artifacts.
**jest action:** Third-party, mostly composite. Posts PR comment with results.

### Table stakes
- `kindlm/test@v2` usable in any workflow
- Inputs: `config` (path to kindlm.yaml), `reporter` (default: junit), provider API key env vars
- Outputs: `pass-rate`, `total`, `passed`, `failed`, exit code
- JUnit artifact upload for GitHub test summary integration
- Works on ubuntu, macos, windows runners

### Differentiators
- **PR comment** with test summary (pass/fail count, failing test names)
- **Cloud upload** if `KINDLM_API_TOKEN` is set (optional, zero-config when token present)

### Anti-features
- Auto-installing Node.js — assume it's already set up (users use `actions/setup-node`)
- Docker-based action — fails on non-Linux runners

### Complexity: MEDIUM — separate repo/package, bundling, CI matrix testing

---

## 5. Watch Mode

### How dev tools implement watch mode

**vitest:** `--watch` is default. Re-runs on source change. Shows inline results. `q` to quit.
**jest:** `--watch` with interactive mode (filter by name, re-run failed). 
**eslint:** `--watch` not built-in (uses external `esw`).

### Table stakes
- `kindlm test --watch` watches `kindlm.yaml` and all referenced files
- Debounced re-run (300ms stabilization via chokidar `awaitWriteFinish`)
- Kill previous run before starting new one (no zombie processes)
- Clear separator between runs (timestamp + line, not full terminal clear)
- `Ctrl+C` cleanly exits and kills any running test process

### Differentiators
- **Cost awareness:** Show cumulative cost across watch session
- **[cached]** indicators — combined with response cache, re-runs after config-only changes are instant and free

### Anti-features
- Interactive mode (filter tests, re-run failed) — over-engineered for v2.3.0
- File watching beyond config + referenced files — don't watch source code

### Complexity: MEDIUM — CLI-only, process management, signal handling

---

## 6. Dashboard Team Features

### What testing dashboards provide

**Datadog Test Visibility:** Time-series pass rate, flaky test detection, test duration trends, branch comparison.
**Grafana Test Analytics:** Configurable dashboards, custom queries, alerting.
**promptfoo web UI:** Run comparison side-by-side, prompt history, eval scoring visualization.

### Table stakes
- **Test history:** Paginated list of runs with pass rate, duration, git branch/commit
- **Run comparison:** Side-by-side diff of two runs (which tests changed status)
- **Trend chart:** Pass rate over time (line chart, last 30 runs)
- **Search:** Filter runs by suite name, branch, date range

### Differentiators
- **Failing test drill-down:** Click a failing test to see assertion details, tool calls, model response
- **Cost tracking:** Cumulative cost per run, cost trend over time
- **Branch comparison:** Compare pass rates between branches (CI context)

### Anti-features
- Real-time collaboration (live cursors, comments) — not a collaboration tool
- Custom dashboard builder — fixed layouts are fine for v2.3.0
- Alerting/notifications — Slack webhooks already exist for this

### Complexity: HIGH — new cloud API routes, new dashboard pages, charting, data queries

---

## Feature Dependencies

```
Rich failure output (standalone) — no deps on other features
Response caching (standalone) — enables watch mode cost savings
Watch mode — benefits from cache but works without it
Multi-turn testing (standalone) — independent of other features
GitHub Action (standalone) — uses existing CLI, no new core deps
Dashboard features — depends on existing cloud API, independent of CLI features
```

## Build Order (by dependency + complexity)

1. Rich tool call failure output (LOW complexity, no deps, quick win)
2. Response caching (MEDIUM, enables watch mode value)
3. Watch mode (MEDIUM, better with cache)
4. Multi-turn agent testing (HIGH, independent)
5. GitHub Action (MEDIUM, independent, separate repo)
6. Dashboard team features (HIGH, independent)

Phases 4-6 are independent and could be parallelized or reordered.
