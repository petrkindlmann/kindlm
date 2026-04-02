# Changelog

All notable changes to KindLM are documented here.

## [2.1.0] — 2026-04-02

### Added

- **`--concurrency <n>` flag for `kindlm test`** — overrides `defaults.concurrency` at runtime (integer ≥ 1).
- **`--timeout <ms>` flag for `kindlm test`** — overrides `defaults.timeoutMs` at runtime (≥ 0, controls per-test execution timeout).
- **`betaJudge` feature flag** — enables 3-pass median judge scoring; errored passes are excluded from scoring; ceil(N/2) quorum required for a verdict.
- **`costGating` feature flag** — controls whether `gates.costMaxUsd` is enforced by the runner; disabled by default until flag is enabled.
- **`--isolate` file copying** — `--isolate` now copies the config file and all referenced `schemaFile`/`argsSchema` files into the worktree before running, so isolated runs are fully self-contained.

---

## [2.0.0] — 2026-04-01

### Added

- **MCP provider adapter** — passthrough HTTP POST adapter; any MCP server can be used as a provider source via the `mcp` provider type.
- **`--isolate` flag for `kindlm test`** — runs the suite in an isolated git worktree; fail-closed cleanup on error; graceful degradation when git is unavailable.
- **Feature flags via `.kindlm/config.json`** — `isEnabled()` helper reads flags at runtime; flags default to `false` when the config file is absent or malformed.
- **Append-only run artifacts** — test run output is written to `.kindlm/runs/{runId}/{executionId}/` with deterministic SHA-256 run IDs.
- **Versioned baselines with nonce-unique filenames** — baselines are immutable and never overwritten; a pointer file at `-latest.json` tracks the current baseline.

### Fixed

- Cloud Worker deployed to `api.kindlm.com` (13 D1 migrations applied to kindlm-prod).
- VS Code extension published to the marketplace.
- Stripe billing wired in test mode.

---

## Unreleased

### Fixed

- **Case-insensitive contains/notContains** — `contains` and `notContains` assertions now compare case-insensitively, consistent with the `keywords` assertion. Previously, `contains: ["hello"]` would fail if the model returned "Hello".

- **Multi-turn tool conversations** — Fixed broken multi-turn tool conversations where the OpenAI API returned `messages with role 'tool' must be a response to a preceding message with 'tool_calls'`. The conversation manager now preserves `toolCalls` on assistant messages, and all 6 provider adapters (OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama) correctly serialize tool calls when replaying conversation history.

### Added

- **Command test input** — Tests can now use `command:` instead of `prompt:` to run shell commands and assert on their stdout. Commands can emit KindLM protocol events (`{"kindlm":"tool_call",...}` and `{"kindlm":"output_json",...}`) to report structured data. Command tests run once per repeat (not multiplied by models) and use `modelId: "command"` in reports. See [10-COMMAND-TESTS.md](./10-COMMAND-TESTS.md).

- **Deterministic/probabilistic gate split** — New optional gate fields `deterministicPassRate` and `probabilisticPassRate` allow separate pass-rate thresholds by assertion category. Deterministic assertions (tool_called, schema, pii, keywords, latency, cost) can require stricter thresholds than probabilistic ones (judge, drift). Classification is in `packages/core/src/assertions/classification.ts`.

- **OpenTelemetry trace ingestion** — New `kindlm trace` command starts an OTLP/HTTP listener, collects spans from instrumented agents, and evaluates assertions against the trace data. Supports span filtering, configurable attribute mapping (follows GenAI semantic conventions), and optional command spawning. See [21-OTEL-TRACE.md](./21-OTEL-TRACE.md).

- **Trace config in kindlm.yaml** — New optional `trace:` section for configuring port, timeout, span mapping, and span filtering for the trace command.

### New files

| File | Package | Purpose |
|------|---------|---------|
| `assertions/classification.ts` | core | Assertion type → deterministic/probabilistic mapping |
| `engine/command.ts` | core | CommandExecutor interface + parseCommandOutput() |
| `trace/types.ts` | core | OTLP wire types, ParsedSpan, TraceConfigSchema |
| `trace/parser.ts` | core | parseOtlpPayload() |
| `trace/mapper.ts` | core | filterSpans(), mapSpansToResult(), buildContextFromTrace() |
| `utils/command-executor.ts` | cli | Node.js CommandExecutor via child_process.spawn |
| `utils/trace-server.ts` | cli | OTLP HTTP server for trace collection |
| `commands/trace.ts` | cli | kindlm trace command |

### Modified files

| File | Change |
|------|--------|
| `config/schema.ts` | `prompt` optional, `command` field, `trace:` config, gate split fields |
| `config/parser.ts` | Conditional prompt cross-reference check |
| `engine/runner.ts` | Command test execution path, `commandExecutor` in RunnerDeps |
| `engine/gate.ts` | Deterministic/probabilistic gate evaluation |
| `assertions/index.ts` | Export classification functions |
| `types/config.ts` | Export TraceConfig types |
| `core/index.ts` | Export trace module |
| `cli/index.ts` | Register trace command |
| `cli/utils/run-tests.ts` | Inject command executor, fix execution unit count |

### Repository cleanup

- Moved `PRD_Gemini_V2.md`, `reference/`, `content-pack/`, `dashboard/`, `kindlm-cli/` to `docs/archive/`
- Archived duplicate `docs/architecture.md` as `docs/archive/architecture-legacy.md`
- Removed `.DS_Store` from git tracking
- Updated `README.md` to reflect clean root structure
