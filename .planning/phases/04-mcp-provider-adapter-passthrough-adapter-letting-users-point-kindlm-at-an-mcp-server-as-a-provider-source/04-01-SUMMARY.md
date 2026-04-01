---
phase: 04-mcp-provider-adapter-passthrough-adapter-letting-users-point-kindlm-at-an-mcp-server-as-a-provider-source
plan: "01"
subsystem: core/providers + cli/utils
tags: [mcp, provider, adapter, schema, registry]
dependency_graph:
  requires: []
  provides: [MCP provider adapter, McpProviderConfig, McpProviderConfigSchema]
  affects: [packages/core/src/providers, packages/core/src/config/schema.ts, packages/cli/src/utils/run-tests.ts]
tech_stack:
  added: []
  patterns: [factory-function, result-types, zero-io-core, env-header-resolution-in-cli]
key_files:
  created:
    - packages/core/src/providers/mcp.ts
    - packages/core/src/providers/mcp.test.ts
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/providers/registry.ts
    - packages/cli/src/utils/run-tests.ts
decisions:
  - extractMcpText tries content[0].text (MCP protocol) then result then output — ordered by MCP spec priority
  - 403 maps to AUTH_FAILED alongside 401 — both indicate access denied from an MCP server perspective
  - env: header resolution in CLI (run-tests.ts), not in core — preserves zero-I/O constraint for @kindlm/core
  - apiKey passed as empty string to initialize() for MCP — adapter ignores it, consistent with http provider pattern
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 5
---

# Phase 04 Plan 01: MCP Provider Adapter Summary

MCP passthrough adapter — `createMcpAdapter` factory + Zod schema + registry route + CLI wiring for pointing kindlm at any MCP server via `serverUrl` + `toolName`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create MCP provider adapter (TDD) | 4675034 | mcp.ts, mcp.test.ts |
| 2 | Wire MCP into schema, registry, and CLI | 30e0e48 | schema.ts, registry.ts, run-tests.ts |

## What Was Built

### `packages/core/src/providers/mcp.ts`
- `McpProviderConfig` interface: `serverUrl`, `toolName`, `headers?`
- `createMcpAdapter(httpClient, mcpConfig)` factory following the zero-I/O pattern
- `extractMcpText(raw)`: tries `content[0].text` (MCP protocol) → `result` → `output` → `""`
- `mapMcpError(status, data)`: 401/403 → `AUTH_FAILED`, 429 → `RATE_LIMITED`, 5xx → `PROVIDER_ERROR`
- `estimateCost()` returns `null`, `supportsTools()` returns `false`
- POST body: `{ toolName, arguments: { messages, model, params } }`

### `packages/core/src/providers/mcp.test.ts`
- 18 Vitest tests covering all behaviors: happy path, text extraction fallbacks, error mapping, header forwarding, latencyMs shape

### `packages/core/src/config/schema.ts`
- `McpProviderConfigSchema` added after `OllamaProviderConfigSchema`
- `mcp` key added to `ProvidersSchema` object
- `"mcp"` added to `ModelSchema` `provider` enum
- `McpProviderSchemaConfig` type exported

### `packages/core/src/providers/registry.ts`
- `McpProviderConfig` type-imported from `./mcp.js`
- `createMcpAdapter` imported from `./mcp.js`
- `mcpConfig?: McpProviderConfig` added to `CreateProviderOptions`
- `"mcp"` handled before factory lookup; throws with descriptive message if `mcpConfig` absent
- Error message for unknown providers now lists `"mcp"` alongside `"http"`

### `packages/cli/src/utils/run-tests.ts`
- `"mcp"` added to the `apiKeyEnv` skip list (alongside `"ollama"` and `"http"`)
- MCP branch: resolves `env:` prefixed header values from `process.env` before passing to core
- Exits with error message if an `env:` header's env var is missing

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **`extractMcpText` ordering**: `content[0].text` (MCP protocol first), then `result`, then `output`, then `""`. Matches MCP spec priority.
2. **403 → AUTH_FAILED**: Both 401 and 403 map to `AUTH_FAILED` since both indicate access denied from an MCP server — consistent with the security intent.
3. **env: resolution in CLI only**: `run-tests.ts` resolves `env:` header prefixes; `mcp.ts` passes headers as-is. Preserves zero-I/O constraint in `@kindlm/core`.
4. **Empty apiKey**: `initialize()` called with `apiKey: ""` for MCP adapter — adapter ignores it, consistent with the `http` provider pattern.

## Verification

- `npm run typecheck`: exits 0, all packages pass
- `npx vitest run packages/core/src/providers/mcp.test.ts`: 18/18 tests pass
- `mcp` present in `ProvidersSchema` and `ModelSchema` provider enum
- No new npm dependencies added

## Self-Check: PASSED
