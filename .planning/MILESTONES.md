# Milestones

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
