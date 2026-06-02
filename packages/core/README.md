# @kindlm/core

![CI](https://github.com/petrkindlmann/kindlm/actions/workflows/ci.yml/badge.svg)

The zero-I/O business-logic engine behind [KindLM](https://www.npmjs.com/package/@kindlm/cli) — behavioral regression testing for AI agents. Test what your agents **do**, not just what they say.

> **Most users want the CLI, not this package.** Install [`@kindlm/cli`](https://www.npmjs.com/package/@kindlm/cli) and write a `kindlm.yaml`. This package is the embeddable engine (config parsing, provider adapters, assertions, the test runner, reporters) for people building tools on top of KindLM. It performs **no I/O** — all HTTP, file access, and console output are injected via interfaces.

## What's in here

- **Config** — Zod schema + YAML parser for `kindlm.yaml`, variable interpolation
- **Providers** — adapters for OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, plus a generic `http` adapter and an `mcp` passthrough
- **Assertions** — tool calls, JSON Schema (AJV), PII guardrails, LLM-as-judge, drift, keywords, latency, cost
- **Engine** — concurrency, retries, timeouts, multi-run aggregation, gates
- **Reporters** — pretty, JSON, JUnit XML, and a compliance-documentation draft

## Supported Providers

The provider key is the value of `provider:` in your `models:` block.

| Provider key | Example model | Notes |
|--------------|---------------|-------|
| `openai` | `gpt-4o` | Also covers Azure OpenAI via a custom `baseUrl` (see below) |
| `anthropic` | `claude-sonnet-4-5-20250929` | |
| `gemini` | `gemini-2.0-flash` | Google Gemini |
| `mistral` | `mistral-large-latest` | Cost estimation not yet available |
| `cohere` | `command-r-plus` | Cost estimation not yet available |
| `ollama` | `llama3` | Local models; no cost |
| `http` | any | Generic OpenAI-compatible HTTP endpoint |
| `mcp` | — | Passthrough HTTP POST to an MCP-style tool server |

**Azure OpenAI:** use the `openai` provider with a custom `baseUrl` pointed at your Azure deployment endpoint. There is no dedicated `azure` provider.

**Not yet supported:** AWS Bedrock, a first-class Azure adapter with deployment routing, and the full MCP JSON-RPC `tools/call` envelope (the `mcp` adapter sends a simplified `{toolName, arguments}` shape).

## Installation

```bash
npm install @kindlm/core
```

## Usage

`@kindlm/core` is dependency-injection–first. You supply an `HttpClient` (and, where needed, a `FileReader`); core never touches the network or filesystem itself.

```ts
import { parseConfig, runSuite } from "@kindlm/core";

// `httpClient` and `fileReader` are interfaces you implement (the CLI
// provides Node.js-backed versions). Core stays pure and testable.
const result = await parseConfig(yamlText, { fileReader });
if (!result.success) {
  console.error(result.error); // Result<T, KindlmError> — core never throws
  process.exit(1);
}
```

See [`docs/03-PROVIDER_INTERFACE.md`](../../docs/03-PROVIDER_INTERFACE.md) and [`docs/04-ASSERTION_ENGINE.md`](../../docs/04-ASSERTION_ENGINE.md) for the full embedding surface.

## Config format

The canonical config is `kindlm.yaml` (the same file the CLI's `kindlm init` scaffolds):

```yaml
kindlm: 1
project: "my-agent"

suite:
  name: "refund-agent"

providers:
  openai:
    apiKeyEnv: "OPENAI_API_KEY"

models:
  - id: "gpt-4o"
    provider: "openai"
    model: "gpt-4o"
    params:
      temperature: 0

prompts:
  refund:
    system: "You are a refund support agent. Use lookup_order(order_id) to find orders."
    user: "{{message}}"

tests:
  - name: "looks-up-order"
    prompt: "refund"
    vars:
      message: "I want to return order #12345"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: "eligible" }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "12345" }
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: "Response is empathetic and professional"
          minScore: 0.8
```

Assertions live under each test's `expect:` block: `toolCalls[]`, `output` (format/contains/notContains/maxLength), `judge[]`, `guardrails.pii`, `guardrails.keywords`, `baseline.drift`, `latency.maxMs`, `cost.maxUsd`.

## Feature flags

Optional feature flags are read from `.kindlm/config.json` under the `features` key. The flag-reading helper (`isEnabled(flags, name)`) is provided by **`@kindlm/cli`** (it reads the file from disk, which zero-I/O core cannot do) — it is not exported from this package.

```json
{
  "features": {
    "betaJudge": false,
    "costGating": false,
    "runArtifacts": false
  }
}
```

| Flag | Description |
|------|-------------|
| `betaJudge` | Runs the LLM-as-judge 3× and takes the median (a 2-of-3 quorum). Triples judge cost. |
| `costGating` | Enforces the suite-level `gates.costMaxUsd` run budget. Per-test `expect.cost.maxUsd` assertions always run regardless of this flag. |
| `runArtifacts` | Persists raw provider responses alongside test results |

If `.kindlm/config.json` is absent or a flag is omitted, the flag is treated as `false`.

## License

MIT.
