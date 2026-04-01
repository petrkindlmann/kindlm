# Phase 8: Worktree File Copy - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Copy config file (kindlm.yaml) and all file-path fields referenced in the config (schemaFile, argsSchema) into the git worktree before tests run when `--isolate` is used. This closes the gap where `process.chdir(wt.path)` breaks path resolution for untracked files that aren't in the worktree.

</domain>

<decisions>
## Implementation Decisions

### File Copy Scope
- Copy both `schemaFile` and `argsSchema` path fields from all tests in the config
- Also copy the kindlm.yaml config file itself unconditionally — `run-tests.ts:80` resolves `configPath = resolve(process.cwd(), options.configPath)` after `chdir(wt.path)`, so config must be in worktree
- Copy to same relative path from repo root (preserves directory structure so relative references in config still work)
- Copy all referenced files, not just gitignored ones — cheap check, avoids silent failures if tracking status changes

### Implementation Structure
- New exported function `copyFilesToWorktree(worktreePath, filePaths)` in `packages/cli/src/utils/worktree.ts`
- Called in `packages/cli/src/commands/test.ts` after `createWorktree()` returns but BEFORE `process.chdir(wt.path)`
- Resolve all source paths against original `process.cwd()` BEFORE `chdir()` — avoids chicken-and-egg problem
- Extract file paths from the YAML-parsed config (use `yaml.parse()` directly to read raw config before full parse)

### Error Handling
- Missing referenced file: `console.warn()` with path + skip the file (fail-open — per success criteria and ISOLATE-01)
- Path escape (`../` resolving outside repo root): throw `WorktreeError` before any files are copied — same guard pattern as `validateWorktreeSlug()`
- Empty file list (no schemaFile/argsSchema in config): no-op, no warning
- Config file copy failure: warn + continue (tests may still work if config is git-tracked)

### Claude's Discretion
- Exact function signature for `copyFilesToWorktree()`
- Whether to reuse the `WorktreeError` class for path escape errors or introduce a new error type (reuse preferred — consistent with existing pattern)
- How to extract file paths from raw YAML (use `yaml.parse()` from the already-imported `yaml` dep)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateWorktreeSlug()` in `worktree.ts` — pattern for path escape guard (throw `WorktreeError`)
- `WorktreeError` class in `worktree.ts` — use for path escape errors
- `createWorktree()` in `worktree.ts` — integration point, called in test.ts line 137
- `execFileAsync()` helper in `worktree.ts` — use `node:fs/promises` for file copy (`fs.copyFile`, `fs.mkdir`)
- `yaml` package already imported in `run-tests.ts` and `parser.ts`

### Established Patterns
- Zero I/O in `@kindlm/core` — all file copy logic goes in CLI layer (`packages/cli/`)
- Factory functions / exported pure functions — no classes except for errors
- `console.warn(chalk.yellow(...))` pattern for non-fatal warnings (see test.ts line 145)
- Path resolution: `import path from "node:path"` already in `worktree.ts`

### Integration Points
- `packages/cli/src/commands/test.ts` lines 131-148 — after `createWorktree()`, before `process.chdir(wt.path)`
- `packages/cli/src/utils/worktree.ts` — add `copyFilesToWorktree()` as new export
- Config path: `options.config` (CLI option, default "kindlm.yaml") resolved via `path.resolve(process.cwd(), options.config)`

</code_context>

<specifics>
## Specific Ideas

- ISOLATE-01 requirement: "copies gitignored referenced files (schemaFile, argsSchema paths) into the worktree before running; git-tracked files are already present; missing files are non-fatal"
- Success criteria path escape guard: "A `schemaFile` path containing `../` that resolves outside the repo root is rejected with an error before any files are copied"
- Success criteria missing file: "the copy is skipped with a warning and the test proceeds (fail-open for missing optional files)"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-worktree-file-copy*
*Context gathered: 2026-04-01 via smart discuss (autonomous mode)*
