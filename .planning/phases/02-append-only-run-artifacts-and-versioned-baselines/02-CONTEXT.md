# Phase 2: Append-only run artifacts and versioned baselines - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement append-only run artifact persistence and immutable baseline versioning for KindLM CLI. Every `kindlm test` invocation writes structured artifact files to `.kindlm/runs/{runId}/{executionId}/`. Baseline history is preserved immutably via timestamped files + `-latest.json` pointer. No baseline file is ever silently overwritten.

</domain>

<decisions>
## Implementation Decisions

### Artifact Storage Structure
- Directory layout: `.kindlm/runs/{runId}/{executionId}/` — runId groups retries, executionId is UUID per attempt
- 5 files per execution: `results.json`, `results.jsonl`, `summary.json`, `metadata.json`, `config.json`
- RunId computed as deterministic hash of config+suite+git commit (retry-safe — same test always maps to same runId folder group)
- Artifact write failure: warn to console, never change test exit code — verdict is unaffected by storage errors

### Baseline Versioning
- Versioning scheme: timestamped files + `-latest.json` pointer — `{suite}-{timestamp}.json` + `{suite}-latest.json`
- Never overwrite any baseline file — both old and new are always kept (immutable history)
- Latest pointer is a JSON file referencing the latest timestamped filename (no symlinks — Workers/cross-platform compatible)
- `kindlm baseline list` shows all versions with timestamps, newest first

### CLI Integration
- Artifacts written after `runTests()` completes, before `saveLastRun()` — results fully aggregated before write
- `LastRunData` extended with optional `runId` and `artifactDir` fields — backward compatible
- Artifact and baseline IO errors are fully isolated — never affect `process.exit()` code
- No `--no-artifacts` flag in v1 — artifacts always written (minimizes config surface)

### Claude's Discretion
- Exact JSONL line format for `results.jsonl` (one assertion result per line vs one test result per line)
- Internal `computeRunId()` hash algorithm specifics (SHA-256 inputs ordering)
- `metadata.json` schema (what fields beyond timestamp/git/suite/config-hash)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `last-run.ts`: `saveLastRun()` / `loadLastRun()` with `mkdirSync({ recursive: true })` pattern — reuse for artifact dir creation
- `store.ts`: `BaselineIO` interface with `read/write/list` — extend `write` to support versioned filenames
- `test.ts`: `saveLastRun(data)` call after `runTests()` — primary wiring point for `writeRunArtifacts()`
- `createHash` from `node:crypto` already imported in `last-run.ts` — reuse for `computeRunId()`

### Established Patterns
- Result type pattern: `{ success: true; data: T } | { success: false; error: E }` — use for artifact writer return
- File I/O wrapped in try/catch with `console.warn()` fallback (not `err()`) for non-fatal operations
- `.kindlm/` directory uses `mode: 0o700`, files use `mode: 0o600` for credential-equivalent privacy

### Integration Points
- `packages/cli/src/utils/artifacts.ts` (new file) — called from `packages/cli/src/commands/test.ts`
- `packages/cli/src/utils/last-run.ts` — extend `LastRunData` interface + `saveLastRun()` params
- `packages/core/src/baseline/store.ts` — extend `BaselineIO.write()` to accept version metadata

</code_context>

<specifics>
## Specific Ideas

- RunId determinism is critical for CI — same git commit + same config should always yield the same runId so retries don't create orphaned folders
- The `-latest.json` pointer should contain the filename of the latest baseline (not a copy of the content) to avoid double storage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
