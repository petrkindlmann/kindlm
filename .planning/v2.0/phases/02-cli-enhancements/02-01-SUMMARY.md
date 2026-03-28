---
plan: "02-01"
status: complete
---

# 02-01 Summary: CLI Flags + Caching

## What was built

- **--dry-run:** `buildTestPlan()` pure function in core + `formatTestPlan()` chalk formatter in CLI. Prints test plan table (tests x models x assertions) and exits without API calls.
- **--watch:** `watchFile()` utility using `node:fs.watch` with 500ms debounce. Wraps test execution in a loop, catches errors to keep watcher alive.
- **Result caching:** SHA-256 cache key from `{model, messages, params, tools}`. `.kindlm/cache/{hash}.json` storage. `createCachingAdapter()` decorator wraps ProviderAdapter.complete(). `--no-cache` bypasses.

## Files created
- `packages/core/src/engine/test-plan.ts` + test
- `packages/cli/src/utils/dry-run.ts`
- `packages/cli/src/utils/watcher.ts` + test
- `packages/cli/src/utils/cache.ts`
- `packages/cli/src/utils/caching-adapter.ts`

## Files modified
- `packages/core/src/engine/index.ts` — exports
- `packages/cli/src/commands/test.ts` — 3 new flags
- `packages/cli/src/utils/run-tests.ts` — caching integration

## Tests: 170 CLI + 8 core new tests pass
