# KindLM — VS Code Extension

First-class editor support for [KindLM](https://kindlm.com) config files (`kindlm.yaml` / `kindlm.yml`).

## Features

### YAML Validation

Real-time diagnostics as you type:

- Flags missing required fields (`kindlm`, `project`, `suite`, `providers`, `models`, `prompts`, `tests`)
- Validates `provider` is a known value (`openai`, `anthropic`, `gemini`, `mistral`, `cohere`, `ollama`, `http`)
- Validates `temperature` is in range 0–2
- Validates `minScore` and `maxScore` are in range 0.0–1.0
- Catches unknown keys with helpful messages

### Autocomplete

Context-aware completions inside `kindlm.yaml`:

- **Top-level fields:** `kindlm`, `project`, `suite`, `providers`, `models`, `prompts`, `tests`, `gates`, `defaults`
- **`expect` sub-keys:** `output`, `toolCalls`, `judge`, `guardrails`, `baseline`, `latency`, `cost`
- **`expect.toolCalls[]` fields:** `tool`, `argsMatch`, `shouldNotCall`, `argsSchema`, `order`
- **`expect.judge[]` fields:** `criteria`, `minScore`, `model`, `rubric`
- **`expect.guardrails` fields:** `pii`, `keywords`, `deny`, `allow`
- **Model names:** `gpt-4o`, `claude-sonnet-4-5-20250929`, `gemini-2.0-flash`, and more
- **Provider names:** `openai`, `anthropic`, `gemini`, `mistral`, `cohere`, `ollama`, `http`

### Hover Documentation

Hover over any KindLM field to get inline documentation with expected values and examples.

### JSON Schema

Full JSON Schema for `kindlm.yaml` is bundled. If you have the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) installed, you get schema-based completions and validation automatically.

### Snippets

Starter snippets to scaffold new config files and test blocks:

- `kindlm-init` — full config file skeleton (kindlm v1)
- `kindlm-test` — single test case
- `kindlm-model` — model configuration entry
- `kindlm-prompt` — named prompt template
- `kindlm-expect-tool` — `toolCalls` assertion
- `kindlm-expect-judge` — `judge` assertion with minScore
- `kindlm-expect-pii` — PII guardrail
- `kindlm-expect-keywords` — keyword guardrail
- `kindlm-expect-output` — output content assertion
- `kindlm-expect-drift` — baseline drift assertion

## Quick Start

1. Install the extension from the VS Code Marketplace
2. Open a project with a `kindlm.yaml` file (or create one with `kindlm init`)
3. The extension activates automatically when a `kindlm.yaml` or `kindlm.yml` is present

## Example Config

```yaml
kindlm: 1
project: my-agent

suite:
  name: refund-agent
  description: Behavioral tests for the refund agent

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
      maxTokens: 1024

prompts:
  refund:
    system: You are a helpful refund agent. Be empathetic and professional.
    user: "{{message}}"

tests:
  - name: happy-path-refund
    prompt: refund
    vars:
      message: "I want to return order #12345"
    expect:
      toolCalls:
        - tool: lookup_order
          argsMatch:
            order_id: "12345"
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: Response is empathetic and professional
          minScore: 0.8

gates:
  passRateMin: 0.95
```

## Requirements

- VS Code 1.85.0 or newer
- A `kindlm.yaml` file in your workspace (created by `kindlm init`)

For YAML schema-based completions, install the [YAML extension by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).

## Links

- [KindLM Documentation](https://kindlm.com)
- [GitHub](https://github.com/petrkindlmann/kindlm)
- [Report an Issue](https://github.com/petrkindlmann/kindlm/issues)

## License

MIT
