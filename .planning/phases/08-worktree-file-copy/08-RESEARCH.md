# Phase 8: Worktree File Copy - Research

**Researched:** 2026-04-01
**Domain:** Node.js filesystem I/O, git worktrees, path security
**Confidence:** HIGH

## Summary

Phase 8 closes the `--isolate` gap: after `createWorktree()` returns a detached-HEAD worktree, any files referenced in the config (schemaFile, argsSchema) that live outside git tracking are absent from the worktree. The fix is a new `copyFilesToWorktree()` function in `worktree.ts` that reads the raw YAML config, extracts file path fields, guards against path traversal, copies missing files into the worktree at their relative positions, and warns (non-fatally) for files that don't exist.

The implementation is entirely in the CLI layer. Core has zero I/O — no changes to `@kindlm/core` are needed. All complexity is path resolution ordering (must resolve against original `cwd()` BEFORE `chdir()`), the path-escape guard (`lstat` + `realpath` + repo-root boundary check), and the fail-open contract for missing optional files.

The CONTEXT.md decisions are fully specified. Research validates that Node.js `fs/promises` APIs (`copyFile`, `mkdir`) and the `yaml` package (already a dependency) cover all requirements without new dependencies.

**Primary recommendation:** Add `copyFilesToWorktree(worktreePath, repoRoot, filePaths)` to `worktree.ts`; call it in `test.ts` between `createWorktree()` and `process.chdir()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Copy both `schemaFile` and `argsSchema` path fields from all tests in the config
- Also copy the kindlm.yaml config file itself unconditionally
- Copy to same relative path from repo root (preserves directory structure)
- Copy all referenced files, not just gitignored ones
- New exported function `copyFilesToWorktree(worktreePath, filePaths)` in `packages/cli/src/utils/worktree.ts`
- Called in `packages/cli/src/commands/test.ts` after `createWorktree()` returns but BEFORE `process.chdir(wt.path)`
- Resolve all source paths against original `process.cwd()` BEFORE `chdir()`
- Extract file paths from the YAML-parsed config using `yaml.parse()` directly
- Missing referenced file: `console.warn()` + skip (fail-open)
- Path escape resolving outside repo root: throw `WorktreeError` before any files are copied
- Empty file list: no-op, no warning
- Config file copy failure: warn + continue

### Claude's Discretion
- Exact function signature for `copyFilesToWorktree()`
- Whether to reuse `WorktreeError` or introduce a new error type (reuse preferred)
- How to extract file paths from raw YAML (use `yaml.parse()` from the already-imported `yaml` dep)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ISOLATE-01 | `--isolate` copies gitignored referenced files (schemaFile, argsSchema paths) into the worktree before running; git-tracked files are already present; missing files are non-fatal | Covered by `copyFilesToWorktree()` + path-escape guard + fail-open warn pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | Node 20 built-in | `copyFile`, `mkdir` for file copy | Zero-dep, already used across CLI utils |
| `node:path` | Node 20 built-in | `resolve`, `relative`, `dirname` | Already imported in `worktree.ts` |
| `yaml` | Already installed | Parse raw YAML to extract file path fields | Already a monorepo dependency, used in `run-tests.ts` and core |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chalk` | Already installed | `chalk.yellow()` for warn messages | Consistent with existing `console.warn(chalk.yellow(...))` pattern in `test.ts:145` |

**Installation:** No new packages required. All dependencies are present.

## Architecture Patterns

### Recommended Project Structure
No new files needed. One function added to an existing utility file:
```
packages/cli/src/utils/
├── worktree.ts          # Add copyFilesToWorktree() here
└── worktree.test.ts     # Add tests for copyFilesToWorktree()
```

Integration call site:
```
packages/cli/src/commands/
└── test.ts              # Call copyFilesToWorktree() at lines ~137-141
```

### Pattern 1: Path Resolution Before chdir()
**What:** Capture original `cwd()` before any `process.chdir()` call. All source paths must be resolved against this snapshot.
**When to use:** Any time worktree isolation + external file references coexist.
**Why critical:** `run-tests.ts:80` does `resolve(process.cwd(), options.configPath)` — after `chdir(wt.path)`, `process.cwd()` is the worktree path, not the repo root. Config + file paths resolved after chdir resolve to wrong locations.

```typescript
// In test.ts executeTestRun(), BEFORE chdir:
const originalCwd = process.cwd();
const absConfigPath = path.resolve(originalCwd, options.config);
const wt = await createWorktree(slug);
await copyFilesToWorktree(wt.path, originalCwd, filePaths); // uses originalCwd
process.chdir(wt.path);
```

### Pattern 2: Path Escape Guard
**What:** After resolving an absolute file path with `realpath` (or `lstat` + normalize), check that it starts with `repoRoot + path.sep`. Reject if it escapes.
**When to use:** Any user-controlled path that will be used for file I/O.
**Example:**
```typescript
// Source: Node.js path module + existing validateWorktreeSlug() pattern
import { lstat } from "node:fs/promises";
import path from "node:path";

async function isWithinRoot(absPath: string, repoRoot: string): Promise<boolean> {
  const normalRoot = path.resolve(repoRoot) + path.sep;
  const normalPath = path.resolve(absPath) + path.sep;
  return normalPath.startsWith(normalRoot);
}
```
Note: Use `path.resolve()` (normalizes `..` segments) rather than `realpath()` to avoid failures when the file doesn't exist yet. For the path-escape guard the file need not exist — we're checking the resolved path, not the physical filesystem.

### Pattern 3: Fail-Open File Copy
**What:** For each file in the list, attempt copy; on `ENOENT`, emit `console.warn(chalk.yellow(...))` and continue. Only throw for the path-escape case.
**When to use:** Optional referenced files (schemaFile, argsSchema) where absence may be intentional.

```typescript
for (const srcPath of filePaths) {
  const rel = path.relative(repoRoot, srcPath);
  const destPath = path.join(worktreePath, rel);
  try {
    await mkdir(path.dirname(destPath), { recursive: true });
    await copyFile(srcPath, destPath);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(chalk.yellow(`Warning: referenced file not found, skipping: ${srcPath}`));
    } else {
      throw e;
    }
  }
}
```

### Pattern 4: Raw YAML Path Extraction
**What:** Use `yaml.parse()` on the raw config string to extract file path fields without running full Zod validation (which requires file resolution that may fail pre-copy).
**When to use:** Before `parseConfig()` runs, to collect files to copy.

```typescript
import { parse as yamlParse } from "yaml";

function extractFilePaths(yamlContent: string): string[] {
  const raw = yamlParse(yamlContent) as Record<string, unknown>;
  const paths: string[] = [];
  const tests = (raw["tests"] as unknown[]) ?? [];
  for (const test of tests) {
    const expect = (test as Record<string, unknown>)["expect"] as Record<string, unknown> | undefined;
    if (!expect) continue;
    const toolCalls = (expect["toolCalls"] as unknown[]) ?? [];
    for (const tc of toolCalls) {
      const argsSchema = (tc as Record<string, unknown>)["argsSchema"];
      if (typeof argsSchema === "string") paths.push(argsSchema);
    }
    const outputFormat = expect["output"] as Record<string, unknown> | undefined;
    if (outputFormat && typeof outputFormat["schemaFile"] === "string") {
      paths.push(outputFormat["schemaFile"] as string);
    }
  }
  return paths;
}
```

### Anti-Patterns to Avoid
- **Resolving paths after chdir:** Never call `path.resolve(process.cwd(), ...)` after `process.chdir(wt.path)` for source file lookups — `cwd()` is now the worktree.
- **Using realpath for escape guard:** `realpath()` throws `ENOENT` for non-existent files. Use `path.resolve()` + string prefix check instead.
- **Copying tracked files differently:** The decision is to copy all referenced files regardless of git tracking status. Do not add a `git ls-files` check.
- **Adding a new error class:** Reuse `WorktreeError` for path-escape errors — consistent with existing `validateWorktreeSlug()` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path normalization | Custom `..` segment removal | `path.resolve()` | Handles OS separators, multiple `..`, symlinks correctly |
| Recursive mkdir | Manual directory creation loop | `fs.mkdir(path, { recursive: true })` | Built-in, handles race conditions and existing dirs |
| YAML field traversal | Full re-implementation of config schema | `yaml.parse()` + duck-typed traversal | Only need raw path strings, not validated config |

**Key insight:** All needed primitives exist in Node.js stdlib or already-installed packages. New code volume is small (~60 lines for the function + ~40 for tests).

## Common Pitfalls

### Pitfall 1: chdir Race with Path Resolution
**What goes wrong:** File paths extracted from config are relative (e.g., `schemas/tool.json`). After `chdir(wt.path)`, `path.resolve(relPath)` resolves against the worktree, not the original project root. The source file doesn't exist there.
**Why it happens:** `process.chdir()` mutates global state. Any `resolve()` call after it uses the new cwd.
**How to avoid:** Snapshot `const originalCwd = process.cwd()` before `createWorktree()`. Pass it to `copyFilesToWorktree()`. Resolve all source paths with `path.resolve(originalCwd, relPath)`.
**Warning signs:** `ENOENT` on source file copy despite the file existing in the project.

### Pitfall 2: Path Escape via Normalized Traversal
**What goes wrong:** A path like `schemas/../../etc/passwd` or an absolute path like `/tmp/secret.json` passes a naive `includes("..")` check but escapes the repo root.
**Why it happens:** Simple string checks miss normalized paths. `../sibling` resolves to a sibling directory still inside the parent, which may or may not be the repo.
**How to avoid:** Always `path.resolve()` the path first, then check `resolvedPath.startsWith(repoRoot + path.sep)`. Throw `WorktreeError` before copying any files.
**Warning signs:** Test passes with `../` path but the file lands outside `.kindlm/worktrees/`.

### Pitfall 3: copyFile Fails on Missing Parent Directory
**What goes wrong:** `fs.copyFile(src, dest)` throws `ENOENT` if the destination directory doesn't exist — even though the source file exists.
**Why it happens:** `copyFile` does not create parent directories.
**How to avoid:** Always call `mkdir(path.dirname(dest), { recursive: true })` before `copyFile`.

### Pitfall 4: YAML Parse of Invalid Config
**What goes wrong:** Raw `yaml.parse()` throws for malformed YAML. This happens before `parseConfig()` runs its user-friendly error formatting.
**Why it happens:** Path extraction runs on the raw string before validation.
**How to avoid:** Wrap `yaml.parse()` in a try/catch. On parse failure, return empty array (path extraction is best-effort; `parseConfig()` will surface the error properly later).

### Pitfall 5: Test File Mocking for fs/promises
**What goes wrong:** `vi.mock("node:fs/promises")` mocks at the module level, but imports must be set up before each test.
**Why it happens:** ESM hoisting — `vi.mock()` runs before imports.
**How to avoid:** Use `vi.mocked(copyFile)` pattern after `vi.mock("node:fs/promises", ...)` at top of test file. See `worktree.test.ts` for the `vi.mock("node:child_process")` pattern — follow the same structure.

## Code Examples

### Function Signature (recommended)
```typescript
// Source: CONTEXT.md decision + pattern from worktree.ts
/**
 * Copies files referenced in a kindlm config into a git worktree.
 * Source paths must be absolute, resolved against the original cwd BEFORE chdir.
 * Files outside repoRoot are rejected. Missing files are skipped with a warning.
 */
export async function copyFilesToWorktree(
  worktreePath: string,
  repoRoot: string,
  filePaths: string[],
): Promise<void>
```

### Integration Call Site in test.ts
```typescript
// After createWorktree(), BEFORE process.chdir()
const wt = await createWorktree(slug);
worktreeCleanup = wt.cleanup;
originalCwd = process.cwd();

// Extract + copy referenced files while cwd is still the project root
const yamlContent = readFileSync(absConfigPath, "utf-8");
const referencedPaths = extractConfigFilePaths(yamlContent, originalCwd);
referencedPaths.push(absConfigPath); // always copy config itself
await copyFilesToWorktree(wt.path, originalCwd, referencedPaths);

process.chdir(wt.path);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No file copy (Phase 5) | Copy referenced files before chdir (Phase 8) | Phase 8 | schemaFile/argsSchema assertions now work in --isolate mode |

**Deprecated/outdated:** None for this phase.

## Open Questions

1. **`schemaFile` field location in YAML**
   - What we know: `expect.output.schemaFile` is one path. `expect.toolCalls[].argsSchema` is another.
   - What's unclear: Are there any other file path fields in the config schema not covered by these two?
   - Recommendation: Scan `packages/core/src/config/schema.ts` for `.refine()` or `.transform()` calls that reference file paths before implementing `extractConfigFilePaths()`. The CONTEXT.md specifies only these two — treat as exhaustive for now.

2. **Config file location in worktree**
   - What we know: `run-tests.ts:80` does `resolve(process.cwd(), options.configPath)` after chdir. `options.configPath` defaults to `"kindlm.yaml"`.
   - What's unclear: If the user passes `--config subdir/kindlm.yaml`, the copy must preserve the relative subdirectory structure.
   - Recommendation: Use `path.relative(originalCwd, absConfigPath)` as the relative path for destination, same as for other files. This handles subdirectory configs correctly.

## Environment Availability

Step 2.6: SKIPPED — this phase adds code to an existing Node.js CLI. No new external dependencies, services, or CLI tools are required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test --workspace=packages/cli -- --run --reporter=verbose worktree` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISOLATE-01 | `copyFilesToWorktree` copies files to worktree at same relative path | unit | `npm run test --workspace=packages/cli -- --run worktree` | ❌ Wave 0 (new tests in existing file) |
| ISOLATE-01 | Path escape guard rejects paths outside repo root | unit | same | ❌ Wave 0 |
| ISOLATE-01 | Missing file emits warn and does not throw | unit | same | ❌ Wave 0 |
| ISOLATE-01 | Empty file list is a no-op | unit | same | ❌ Wave 0 |
| ISOLATE-01 | `extractConfigFilePaths` extracts schemaFile and argsSchema paths | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=packages/cli -- --run worktree`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New `describe("copyFilesToWorktree", ...)` block in `packages/cli/src/utils/worktree.test.ts` — covers all ISOLATE-01 behaviors
- [ ] `vi.mock("node:fs/promises")` setup at top of `worktree.test.ts` for `copyFile` and `mkdir`
- [ ] New `describe("extractConfigFilePaths", ...)` block in `worktree.test.ts` — covers path extraction from raw YAML

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase |
|-----------|----------------|
| Zero I/O in `@kindlm/core` | All file copy logic stays in `packages/cli/src/utils/worktree.ts` |
| No classes except error types | `copyFilesToWorktree` is an exported async function, not a class method |
| Factory functions pattern | Extract `extractConfigFilePaths()` as a separate exported pure function |
| `.js` extensions in all relative imports | `import ... from "./worktree.js"` in test.ts already correct |
| `verbatimModuleSyntax: true` | Use `import type` for any type-only imports |
| `import path from "node:path"` | Already in `worktree.ts` — follow existing pattern |
| `console.warn(chalk.yellow(...))` | Established pattern for non-fatal warnings — use for missing files |
| Result types over exceptions | `copyFilesToWorktree` returns `Promise<void>` — throws only for path escape (intentional, per CONTEXT.md) |
| Run `tsc --noEmit` before marking complete | Required verification step |
| Run `eslint . --quiet` before marking complete | Required verification step |

## Sources

### Primary (HIGH confidence)
- Direct code read of `packages/cli/src/utils/worktree.ts` — existing patterns, WorktreeError, validateWorktreeSlug
- Direct code read of `packages/cli/src/commands/test.ts` — integration point, exact line numbers, chdir location
- Direct code read of `packages/cli/src/utils/worktree.test.ts` — vi.mock pattern for child_process
- `.planning/phases/08-worktree-file-copy/08-CONTEXT.md` — locked implementation decisions
- `.planning/REQUIREMENTS.md` — ISOLATE-01 definition
- Node.js 20 documentation — `fs/promises.copyFile`, `fs/promises.mkdir` are stable APIs

### Secondary (MEDIUM confidence)
- `packages/cli/src/utils/run-tests.ts` line 80 — confirms chdir causes configPath resolution issue

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all APIs are Node 20 built-ins or existing deps
- Architecture: HIGH — locked in CONTEXT.md with specific file/line references, confirmed by direct code read
- Pitfalls: HIGH — derived from actual code paths (chdir mutation, copyFile mkdir requirement) not speculation

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable Node.js APIs, no fast-moving dependencies)
