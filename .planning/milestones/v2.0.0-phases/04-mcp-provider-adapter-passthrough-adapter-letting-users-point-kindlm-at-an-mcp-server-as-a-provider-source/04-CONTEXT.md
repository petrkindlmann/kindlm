# Phase 4: MCP provider adapter - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Add MCP as a first-class provider type. Users configure `serverUrl` + `toolName` in kindlm.yaml. The adapter sends prompts to the MCP server via HTTP POST and maps the tool result to ProviderResponse for all existing assertion types. All implementation stays in core — zero-I/O via injected HttpClient.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Pre-written plan (04-01-PLAN.md) defines the exact implementation shape, file locations, and acceptance criteria.

</decisions>

<code_context>
## Existing Code Insights

### Established Patterns
- Factory function pattern: `createMcpAdapter()` following `createOpenAiAdapter()`, `createAnthropicAdapter()` etc.
- `ProviderAdapter` interface in `packages/core/src/providers/interface.ts` defines the contract
- `createProvider()` registry in `packages/core/src/providers/registry.ts` maps provider name strings to factory calls
- `HttpClient` injected interface — use it for the POST request (no direct fetch in core)
- Result types: return `Result<ProviderResponse, ProviderError>` — no throws

### Integration Points
- `packages/core/src/config/schema.ts` — add `McpProviderConfigSchema` to provider union
- `packages/core/src/providers/registry.ts` — register `mcp: createMcpAdapter`
- `packages/cli/src/utils/run-tests.ts` — pass mcpConfig from parsed config to registry

</code_context>

<specifics>
## Specific Ideas

See 04-01-PLAN.md — full implementation spec already written.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
