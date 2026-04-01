# Technology Stack

**Project:** KindLM v2.1.0 Gap Closure
**Researched:** 2026-04-01

---

## Verdict: No new npm packages needed

All five features can be implemented with Node.js built-ins and the packages already
declared in `packages/cli/package.json`. The existing stack is sufficient.

---

## Feature-by-Feature Stack Analysis

### 1. Multi-Pass Judge Scoring (`betaJudge`)

**What's needed:** Run `createJudgeAssertion` N times, collect scores, compute median.

**Stack decision:** Implement median in pure TypeScript inside `@kindlm/core`. No library needed.

Median of an odd-length sorted array is `arr[Math.floor(n/2)]`. For even-length, average
the two middle values. The implementation is 4 lines. No statistical library (`lodash`,
`simple-statistics`, `d3-array`) is justified for a single function.

```typescript
// Sufficient — no package needed
function median(scores: number[]): number {
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}
```

Place this in `packages/core/src/assertions/shared-score.ts` alongside
`validateUnitIntervalScore`.

**Architecture note:** The N-pass loop belongs in `judge.ts` itself — the assertion runs N
completions sequentially (respecting core's zero-I/O contract), aggregates scores, then
returns a single `AssertionResult` with `score = median`. The `passes` count is exposed in
`metadata` for traceability. The `betaJudge` flag gating happens in the CLI layer when
constructing `AssertionContext`, not inside core.

**New imports:** None.

---

### 2. Pre-Emptive Cost Budget Enforcement (`costGating`)

**What's needed:** Abort the test run mid-flight if cumulative `costUsd` across completed
tests exceeds a configured threshold.

**Stack decision:** Node.js shared mutable state — a simple counter object passed by
reference into the engine. No new package.

The existing `runner.ts` already aggregates per-test cost via `ProviderResponse.usage` and
`estimateCost()`. The extension is:

1. Add a `CostBudget` object: `{ spentUsd: number; limitUsd: number }` to `RunTestsOptions`
   (optional, undefined = no cap).
2. After each test resolves, increment `spentUsd`. If `spentUsd > limitUsd`, cancel
   remaining pending promises via an `AbortController` or by setting a `cancelled` flag
   checked at the start of each test slot.

**Recommended pattern:** A shared `{ cancelled: boolean }` ref is simpler than
`AbortController` here because `cancelled` is checked at the coroutine boundary (before
spawning the next provider call), not mid-HTTP-stream. This avoids needing `AbortSignal`
threading through provider adapters.

**New imports:** None. `node:events` or `AbortController` are available but unnecessary for
this scope.

---

### 3. Worktree Filesystem Isolation (`--isolate` completeness, ISOLATE-01)

**What's needed:** Copy `kindlm.yaml` and any files it references (i.e., `schemaFile` and
`argsSchema` paths from the parsed config) into the worktree directory before tests run.

**Stack decision:** `node:fs/promises` — already available in the CLI layer. No new package.

The two Node.js built-ins needed are `fs.promises.copyFile` and `fs.promises.mkdir`.

**Implementation pattern:**

```typescript
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

export async function copyConfigIntoWorktree(
  configPath: string,        // absolute path to kindlm.yaml
  referencedFiles: string[], // schemaFile and argsSchema paths (already resolved by parser)
  worktreePath: string,
): Promise<void> {
  const configDir = path.dirname(configPath);
  const destConfigDir = path.join(worktreePath, path.relative(process.cwd(), configDir));

  await mkdir(destConfigDir, { recursive: true });
  await copyFile(configPath, path.join(destConfigDir, path.basename(configPath)));

  for (const file of referencedFiles) {
    const rel = path.relative(configDir, file);
    const dest = path.join(destConfigDir, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(file, dest);
  }
}
```

The config parser (`packages/core/src/config/parser.ts`) already resolves `schemaFile` and
`argsSchema` to absolute paths before Zod validation. Extract those resolved paths from the
parsed config by walking `config.tests[*].expect.output.schemaFile` and
`config.tests[*].expect.toolCalls[*].argsSchema`. This is a CLI-layer concern — add a
helper `extractReferencedFiles(config: KindlmConfig): string[]` in
`packages/cli/src/utils/worktree.ts` alongside the existing worktree functions.

**New imports:** `node:fs/promises`, `node:path` — both already used elsewhere in the CLI.

---

### 4. Unit Testing Patterns for CLI Utilities

#### `spinner.ts`

`ora` is testable with `vi.mock("ora")`. The `createSpinner()` factory wraps `ora` and
exposes a `Spinner` interface (`start`, `succeed`, `fail`, `stop`). Tests mock the `ora`
module and verify calls to those methods.

```typescript
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));
```

Vitest resolves `vi.mock("ora")` correctly for ESM because `ora` v8 ships as pure ESM and
Vitest's ESM mock hoisting handles it. The `createSpinner()` interface abstraction means
tests only need to assert that the returned `Spinner` object delegates to the `Ora` instance
correctly.

**Confidence:** HIGH — `vi.mock()` for ESM third-party packages is standard Vitest pattern
(Vitest docs, v2+).

#### `select-reporter.ts`

The `process.exit(1)` call on unknown reporter type makes testing the default branch
awkward. Two options:

- **Preferred:** Mock `process.exit` via `vi.spyOn(process, "exit").mockImplementation(...)`.
  This avoids the test process dying and lets you assert on the call.
- The three valid branches (`json`, `junit`, `pretty`) are straightforward — mock
  `@kindlm/core` reporter factories with `vi.mock("@kindlm/core")` and assert the right
  factory is called.

No new packages. `vi.spyOn` is built into Vitest.

#### `dry-run.ts`

`formatTestPlan(plan: TestPlan)` is a pure function — no I/O, no side effects. Tests pass a
`TestPlan` fixture and assert on the returned string. `chalk` applies ANSI codes; tests
either:

1. Strip ANSI via a regex (`/\x1B\[[0-9;]*m/g`) before asserting on text content, or
2. Set `FORCE_COLOR=0` in the test environment (`process.env.FORCE_COLOR = "0"`) to
   disable chalk output.

**Recommended:** `FORCE_COLOR=0` approach — simpler, no regex stripping utility needed.
Add to `vitest.config.ts` for the cli package: `env: { FORCE_COLOR: "0" }`. This is a
Vitest built-in env option, no package needed.

---

### 5. CLI Flag Overrides (`--concurrency` and `--timeout`)

**What's needed:** `kindlm test --concurrency <n>` and `kindlm test --timeout <ms>` override
the values in `kindlm.yaml`.

**Stack decision:** `commander` (already declared) — `.option("--concurrency <n>", ...,
parseInt)` and `.option("--timeout <ms>", ..., parseInt)`. Parse to `number | undefined`,
pass into `RunTestsOptions`. The engine already reads `concurrency` and `timeoutMs` from
config; the CLI layer simply overrides them if the flags are present.

**Validation:** Reject `<= 0` values immediately in the command handler (before test
execution) with a clear error message. No new library needed — `parseInt` plus a range
check.

**New imports:** None.

---

## Summary: No New Dependencies

| Feature | Implementation | New Packages |
|---------|---------------|-------------|
| Multi-pass judge | Inline `median()` in `shared-score.ts` | None |
| Cost budget | Shared `{ cancelled }` ref in runner | None |
| Worktree file copy | `node:fs/promises` copyFile + mkdir | None |
| Spinner tests | `vi.mock("ora")` | None |
| Reporter tests | `vi.mock("@kindlm/core")` + `vi.spyOn(process, "exit")` | None |
| Dry-run tests | `FORCE_COLOR=0` + pure function fixture | None |
| CLI flag overrides | `commander` `.option()` already in deps | None |

---

## Existing Stack (unchanged)

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.7.0 | Language (strict, ESM-first) |
| Vitest | 3.2.4 | Test framework |
| commander | ^13.0.0 | CLI argument parsing |
| ora | ^8.1.0 | Terminal spinner |
| chalk | ^5.4.0 | Terminal color |
| `node:fs/promises` | built-in | File copy for ISOLATE-01 |
| `node:child_process` | built-in | Worktree git commands (existing) |
| `node:path` | built-in | Path manipulation (existing) |

---

## Sources

- Vitest ESM mocking docs (vi.mock hoisting): https://vitest.dev/guide/mocking.html
- ora v8 ESM package: https://github.com/sindresorhus/ora (pure ESM, vi.mock compatible)
- Node.js `fs/promises` API: https://nodejs.org/api/fs.html#promises-api
- Confidence: HIGH for all items — patterns verified against existing codebase conventions
  and official documentation. No claims rely on training data alone.
