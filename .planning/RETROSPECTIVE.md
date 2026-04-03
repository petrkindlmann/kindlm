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

## Milestone: v2.3.0 — Developer Experience & Depth

**Shipped:** 2026-04-03
**Phases:** 6 | **Plans:** 12 | **Timeline:** ~1 day (2026-04-02 → 2026-04-03)

### What Was Built

- Rich tool call failure output — numbered call sequences, arg diffs, truncation in pretty reporter
- SHA-256-keyed response caching with TTL, `--no-cache`, `[cached]` indicator, `kindlm cache clear`
- Watch mode (`--watch`) with chokidar 4.x, abort/queue, cumulative cost tracking, SIGINT cleanup
- Multi-turn agent testing — YAML conversation turns with per-turn assertions and mock tool responses
- GitHub Action `kindlm/test@v2` — PR comments, JUnit XML artifacts, optional cloud upload
- Dashboard team features — run history filtering, recharts trend charts, run-to-run comparison, test detail drill-down

### What Worked

- Auto-advance (`--auto`) pipeline ran discuss → plan → execute for Phase 18 in a single session with no manual intervention
- Wave-based execution with worktree isolation prevented file conflicts between parallel plans
- Existing dashboard patterns (SWR, Tailwind stone palette, RunTable/ResultGrid) made Phase 18 mostly additive — no refactoring needed
- Phase 13-17 each completed in ~1 session with clean verification passes

### What Was Inefficient

- Phase 18 verification returned `human_needed` for 4 browser tests — these are still pending and will accumulate as tech debt if not addressed
- No milestone audit was run before completion — skipped in favor of speed since all phases had individual verification
- SUMMARY.md one-liner extraction still produces noisy output (raw task descriptions instead of clean one-liners) — the v2.0.0 lesson wasn't fully addressed

### Patterns Established

- `Colorize` interface chains (`c.dim(c.cyan())`) for all new reporter output — zero direct chalk in core
- `deepSortKeys` before SHA-256 for cache key determinism
- `dynamic(() => import(), { ssr: false })` mandatory for all charting components in dashboard
- Conversation runner as pure state machine with I/O injected via interfaces

### Key Lessons

1. **Auto-advance is production-ready** for well-specified phases — Phase 18 ran discuss → plan → execute → verify without intervention
2. **Dashboard phases need browser testing gates** — automated verification can confirm code structure but not visual correctness
3. **Run milestone audit before completion** — even if individual phases pass, cross-phase integration issues can hide

### Cost Observations

- 6 phases completed in ~1 day across multiple sessions
- Phase 18 (largest: 3 plans, 2 waves) executed in ~45 minutes wall time
- Notable: Research + planning + execution + verification for Phase 18 all ran in a single context window with auto-advance

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v2.0.0 | 5 | 7 | First milestone using GSD workflow end-to-end |
| v2.1.0 | 4 | 4 | Gap closure — small focused phases |
| v2.2.0 | 3 | 6 | Core quality — reporter, dry-run, validation |
| v2.3.0 | 6 | 12 | Largest milestone — auto-advance pipeline mature |

### Top Lessons (Verified Across Milestones)

1. Short, well-scoped phases (1 plan each) execute faster than large multi-plan phases.
2. Audit before completion catches integration gaps that individual phase verifications miss.
3. Auto-advance pipeline (`--auto`) is reliable for well-specified phases with clear requirements.
4. SUMMARY.md one-liner field needs consistent population — downstream tools depend on it (identified v2.0.0, still an issue v2.3.0).
