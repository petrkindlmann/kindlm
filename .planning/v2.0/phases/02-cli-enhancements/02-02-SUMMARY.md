---
plan: "02-02"
status: complete
---

# 02-02 Summary: GitHub Action + HTTP Provider

## What was built

- **HTTP provider:** `createHttpProviderAdapter()` in core with body template interpolation (`{{model}}`, `{{messages}}`, etc.), header resolution (`{{apiKey}}`), and `getByPath()` JSON dot-path extraction for response mapping. Registered in provider registry. Zod schema added with `HttpProviderConfigSchema`. 36 unit tests.
- **GitHub Action:** Composite `action.yml` at repo root. Runs `npx @kindlm/cli test --reporter json`, posts PR comment via `actions/github-script` with upsert (marker: `<!-- kindlm-results -->`). Inputs: config, node-version, comment, fail-on-error.
- **CLI wiring:** HTTP provider creation in run-tests.ts with env lookup for headers and optional apiKeyEnv.

## Files created
- `packages/core/src/providers/http.ts` + test (36 tests)
- `action.yml`
- `examples/github-action.yml`

## Files modified
- `packages/core/src/config/schema.ts` — HttpProviderConfigSchema + "http" enum
- `packages/core/src/providers/registry.ts` — HTTP provider registration
- `packages/core/src/providers/index.ts` — exports
- `packages/cli/src/utils/run-tests.ts` — HTTP provider wiring

## Tests: 255 cloud + 170 CLI + core all pass
