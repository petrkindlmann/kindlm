# KindLM — VS Code Extension

First-class editor support for [KindLM](https://kindlm.com) config files (`kindlm.yaml` / `kindlm.yml`).

## Features

### YAML Validation

Real-time diagnostics as you type:

- Flags missing required fields (`version`, `suites`)
- Validates provider format — must be `provider:model` (e.g., `openai:gpt-4o`, `anthropic:claude-sonnet-4-5`)
- Catches unknown assertion types with a helpful list of valid values
- Validates `temperature` is in range 0–2
- Validates `threshold` is in range 0.0–1.0

### Autocomplete

Context-aware completions inside `kindlm.yaml`:

- Top-level fields: `version`, `defaults`, `suites`
- Assertion types: `tool_called`, `tool_not_called`, `tool_order`, `schema`, `judge`, `no_pii`, `keywords_present`, `keywords_absent`, `drift`, `latency`, `cost`
- Provider names: `openai`, `anthropic`, `ollama`
- Common field names: `name`, `input`, `assert`, `system_prompt_file`, `temperature`, `runs`, `threshold`

### Hover Documentation

Hover over any KindLM field to get inline documentation explaining what it does, expected values, and examples.

### JSON Schema

Full JSON Schema for `kindlm.yaml` is bundled. If you have the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) installed, you get schema-based completions and validation automatically.

### Snippets

Starter snippets to scaffold new config files and test blocks:

- `kindlm-suite` — a full suite with one test
- `kindlm-test` — a single test with assertions
- `kindlm-assert-tool` — `tool_called` assertion
- `kindlm-assert-judge` — `judge` assertion with threshold

## Quick Start

1. Install the extension from the VS Code Marketplace
2. Open a project with a `kindlm.yaml` file (or create one with `kindlm init`)
3. The extension activates automatically when a `kindlm.yaml` or `kindlm.yml` is present

## Example Config

```yaml
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 3

suites:
  - name: "refund-agent"
    system_prompt_file: ./prompts/refund.md
    tests:
      - name: "happy-path-refund"
        input: "I want to return order #12345"
        assert:
          - type: tool_called
            value: lookup_order
            args:
              order_id: "12345"
          - type: no_pii
          - type: judge
            criteria: "Response is empathetic and professional"
            threshold: 0.8
```

## Requirements

- VS Code 1.85.0 or newer
- A `kindlm.yaml` file in your workspace (created by `kindlm init`)

For YAML schema-based completions, install the [YAML extension by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml).

## Links

- [KindLM Documentation](https://kindlm.com)
- [GitHub](https://github.com/kindlm/kindlm)
- [Report an Issue](https://github.com/kindlm/kindlm/issues)

## License

MIT
