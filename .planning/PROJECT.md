# KindLM

## What This Is

KindLM is a shipped open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** — tool calls, decisions, structured output — not just what they say. The Cloud tier (v2.0.0 live at api.kindlm.com) adds team dashboards, test history, compliance PDF export, and billing.

## Core Value

Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## Current Milestone: Planning next milestone

v2.1.0 Gap Closure shipped 2026-04-02. See `.planning/milestones/v2.1.0-ROADMAP.md` for details.

## Requirements

### Validated

- ✓ OPS-01: Fix duplicate migration 0011, renumber — v2.0.0
- ✓ OPS-02: Push 28 commits to remote — v2.0.0
- ✓ OPS-03: Run D1 migrations on production (13 migrations applied) — v2.0.0
- ✓ OPS-04: Deploy Cloud Worker to api.kindlm.com — v2.0.0
- ✓ OPS-05: Merge Version Packages PR (v2.0.0 published to npm) — v2.0.0
- ✓ OPS-06: Set SENTRY_DSN Worker secret — v2.0.0
- ✓ OPS-07: Publish VS Code extension — v2.0.0
- ✓ OPS-08: Create Stripe products (test mode; live mode pending sk_live_) — v2.0.0 (partial)
- ✓ ARTIFACT-01: Append-only run artifacts in `.kindlm/runs/{runId}/{executionId}/` — v2.0.0 (flag wiring gap, see Tech Debt)
- ✓ ARTIFACT-02: `last-run.json` includes `runId` + `artifactDir` fields — v2.0.0
- ✓ BASELINE-01: Versioned baselines with nonce-unique filenames, never overwrites — v2.0.0
- ✓ FF-01/02/03: Feature flags via `.kindlm/config.json`, `isEnabled()` helper — v2.0.0
- ✓ MCP-01: MCP provider adapter — passthrough HTTP POST to any MCP server — v2.0.0
- ✓ WORKTREE-01/02/03: `--isolate` flag with git worktree isolation and fail-closed cleanup — v2.0.0
- ✓ COST-01: `costGating` flag gates `costMaxUsd` enforcement — v2.1.0
- ✓ CLI-01: `--concurrency` override for `kindlm test` — v2.1.0
- ✓ CLI-02: `--timeout` override for `kindlm test` — v2.1.0
- ✓ JUDGE-01: Multi-pass judge scoring gated behind `betaJudge` flag — v2.1.0
- ✓ ISOLATE-01: Copy config + referenced schema files into worktree before `--isolate` run — v2.1.0
- ✓ TEST-01/02/03: Unit tests for `dry-run.ts`, `select-reporter.ts`, `spinner.ts` — v2.1.0

### Active

(None — awaiting next milestone planning)

### Out of Scope

- Stripe live-mode products — blocked on sk_live_ key with product create permissions (user action)
- CF_API_TOKEN GitHub Actions secret — non-blocking, deferred
- Worktree cwd switching — `--isolate` creates worktree but tests still run in original dir (may be intentional scope for v2.0.0)

## Context

**Current state (as of v2.1.0, 2026-04-02):**
- CLI published: `@kindlm/cli` v2.0.0 on npm (v2.1.0 pending publish)
- Cloud Worker live at api.kindlm.com (Cloudflare Workers + D1)
- 13 D1 migrations applied to kindlm-prod
- Sentry error monitoring active
- VS Code extension published
- Stripe billing in test mode
- `betaJudge` and `costGating` feature flags fully wired
- `--isolate` now copies config + schema files into worktree (ISOLATE-01 closed)
- All CLI utilities have unit test coverage (242 passing tests in CLI package)

**Known tech debt:**
- `runArtifacts` feature flag has no effect — `isEnabled()` stub in `run-tests.ts`, actual write in `test.ts` is unconditional
- Stripe live-mode products need sk_live_ key to create
- 48 pre-existing integration test failures in `packages/cli/tests/integration/` (unrelated to v2.1.0 work)

## Key Decisions

| Decision | Outcome | Phase |
|----------|---------|-------|
| Deploy order: D1 migrations before Worker | Safe schema-first rollout, no runtime errors | 01 |
| D1 migration tracker recovery via manual INSERT | Unblocked partial-apply state without re-running | 01 |
| Stripe test mode first | Validated billing flow; live mode deferred | 01 |
| computeRunId = SHA-256(suiteName:configHash:gitCommit) sliced 40 chars | Deterministic, retry-safe run IDs | 02 |
| Baseline pointer file contains only `latestFile` (no content copy) | Single source of truth, no duplication | 02 |
| Feature flags default to `false` when config absent/malformed | Safe — never throws, never enables experimental code unexpectedly | 03 |
| `featureFlags` optional on `RunTestsOptions` | Zero impact on existing callers | 03 |
| MCP env: header resolution in CLI layer, not core | Preserves zero-I/O constraint in `@kindlm/core` | 04 |
| `extractMcpText` order: `content[0].text` → `result` → `output` | Matches MCP spec priority | 04 |
| `execFile` manual Promise wrapper (not `promisify`) | Preserves `vi.mock()` compatibility — `promisify.custom` lost on mock | 05 |
| Detached HEAD worktrees (`--detach`) | No branch name conflicts for concurrent runs | 05 |
| Prefix unused cloud helpers with `_` (not delete) | ECDSA/XML SAML helpers are valid implementations worth retaining | 01 |
| `capturedCwd` local const before chdir in test.ts | Narrows `string\|undefined` to `string` at `copyFilesToWorktree` call site | 08 |
| ANSI strip helper in dry-run tests (no chalk mock) | `.toContain()` on stripped strings is simpler and more resilient than mocking chalk | 09 |
| `process.exit` spy throws `Error("process.exit")` | Stops test execution at call site, mirrors real behavior, prevents confusing post-exit state | 09 |
| `vi.mock("ora")` with shared `mockInstance` reset per test | Same reference inspectable across tests; `vi.clearAllMocks()` in `beforeEach` keeps state clean | 09 |

## Constraints

- **Infra:** Cloudflare ecosystem (Workers, D1, Pages) — committed, not changing
- **Auth:** GitHub OAuth only for v1 (SAML enterprise-only)
- **npm:** Published under `@kindlm` scope — semver compatibility required
- **Core:** Zero I/O — no `fs`, `fetch`, `console.log` in `@kindlm/core`
- **Cloud:** Workers-compatible only — no Node.js built-ins

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 after v2.1.0 milestone*
