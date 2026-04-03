# Milestones

## v2.3.0 Developer Experience & Depth (Shipped: 2026-04-03)

**Phases completed:** 6 phases, 12 plans, 11 tasks

**Key accomplishments:**

- Task 1 — Assertion metadata enrichment (`tool-calls.ts`):
- `packages/cli/src/utils/cache.ts`
- One-liner:
- Full watch mode implementation in `packages/cli/src/commands/test.ts`:
- One-liner:
- pretty.ts
- GitHub Action `kindlm/test@v2` scaffolded with action.yml (6 inputs, 5 outputs, node20), TypeScript source that installs @kindlm/cli, runs with JSON reporter, parses structured output, and uploads to Cloud non-fatally
- PR comment upsert with marker-based dedup, JUnit XML generation with artifact upload, and 34 unit tests covering all modules — ncc builds dist/index.js cleanly
- 1. [Rule 1 - Bug] Test fixtures missing new required fields
- Recharts dual Y-axis trend chart with ssr: false, URL-persisted filter bar, duration column, and checkbox-driven run comparison selection wired into the runs page
- Task 1 — Run comparison page

---

## v2.2.0 Core Quality (Shipped: 2026-04-02)

**Phases completed:** 7 phases, 10 plans, 7 tasks

**Key accomplishments:**

- `packages/cli/src/commands/test.ts`
- `extractConfigFilePaths(yamlContent: string): string[]`
- Vitest unit tests for formatTestPlan, selectReporter, and createSpinner — completing v2.1.0 CLI test coverage with 20 new tests across 3 files
- pretty reporter formatAssertion() now appends an 8-space indented "Reasoning: {text}" line for all judge assertions — dimmed on pass, normal weight on fail
- KINDLM_PRICING consolidated table and estimateDryRunCost helper wired into buildTestPlan so each TestPlanEntry carries per-entry cost and TestPlan carries a total
- formatTestPlan wired to display per-entry ~$X.XXXXXX cost and total Estimated cost summary, completing all five DRY requirements
- One-liner:
- One-liner:

---

## v2.1.0 Gap Closure (Shipped: 2026-04-02)

**Phases completed:** 4 phases, 4 plans, 2 tasks

**Key accomplishments:**

- `packages/cli/src/commands/test.ts`
- `extractConfigFilePaths(yamlContent: string): string[]`
- Vitest unit tests for formatTestPlan, selectReporter, and createSpinner — completing v2.1.0 CLI test coverage with 20 new tests across 3 files

---

## v2.0.0 Launch Ops (Shipped: 2026-04-01)

**Phases completed:** 5 phases, 7 plans, 10 tasks

**Key accomplishments:**

- Fixed 9 TypeScript strict-mode errors and 4 ESLint errors across core/cloud to unblock CI before deploy
- Cloud Worker kindlm-api deployed to api.kindlm.com, all 13 D1 migrations applied to kindlm-prod, 5 commits pushed to origin/main, and v2.0.0 confirmed live on npm
- Sentry monitoring, VS Code extension, and Stripe billing wired up for KindLM Cloud — final manual credential steps for production readiness.
- Append-only run artifacts (`.kindlm/runs/{runId}/{executionId}/`) and immutable versioned baselines with nonce-unique filenames, giving every test run a queryable history
- CLI-layer feature flag system (`features.ts`, `isEnabled()`) reading `.kindlm/config.json`, wired into `run-tests.ts` with safe defaults
- MCP provider adapter — passthrough HTTP POST adapter letting users point kindlm at any MCP server as a first-class provider source
- `--isolate` flag for git worktree-based test isolation with fail-closed cleanup and graceful degradation when git is unavailable

---
