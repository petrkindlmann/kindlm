# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0.0 — Launch Ops

**Shipped:** 2026-04-01
**Phases:** 5 | **Plans:** 7 | **Timeline:** ~44 days (2026-02-16 → 2026-04-01)

### What Was Built

- v2.0.0 on npm — Cloud Worker deployed to api.kindlm.com, 13 D1 migrations applied, Sentry/VS Code/Stripe wired
- Append-only run artifact directories (`.kindlm/runs/{runId}/{executionId}/`) with deterministic run IDs and immutable versioned baselines
- CLI feature flag system (`features.ts`, `isEnabled()`) with safe defaults for absent/malformed config
- MCP provider adapter — passthrough HTTP POST letting kindlm test against any MCP server endpoint
- `--isolate` flag for git worktree-based test isolation with fail-closed cleanup and graceful degradation

### What Worked

- TDD discipline (red → green → commit) kept each plan's scope tight and rollback-safe
- Phase planning with explicit REQUIREMENTS IDs made audit fast and unambiguous
- Detaching worktrees via `--detach` flag — avoids branch conflicts for concurrent runs without complex naming logic
- Factory function pattern for MCP adapter slotted into existing provider registry with zero provider-consumer changes

### What Was Inefficient

- Two integration gaps made it to audit: `runArtifacts` flag stub wired but never exercised; worktree path created but never used as cwd. Both could have been caught with an explicit end-to-end smoke test per phase.
- SUMMARY.md one-liner field not populated in phases 02-05, causing bad accomplishment extraction in milestone complete. Field needs to be populated consistently during plan execution.
- OPS-08 (Stripe live-mode) was always going to be blocked on user credentials — could have been split into a separate "credential handoff" checklist rather than a tracked requirement that only partially passes.

### Patterns Established

- `env: header resolution in CLI layer only` — core must stay zero-I/O; any env var expansion happens in CLI wrappers
- Pointer-file-only baseline design: `-latest.json` contains only `{ latestFile: "..." }`, never a content copy
- `execFile` manual Promise wrapper (not `util.promisify`) when the function needs to survive `vi.mock()` — `promisify.custom` is silently lost on mock

### Key Lessons

1. **Add a post-phase smoke test step** to the execution workflow — run the new flag/feature end-to-end once before writing the SUMMARY to catch integration gaps that unit tests miss.
2. **Split credential-blocked requirements** into a separate "manual handoff" list, not tracked in REQUIREMENTS.md as binary pass/fail.
3. **Populate SUMMARY.md `one_liner` field** immediately at plan completion — downstream tools (milestone complete, session reports) depend on it.

### Cost Observations

- Sessions: ~10 (estimate)
- Notable: Phases 3-5 were very fast (2-6min each) — clear specs + established patterns = minimal overhead

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v2.0.0 | 5 | 7 | First milestone using GSD workflow end-to-end |

### Top Lessons (Verified Across Milestones)

1. Short, well-scoped phases (1 plan each) execute faster than large multi-plan phases.
2. Audit before completion catches integration gaps that individual phase verifications miss.
