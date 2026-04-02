---
gsd_state_version: 1.0
milestone: v2.1.0
milestone_name: Gap Closure
status: completed
last_updated: "2026-04-02T05:27:15.139Z"
last_activity: 2026-04-02
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 4
  completed_plans: 4
---

## Current Position

Phase: 09 (cli-utility-unit-tests) — COMPLETE
Plan: 1 of 1 — DONE
Status: v2.1.0 Gap Closure milestone complete — all 4 phases done
Last activity: 2026-04-02

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-01)

**Core value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code
**Current focus:** Phase 09 — cli-utility-unit-tests

## Tech Debt

- Stripe live-mode products need sk_live_ key (user action required)

**Verified resolved (2026-04-02):**
- `runArtifacts` properly gated in `run-tests.ts:302` ✓
- Integration tests: 269 passing, 0 failures ✓
- `--isolate` worktree isolation complete (ISOLATE-01 closed in Phase 8) ✓

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
- [Phase 07-01]: betaJudge uses ceil(3/2)=2 quorum — prevents poisoned median from transient API failures
- [Phase 07-01]: Median = scores[Math.floor(scores.length/2)] on sorted array — deterministic for both even and odd successful-pass counts
- [09-01]: No chalk mocking in dry-run tests — strip ANSI with regex helper, use .toContain() for substring assertions
- [09-01]: process.exit mock throws Error to halt execution at call site; type widened to string|number|null for Node.js overload compatibility
- [09-01]: ora module-level mock uses shared mockInstance defined outside vi.mock factory; reset via vi.clearAllMocks() in beforeEach

## Accumulated Context

### Roadmap Evolution

- Phase 02 added: Append-only run artifacts and versioned baselines
- Phase 03 added: Feature flags via config
- Phase 04 added: MCP provider adapter
- Phase 05 added: Worktree isolation for test runs
- Phases 06-09 added: v2.1.0 Gap Closure milestone

### v2.1.0 Phase Summary

| Phase | Requirements | Risk |
|-------|-------------|------|
| 6. Cost Gating + CLI Overrides | COST-01, CLI-01, CLI-02 | Low — pure CLI mutations |
| 7. betaJudge Multi-Pass Scoring | JUDGE-01 | Medium — core logic, no I/O |
| 8. Worktree File Copy | ISOLATE-01 | High — new file, I/O, path guards |
| 9. CLI Utility Unit Tests | TEST-01, TEST-02, TEST-03 | Low — standard Vitest patterns |

### Key Implementation Notes (from research)

- betaJudge: distinguish `JUDGE_EVAL_ERROR` from genuine low scores before computing median; require `ceil(N/2)` successful passes
- costGating TOCTOU: reserve estimated cost synchronously before `complete()` call; use microdollar accumulation for float safety
- ISOLATE-01: `lstat` + `realpath` + boundary check per file; treat missing optional files as non-fatal
- spinner.ts tests: mock `ora` directly in `spinner.test.ts`; mock `spinner.ts` wrapper in caller tests (ESM hoisting)
- --concurrency validation: follow existing `--runs` guard pattern — `if (!Number.isInteger(n) || n < 1) → exit(1)`

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-deploy-everything | 01 | 2min | 3 | 4 |
| Phase 01-deploy-everything P02 | 5min | 2 tasks | 0 files |
| 02-append-only-run-artifacts-and-versioned-baselines | 01 | 13min | 2 | 8 |
| Phase 03-feature-flags P01 | 2min | 2 tasks | 3 files |
| Phase 04-mcp-provider-adapter P01 | 3min | 2 tasks | 5 files |
| Phase 05-worktree-isolation P01 | 6min | 2 tasks | 3 files |
| Phase 06-cost-gating-cli-overrides P01 | 8min | 2 tasks | 3 files |
| Phase 07-betajudge-multi-pass-scoring P01 | 3min | 2 tasks | 5 files |
| Phase 08-worktree-file-copy P01 | 4min | 2 tasks | 3 files |
| Phase 09-cli-utility-unit-tests P01 | 3min | 2 tasks | 3 files |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-jxl | write the VS Code Extension docs page + any other missing docs | 2026-03-30 | 5603cbf | [260330-jxl-write-the-vs-code-extension-docs-page-an](./quick/260330-jxl-write-the-vs-code-extension-docs-page-an/) |
| 260331-ti8 | Expand RunEvent union, split executeUnit helpers, add ProviderToolCall index, judge static-dynamic boundary | 2026-03-31 | 5182066 | [260331-ti8-expand-runevent-union-split-executeunit-](./quick/260331-ti8-expand-runevent-union-split-executeunit-/) |
