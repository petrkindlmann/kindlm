---
gsd_state_version: 1.0
milestone: v2.0.0
milestone_name: Launch Ops
status: Milestone complete — archived
stopped_at: gsd:complete-milestone v2.0.0
last_updated: "2026-04-01T06:45:00.000Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 7
  completed_plans: 7
  percent: 100
---

## Status: Milestone Complete

**Milestone:** v2.0.0 Launch Ops — SHIPPED 2026-04-01
**Progress:** [██████████] 100%

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-01)

**Core value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code
**Current focus:** Planning next milestone

## Tech Debt (from v2.0.0 audit)

- `runArtifacts` feature flag has no effect — stub in `run-tests.ts`, write in `test.ts` is unconditional
- `--isolate` worktree path created but not used as test cwd
- Stripe live-mode products need sk_live_ key (user action required)

## Decisions (archived to PROJECT.md Key Decisions table)

- (01-01) Use `!` non-null assertion in test files for `.mock.calls[0]` — acceptable in test context where preceding setup guarantees the call
- (01-01) Prefix unused cloud helpers with `_` instead of deleting (ECDSA/XML SAML helpers are valid implementations worth retaining)
- (01-01) Use nullish coalescing `?? 0` for Uint8Array element access in helpers.ts — semantically correct
- [Phase 01-deploy-everything]: Deploy order: D1 migrations before Worker deploy for safe schema-first rollout
- [Phase 01-deploy-everything]: D1 migration tracker recovery: manually INSERT into d1_migrations when partial apply leaves schema ahead of tracker
- [Phase 01-deploy-everything]: Stripe test mode products created first — live mode pending sk_live_ key with full permissions
- [Phase 01-deploy-everything]: CF_API_TOKEN deferred (non-blocking) — requires Cloudflare token with Workers Edit permissions set as GitHub Actions secret

- [02-01]: computeRunId uses SHA-256 of suiteName:configHash:gitCommit (40-char slice) for deterministic, retry-safe run IDs
- [02-01]: writeBaselineVersioned pointer file contains only latestFile reference (no content copy) — single source of truth
- [02-01]: Pre-existing lint errors in caching-adapter.ts + watcher.test.ts deferred (out of scope)
- [Phase 03-01]: All flags default to false — absent or malformed config.json returns DEFAULTS without throwing
- [Phase 03-01]: featureFlags is optional on RunTestsOptions so all existing callers remain unaffected
- [Phase 04-01]: extractMcpText ordering: content[0].text (MCP protocol) then result then output — matches MCP spec priority
- [Phase 04-01]: env: header resolution in CLI only — preserves zero-I/O constraint in @kindlm/core
- [Phase 05-worktree-isolation]: Manual Promise wrapper over promisify(execFile) preserves vi.mock compatibility — promisify.custom is lost when the module is mocked
- [Phase 05-worktree-isolation]: Detached HEAD worktree (git worktree add --detach) avoids branch name conflicts for concurrent runs

## Accumulated Context

### Roadmap Evolution

- Phase 02 added: Append-only run artifacts and versioned baselines
- Phase 03 added: Feature flags via config
- Phase 04 added: MCP provider adapter
- Phase 05 added: Worktree isolation for test runs

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-deploy-everything | 01 | 2min | 3 | 4 |
| Phase 01-deploy-everything P02 | 5min | 2 tasks | 0 files |
| 02-append-only-run-artifacts-and-versioned-baselines | 01 | 13min | 2 | 8 |
| Phase 03-feature-flags P01 | 2min | 2 tasks | 3 files |
| Phase 04-mcp-provider-adapter P01 | 3min | 2 tasks | 5 files |
| Phase 05-worktree-isolation P01 | 6min | 2 tasks | 3 files |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-jxl | write the VS Code Extension docs page + any other missing docs | 2026-03-30 | 5603cbf | [260330-jxl-write-the-vs-code-extension-docs-page-an](./quick/260330-jxl-write-the-vs-code-extension-docs-page-an/) |
| 260331-ti8 | Expand RunEvent union, split executeUnit helpers, add ProviderToolCall index, judge static-dynamic boundary | 2026-03-31 | 5182066 | [260331-ti8-expand-runevent-union-split-executeunit-](./quick/260331-ti8-expand-runevent-union-split-executeunit-/) |
