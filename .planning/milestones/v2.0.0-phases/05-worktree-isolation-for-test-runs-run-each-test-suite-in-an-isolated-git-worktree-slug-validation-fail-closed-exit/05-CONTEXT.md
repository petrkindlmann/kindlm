# Phase 5: Worktree isolation for test runs - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add opt-in `--isolate` flag to `kindlm test` that creates a fresh git worktree per test suite, runs tests inside it, then removes it. Fail-closed cleanup (warn + leave worktree if dirty). Graceful degradation when git is unavailable. No behavior change when `--isolate` is absent.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Pre-written plan (05-01-PLAN.md) defines the exact implementation: `worktree.ts` utility + `--isolate` flag wired into `executeTestRun`.

</decisions>

<code_context>
## Existing Code Insights

### Established Patterns
- CLI utils follow factory function pattern, Node.js built-ins only
- `packages/cli/src/commands/test.ts` — entry point for `kindlm test`, contains `executeTestRun`
- `packages/cli/src/utils/run-tests.ts` — updated in phase 3/4 with featureFlags and MCP wiring

### Integration Points
- `packages/cli/src/utils/worktree.ts` (new) — slug validation, create/remove/inspect via child_process
- `packages/cli/src/commands/test.ts` — add `--isolate` option, call createWorktree/cleanup around runTests

</code_context>

<specifics>
## Specific Ideas

See 05-01-PLAN.md — full implementation spec already written including exact function signatures and behavior.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
