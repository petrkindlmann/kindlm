# KindLM Launch Ops Roadmap

## Phase 1: Deploy Everything

**Goal:** Fix CI blockers, push code, deploy worker, run migrations, confirm v2.0.0 publish, complete manual credential setup
**Requirements:** OPS-01 through OPS-08
**Plans:** 2/3 plans executed

Plans:
- [x] 01-01-PLAN.md -- Fix CI blockers (typecheck + lint errors) and verify migration state
- [x] 01-02-PLAN.md -- Push to remote, deploy Cloud Worker, run D1 migrations, confirm v2.0.0
- [x] 01-03-PLAN.md -- Manual steps: CF_API_TOKEN, SENTRY_DSN, VS Code extension, Stripe products

**Success:** v2.0.0 on npm, Cloud Worker deployed with new features, all migrations applied, monitoring and billing configured

### Phase 2: Append-only run artifacts and versioned baselines

**Goal:** Persist structured run artifacts to .kindlm/runs/ and enforce immutable baseline history so every test run is queryable and no baseline is ever silently overwritten
**Requirements**: ARTIFACT-01, ARTIFACT-02, BASELINE-01
**Depends on:** Phase 1
**Plans:** 1/1 plans complete

Plans:
- [x] 02-01-PLAN.md — Run artifact writer, last-run pointer extension, immutable baseline versioning, wire into test command

### Phase 3: Feature flags via config — boolean flags in .kindlm/config.json, isEnabled helper, gate new assertion types behind flags

**Goal:** CLI-layer feature flag system: read .kindlm/config.json, expose isEnabled(), gate betaJudge / costGating / runArtifacts flags in run-tests.ts
**Requirements**: FF-01, FF-02, FF-03
**Depends on:** Phase 2
**Plans:** 1/1 plans complete

Plans:
- [x] 03-01-PLAN.md — Create features.ts (loadFeatureFlags, isEnabled) and wire into run-tests.ts

### Phase 4: MCP provider adapter — passthrough adapter letting users point kindlm at an MCP server as a provider source

**Goal:** Add MCP as a first-class provider type — users configure serverUrl + toolName, kindlm sends prompts to the MCP server via HTTP POST and maps the tool result to ProviderResponse for all existing assertion types
**Requirements**: MCP-01
**Depends on:** Phase 3
**Plans:** 1/1 plans complete

Plans:
- [x] 04-01-PLAN.md — MCP adapter (mcp.ts), schema + registry + CLI wiring

### Phase 5: Worktree isolation for test runs — run each test suite in an isolated git worktree, slug validation, fail-closed exit

**Goal:** Add opt-in `--isolate` flag to `kindlm test` that runs each suite inside a fresh git worktree, with fail-closed cleanup (warn + leave worktree if dirty) and graceful degradation when git is unavailable
**Requirements**: WORKTREE-01, WORKTREE-02, WORKTREE-03
**Depends on:** Phase 4
**Plans:** 1 plan

Plans:
- [ ] 05-01-PLAN.md — Create worktree.ts utility (slug validation, create/remove/inspect) and wire --isolate into kindlm test
