# KindLM Roadmap

## Milestones

- ✅ **v2.0.0 Launch Ops** — Phases 1-5 (shipped 2026-04-01)
- ✅ **v2.1.0 Gap Closure** — Phases 6-9 (shipped 2026-04-02)
- ✅ **v2.2.0 Core Quality** — Phases 10-12 (shipped 2026-04-02)
- 🚧 **v2.3.0 Developer Experience & Depth** — Phases 13-18 (in progress)

## Phases

<details>
<summary>✅ v2.0.0 Launch Ops (Phases 1-5) — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Deploy Everything (3/3 plans) — completed 2026-04-01
- [x] Phase 2: Append-only Run Artifacts + Versioned Baselines (1/1 plans) — completed 2026-04-01
- [x] Phase 3: Feature Flags via Config (1/1 plans) — completed 2026-04-01
- [x] Phase 4: MCP Provider Adapter (1/1 plans) — completed 2026-04-01
- [x] Phase 5: Worktree Isolation for Test Runs (1/1 plans) — completed 2026-04-01

See `.planning/milestones/v2.0.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.1.0 Gap Closure (Phases 6-9) — SHIPPED 2026-04-02</summary>

- [x] Phase 6: Cost Gating + CLI Overrides (1/1 plans) — completed 2026-04-01
- [x] Phase 7: betaJudge Multi-Pass Scoring (1/1 plans) — completed 2026-04-01
- [x] Phase 8: Worktree File Copy (1/1 plans) — completed 2026-04-01
- [x] Phase 9: CLI Utility Unit Tests (1/1 plans) — completed 2026-04-02

See `.planning/milestones/v2.1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.2.0 Core Quality (Phases 10-12) — SHIPPED 2026-04-02</summary>

- [x] Phase 10: Reporter Output + Gate Integrity (2/2 plans) — completed 2026-04-02
- [x] Phase 11: Dry Run (2/2 plans) — completed 2026-04-02
- [x] Phase 12: Validation Diagnostics (2/2 plans) — completed 2026-04-02

See `.planning/milestones/v2.2.0-ROADMAP.md` for full details.

</details>

### 🚧 v2.3.0 Developer Experience & Depth (In Progress)

**Milestone Goal:** Make KindLM faster to iterate with, deeper in agent testing capabilities, easier to adopt in CI, and useful as a team dashboard.

- [x] **Phase 13: Rich Tool Call Failure Output** - Full tool call sequence and arg diffs in pretty reporter on assertion failure (completed 2026-04-02)
- [x] **Phase 14: Response Caching** - Local SHA-256-keyed response cache with TTL, `--no-cache` flag, and `kindlm cache clear` (completed 2026-04-02)
- [ ] **Phase 15: Watch Mode** - `kindlm test --watch` re-runs on config file change with cumulative cost tracking
- [ ] **Phase 16: Multi-Turn Agent Testing** - YAML-defined conversation turns with per-turn assertions and mock tool responses
- [ ] **Phase 17: GitHub Action** - `kindlm/test@v2` JS action with PR comments, JUnit artifacts, and optional cloud upload
- [ ] **Phase 18: Dashboard Team Features** - Run history, trend charts, run comparison, and test detail drill-down

## Phase Details

### Phase 13: Rich Tool Call Failure Output
**Goal**: Developers can see exactly which tool calls were made, in what order, and how arguments differed from expectations when a tool call assertion fails
**Depends on**: Phase 12
**Requirements**: TCOUT-01, TCOUT-02, TCOUT-03, TCOUT-04, TCOUT-05, TCOUT-06
**Success Criteria** (what must be TRUE):
  1. When a tool call assertion fails, the terminal shows a numbered list of every actual tool call with its name and full arguments
  2. When `argsMatch` fails, the output shows a field-level diff (expected vs received) so the developer sees exactly which argument was wrong
  3. Passing tool call assertions display only the tool name and argument count — no argument dump
  4. Tool call arguments longer than 500 characters are truncated with a `...(truncated)` indicator rather than wrapping the terminal
  5. All failure formatting passes through the injected `Colorize` interface so it renders correctly in both terminal and CI environments
**Plans**: 1 plan
Plans:
- [x] 13-01-PLAN.md — Enrich assertion metadata + rich pretty reporter formatting

### Phase 14: Response Caching
**Goal**: Developers can iterate on assertions and config without burning API credits by serving cached responses for identical requests
**Depends on**: Phase 13
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04, CACHE-05, CACHE-06, CACHE-07, CACHE-08
**Success Criteria** (what must be TRUE):
  1. Running the same test suite twice shows `[cached]` next to test names on the second run and completes in under 1 second per cached test
  2. Running with `--no-cache` forces live provider calls regardless of what is in the cache
  3. Running `kindlm cache clear` deletes all cached responses
  4. Error responses and empty responses are never written to cache — only successful completions with text or tool calls
  5. Cache entries are invalidated automatically after 24 hours (or custom TTL from `.kindlm/config.json`)
**Plans**: 2 plans
Plans:
- [x] 14-01-PLAN.md — Cache key sorting, TTL expiry, error guard, and fromCache type threading
- [x] 14-02-PLAN.md — Cache clear command and pretty reporter [cached] indicator

### Phase 15: Watch Mode
**Goal**: Developers can save their config file and immediately see test results without re-running the CLI manually
**Depends on**: Phase 14
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07
**Success Criteria** (what must be TRUE):
  1. Saving `kindlm.yaml` (or any referenced schema file) while `kindlm test --watch` is running triggers a test re-run automatically
  2. When a re-run is triggered while a previous run is still executing, the previous run is killed before the new one starts
  3. Each re-run is separated by a timestamped separator line — the terminal is not cleared so the user can scroll back
  4. The cumulative API cost across the watch session is displayed after each run
  5. Pressing `Ctrl+C` terminates watch mode cleanly — no zombie test processes remain and the file watcher is closed
**Plans**: 2 plans
Plans:
- [x] 15-01-PLAN.md — Replace node:fs.watch with chokidar 4.x multi-file watcher
- [ ] 15-02-PLAN.md — Wire watch mode with abort, cost tracking, separators, and signal handling

### Phase 16: Multi-Turn Agent Testing
**Goal**: Developers can define and assert on multi-turn agent conversations in YAML, including mock tool responses, without live tool backends
**Depends on**: Phase 12
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08
**Success Criteria** (what must be TRUE):
  1. A user can define a `conversation:` block in YAML with labeled turns, each having its own `expect:` using any existing assertion type
  2. A user can define `onToolCall` mappings in YAML to mock tool responses — the conversation runner uses these without any live backend
  3. If the conversation exceeds `maxTurns` (default 10, hard cap 20), the test fails with `MAX_TURNS_EXCEEDED` rather than running forever
  4. Conversation state (message history) is completely isolated between test cases — one test cannot leak messages into another
  5. The pretty reporter groups assertion results by turn label so the developer can see which turn caused a failure
**Plans**: 1 plan
Plans:
- [ ] 13-01-PLAN.md — Enrich assertion metadata + rich pretty reporter formatting

### Phase 17: GitHub Action
**Goal**: Teams can add KindLM to a GitHub Actions workflow in under 5 minutes and get PR comments with test summaries and JUnit artifacts
**Depends on**: Phase 13
**Requirements**: ACTION-01, ACTION-02, ACTION-03, ACTION-04, ACTION-05, ACTION-06, ACTION-07, ACTION-08
**Success Criteria** (what must be TRUE):
  1. Adding `uses: kindlm/test@v2` to a workflow runs on ubuntu-latest, macos-latest, and windows-latest without modification
  2. After the action runs, PR comments show pass/fail counts and the names of failing tests — no raw model responses are included
  3. A JUnit XML artifact is uploaded to GitHub so the test summary tab shows a structured breakdown
  4. Setting the `cloud-token` input causes results to be automatically uploaded to KindLM Cloud
  5. The action outputs `pass-rate`, `total`, `passed`, `failed`, and `exit-code` step outputs for downstream workflow steps
**Plans**: 1 plan
Plans:
- [ ] 13-01-PLAN.md — Enrich assertion metadata + rich pretty reporter formatting

### Phase 18: Dashboard Team Features
**Goal**: Team members can view test history, spot regressions in trend charts, compare two runs side-by-side, and drill into individual test results
**Depends on**: Phase 12
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10
**Success Criteria** (what must be TRUE):
  1. The run history page shows a paginated list of runs with pass rate, duration, git branch, commit SHA, and date — filterable by branch, suite, and date range
  2. A trend chart shows pass rate over the last 30 runs as a line chart, with a secondary line for cost over time
  3. Selecting two runs opens a side-by-side comparison showing which individual tests changed status between runs
  4. Clicking a test result shows its assertion outcomes, tool calls, and model response in a detail view
  5. All chart components load client-side only (no SSR) so the dashboard never crashes on initial page render
**Plans**: 1 plan
Plans:
- [ ] 13-01-PLAN.md — Enrich assertion metadata + rich pretty reporter formatting
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Deploy Everything | v2.0.0 | 3/3 | Complete | 2026-04-01 |
| 2. Append-only Run Artifacts + Versioned Baselines | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 3. Feature Flags via Config | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 4. MCP Provider Adapter | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 5. Worktree Isolation for Test Runs | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 6. Cost Gating + CLI Overrides | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 7. betaJudge Multi-Pass Scoring | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 8. Worktree File Copy | v2.1.0 | 1/1 | Complete | 2026-04-01 |
| 9. CLI Utility Unit Tests | v2.1.0 | 1/1 | Complete | 2026-04-02 |
| 10. Reporter Output + Gate Integrity | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 11. Dry Run | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 12. Validation Diagnostics | v2.2.0 | 2/2 | Complete | 2026-04-02 |
| 13. Rich Tool Call Failure Output | v2.3.0 | 1/1 | Complete    | 2026-04-02 |
| 14. Response Caching | v2.3.0 | 2/2 | Complete    | 2026-04-02 |
| 15. Watch Mode | v2.3.0 | 1/2 | In Progress|  |
| 16. Multi-Turn Agent Testing | v2.3.0 | 0/? | Not started | - |
| 17. GitHub Action | v2.3.0 | 0/? | Not started | - |
| 18. Dashboard Team Features | v2.3.0 | 0/? | Not started | - |
