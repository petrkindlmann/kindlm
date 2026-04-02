---
phase: 09-cli-utility-unit-tests
created: 2026-04-02
mode: auto
---

# Phase 09: CLI Utility Unit Tests — Context

## Domain

Add unit test coverage for three previously-untested CLI utilities: `dry-run.ts`, `select-reporter.ts`, and `spinner.ts`. All three have final implementations after Phases 7 and 8. This phase is pure test authorship — no production code changes.

## Canonical Refs

- `packages/cli/src/utils/dry-run.ts` — formatTestPlan implementation
- `packages/cli/src/utils/select-reporter.ts` — selectReporter implementation
- `packages/cli/src/utils/spinner.ts` — createSpinner implementation
- `packages/cli/src/utils/worktree.test.ts` — reference for vi.mock patterns (node:child_process, node:fs/promises)
- `packages/cli/src/utils/env.test.ts` — reference for clean describe/it/expect structure
- `.planning/REQUIREMENTS.md` — TEST-01, TEST-02, TEST-03 acceptance criteria

## Decisions

### Test file location
Colocated `.test.ts` files next to source — the established pattern across all 12 existing CLI test files.
- `packages/cli/src/utils/dry-run.test.ts`
- `packages/cli/src/utils/select-reporter.test.ts`
- `packages/cli/src/utils/spinner.test.ts`

### chalk output in dry-run tests
Do NOT mock chalk. `formatTestPlan` produces ANSI-colored strings. Tests should use `.toContain()` on substrings that survive stripping, or strip ANSI codes with a regex (`/\x1B\[[0-9;]*m/g`) before asserting on exact structure. Both approaches are acceptable; prefer `.toContain()` for simplicity.

### process.exit mock in select-reporter tests
`selectReporter` calls `process.exit(1)` on unknown reporter type. Use `vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process.exit") })` to intercept without killing the test process. Assert that the spy was called with `1`.

**Why throw:** vitest continues execution after `process.exit` mock returns normally, which can cause confusing state. Throwing stops execution at the exit call site, matching real behavior.

### ora mock in spinner tests
Mock `ora` at module level with `vi.mock("ora")`. The mock factory returns an object with `start`, `succeed`, `fail`, `stop` as `vi.fn()`. This is the approach already used for `node:child_process` and `node:fs/promises` in `worktree.test.ts`.

```typescript
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
  })),
}));
```

`createSpinner()` returns a wrapper — test the wrapper's behavior (start/succeed/fail/stop) by asserting calls on the mocked ora instance methods.

### console.error mock in select-reporter tests
`selectReporter` calls `console.error` before exiting on unknown type. Spy on `console.error` to verify the error message contains the unknown reporter name and lists available reporters. Use `vi.spyOn(console, "error").mockImplementation(() => {})` to suppress output.

## Test Coverage Required (from REQUIREMENTS.md)

### TEST-01: dry-run.ts
`formatTestPlan` must be tested for:
1. Correct output format (suite name, project, divider, totals section present)
2. Skipped test filtering (entries with `skip: true` appear under "Skipped:", not "Tests to execute:")
3. Command test rendering (`isCommand: true` → `[command]` label, not `[modelId]`)
4. Accurate totals (`totalExecutionUnits`, `concurrency`, `timeoutMs` all appear)

### TEST-02: select-reporter.ts
`selectReporter` must be tested for:
1. `"pretty"` → returns `createPrettyReporter(...)` result (Reporter interface fulfilled)
2. `"json"` → returns `createJsonReporter()` result
3. `"junit"` → returns `createJunitReporter()` result
4. Unknown type → `console.error` called, `process.exit(1)` called

### TEST-03: spinner.ts
`createSpinner()` wrapper must be tested for:
1. `start(text)` → calls `ora({ text, stream: process.stderr }).start()`
2. `succeed(text)` → calls `instance.succeed(text)`; instance cleared
3. `fail(text)` → calls `instance.fail(text)`; instance cleared
4. `stop()` → calls `instance.stop()`; instance cleared
5. Calling `succeed`/`fail`/`stop` before `start` → no-op (no crash, instance is undefined)
