# Phase 2: CLI Enhancements — Research

**Date:** 2026-03-28

## CLI-V2-01: Dry-Run Mode

**Insertion point:** After config parsing in test.ts, before provider creation. Extract `buildTestPlan()` from runner.ts execution plan logic (lines 112-143). Pure function in core — no I/O.

**Key files:** `commands/test.ts`, `run-tests.ts`, `engine/runner.ts`
**New files:** `core: engine/test-plan.ts`, `cli: utils/dry-run.ts`

## CLI-V2-02: Watch Mode

**Approach:** `node:fs.watch` + manual 500ms debounce. Single file watch (kindlm.yaml) — no chokidar needed. Wrap existing test execution in watch loop, catch errors to keep watcher alive.

**Key files:** `commands/test.ts`
**New files:** `cli: utils/watcher.ts`

## CLI-V2-03: Result Caching

**Cache key:** SHA-256 of `{model, messages, params, tools}`. Storage: `.kindlm/cache/{hash}.json`. Max 100 files, 24h TTL. `--no-cache` flag bypasses.

**Implementation:** Decorator pattern — `createCachingAdapter()` wraps `ProviderAdapter.complete()`. Applied in run-tests.ts after adapter creation.

**Key files:** `run-tests.ts`, `last-run.ts` (pattern reference)
**New files:** `cli: utils/cache.ts`, `cli: utils/caching-adapter.ts`

## CLI-V2-04: GitHub Action

**Type:** Composite action at `/action.yml`. Runs `npx @kindlm/cli test --reporter json`, parses output, posts PR comment via `actions/github-script`. Uses `<!-- kindlm-results -->` marker for upsert.

**Inputs:** config, node-version, comment, fail-on-error

## CLI-V2-05: HTTP Provider

**Pattern:** Same factory as other providers. Takes `HttpProviderConfig` (baseUrl, method, headers, bodyTemplate, responseMapping) at construction. Uses injected `HttpClient` for zero-I/O compliance.

**Template interpolation:** `{{model}}`, `{{messages}}`, `{{temperature}}`, `{{maxTokens}}`, `{{topP}}`
**Response mapping:** Simple dot-path extraction (`getByPath()`)

**Schema changes:** Add `HttpProviderConfigSchema` to ProvidersSchema, add `"http"` to provider enum in ModelSchema.
