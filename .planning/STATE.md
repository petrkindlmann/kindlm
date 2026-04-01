---
gsd_state_version: 1.0
milestone: v2.0.0
milestone_name: milestone
status: Ready to plan
stopped_at: Completed 02-append-only-run-artifacts-and-versioned-baselines-02-01-PLAN.md
last_updated: "2026-04-01T03:02:25.234Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 7
  completed_plans: 4
  percent: 57
---

## Status: Active

**Current focus:** Phase 02 — append-only-run-artifacts-and-versioned-baselines
**Progress:** [█████░░░░░] 57%
**Last session:** 2026-03-31 - Completed 02-01: append-only run artifacts + immutable baseline versioning
**Stopped at:** Completed 02-append-only-run-artifacts-and-versioned-baselines-02-01-PLAN.md

## Current Phase

**Phase 02: append-only-run-artifacts-and-versioned-baselines**

- Plan 01: Append-only run artifacts + versioned baselines — COMPLETE (commits 8c5b826, de8567d)

## Decisions

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-jxl | write the VS Code Extension docs page + any other missing docs | 2026-03-30 | 5603cbf | [260330-jxl-write-the-vs-code-extension-docs-page-an](./quick/260330-jxl-write-the-vs-code-extension-docs-page-an/) |
| 260331-ti8 | Expand RunEvent union, split executeUnit helpers, add ProviderToolCall index, judge static-dynamic boundary | 2026-03-31 | 5182066 | [260331-ti8-expand-runevent-union-split-executeunit-](./quick/260331-ti8-expand-runevent-union-split-executeunit-/) |
