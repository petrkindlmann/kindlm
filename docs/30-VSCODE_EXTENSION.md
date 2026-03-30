# VS Code Extension

The KindLM VS Code extension adds first-class editing support for `kindlm.yaml` config files. It provides real-time diagnostics, context-aware autocomplete, inline hover documentation, JSON schema validation, and code snippets — so you can write behavioral test configs faster and with fewer errors.

## Installation

**From the Marketplace:**

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **KindLM**
4. Click **Install**

**From the command line:**

```bash
code --install-extension kindlm.kindlm
```

**Requirements:** VS Code 1.85.0 or later.

**Activation:** The extension activates automatically when your workspace contains a `kindlm.yaml` or `kindlm.yml` file. No manual activation is required.

## Features

### Real-Time Diagnostics

The extension runs inline diagnostics whenever you open or edit a `kindlm.yaml` / `kindlm.yml` file. Errors and warnings appear in the Problems panel and inline as squiggles.

**What the extension checks:**

| Check | Severity | Description |
|-------|----------|-------------|
| Missing `version` field | Error | Top-level `version` field is required and must be `1` |
| Invalid `version` value | Error | Only `version: 1` is supported |
| Missing `suites` field | Error | Top-level `suites` field is required |
| Invalid provider format | Error | `provider:` values must use `provider:model` format (e.g., `openai:gpt-4o`) |
| Unknown assertion type | Warning | `type:` inside assertion blocks must be one of the valid types listed below |
| Temperature out of range | Error | `temperature` must be between `0` and `2` |
| Threshold out of range | Error | `threshold` must be between `0.0` and `1.0` |

**Valid assertion types:** `tool_called`, `tool_not_called`, `tool_order`, `schema`, `judge`, `no_pii`, `keywords_present`, `keywords_absent`, `drift`, `latency`, `cost`

Example — invalid provider format flagged inline:

```yaml
models:
  - id: gpt-4o
    provider: openai-gpt-4o  # Error: expected "openai:gpt-4o"
```

---

### Autocomplete

The extension provides context-aware completions. Press `Ctrl+Space` (`Cmd+Space`) to trigger, or completions appear automatically when you type `:`, ` `, or `-`.

**Top-level keys:**

| Key | Description |
|-----|-------------|
| `kindlm` | Config schema version (required, must be `1`) |
| `project` | Project identifier for Cloud upload and reports |
| `suite` | Suite metadata — name and description |
| `providers` | Provider configurations |
| `models` | Model configurations |
| `prompts` | Named prompt templates |
| `tests` | Test cases |
| `gates` | Suite pass/fail gates |
| `defaults` | Default settings for all tests |
| `compliance` | EU AI Act Annex IV compliance report settings |
| `upload` | KindLM Cloud upload settings |

**Inside `expect:`:**

| Key | Description |
|-----|-------------|
| `output` | Output format and content assertions |
| `toolCalls` | Expected tool/function calls |
| `judge` | LLM-as-judge evaluation criteria |
| `guardrails` | PII and keyword safety guardrails |
| `baseline` | Behavioral drift detection |
| `latency` | Response time assertion |
| `cost` | Token cost budget assertion |

**Inside `expect.toolCalls[]`:**

| Key | Description |
|-----|-------------|
| `tool` | Expected tool/function name (required) |
| `argsMatch` | Expected arguments (partial match) |
| `shouldNotCall` | Assert this tool was NOT called |
| `argsSchema` | Path to JSON Schema to validate arguments |
| `order` | Expected position in call sequence (0-indexed) |

**Inside `expect.judge[]`:**

| Key | Description |
|-----|-------------|
| `criteria` | Natural language evaluation criteria (required) |
| `minScore` | Minimum score (0.0–1.0) to pass (default: 0.7) |
| `rubric` | Detailed scoring rubric for the judge |
| `model` | Override judge model for this criterion |

**Inside `expect.guardrails`:**

| Key | Description |
|-----|-------------|
| `pii` | PII detection (SSN, credit card, email, phone) |
| `keywords` | Keyword allow/deny guardrail |

**Inside `expect.guardrails.pii`:**

| Key | Description |
|-----|-------------|
| `enabled` | Enable PII detection (default: `true`) |
| `denyPatterns` | Regex patterns that must NOT appear in output |
| `customPatterns` | Named custom PII patterns |

**Inside `expect.guardrails.keywords`:**

| Key | Description |
|-----|-------------|
| `deny` | Phrases that must NOT appear in output |
| `allow` | Output must contain at least one of these phrases |

**Inside `expect.output`:**

| Key | Description |
|-----|-------------|
| `format` | Expected output format: `text` or `json` |
| `contains` | Output must contain all of these substrings |
| `notContains` | Output must NOT contain any of these substrings |
| `maxLength` | Maximum character length of the output |
| `schemaFile` | Path to JSON Schema file (required when `format` is `json`) |

**Inside `expect.baseline`:**

| Key | Description |
|-----|-------------|
| `drift` | Detect behavioral drift against saved baseline |

**Inside `expect.baseline.drift`:**

| Key | Description |
|-----|-------------|
| `maxScore` | Maximum drift score (0–1). Fail if exceeded. |
| `method` | Drift detection method: `judge`, `embedding`, or `field-diff` |
| `fields` | JSON paths to compare (for `field-diff` method) |

**Inside `expect.latency`:**

| Key | Description |
|-----|-------------|
| `maxMs` | Maximum response latency in milliseconds |

**Inside `expect.cost`:**

| Key | Description |
|-----|-------------|
| `maxUsd` | Maximum token cost in USD |

**Value completions:**

The extension also suggests values for specific fields:

- **Model names** (inside `model:`) — gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini, o3-mini, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001, claude-opus-4-20250514, gemini-2.0-flash, gemini-2.0-pro, gemini-1.5-pro, mistral-large-latest, command-r-plus, llama3.1, and more
- **Provider names** (inside `provider:`) — `openai`, `anthropic`, `gemini`, `mistral`, `cohere`, `ollama`, `http`
- **Drift methods** (inside `method:` under `drift:`) — `judge`, `embedding`, `field-diff`
- **Output formats** (inside `format:` under `output:`) — `text`, `json`

---

### Hover Documentation

Hovering over any KindLM config key shows inline documentation. For complex sub-sections, hover shows a Markdown card with a summary and example YAML.

Examples of what hover shows:

- Hover over `expect` — shows a summary of all assertion types available
- Hover over `toolCalls` — shows description plus an example `toolCalls:` block
- Hover over `judge` — shows how LLM-as-judge scoring works, including `minScore`
- Hover over `guardrails` — shows PII and keyword guardrail options
- Hover over `output`, `baseline`, `latency`, `cost` — each shows relevant fields and an example
- Hover over a provider name value (e.g., `openai`) — shows common models for that provider and the expected API key environment variable

---

### JSON Schema

The extension bundles a `kindlm.schema.json` that provides schema-based validation for all `kindlm.yaml` and `kindlm.yml` files. The schema is contributed automatically via VS Code's `yamlValidation` contribution point — no configuration required.

**Schema validation is automatic** for any file named `kindlm.yaml` or `kindlm.yml`.

For the best experience, install the [Red Hat YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (`redhat.vscode-yaml`) alongside KindLM. It enables full schema-driven completions and validation that works in concert with the KindLM extension's custom completions.

---

### Snippets

The extension includes 10 snippets for scaffolding common config patterns. Type the prefix and press `Tab` to expand.

| Prefix | Description |
|--------|-------------|
| `kindlm-init` | Full config file skeleton |
| `kindlm-test` | Single test case |
| `kindlm-model` | Model configuration entry |
| `kindlm-prompt` | Named prompt template |
| `kindlm-expect-tool` | `toolCalls` assertion |
| `kindlm-expect-judge` | `judge` assertion with `minScore` |
| `kindlm-expect-pii` | PII guardrail |
| `kindlm-expect-keywords` | Keyword guardrail |
| `kindlm-expect-output` | Output content assertion |
| `kindlm-expect-drift` | Baseline drift assertion |

**Example — `kindlm-init` expands to:**

```yaml
kindlm: 1
project: "my-project"

suite:
  name: "my-suite"
  description: "Behavioral tests for my AI agent"

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
  main:
    system: "You are a helpful assistant."
    user: "{{message}}"

tests:
  - name: "happy-path"
    prompt: main
    vars:
      message: "Hello, how can you help me?"
    expect:

gates:
  passRateMin: 0.95
```

The cursor lands inside `expect:` where you can continue building your assertions.

## Recommended Companion Extensions

**[Red Hat YAML](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)** (`redhat.vscode-yaml`)

Installing the Red Hat YAML extension enables full JSON schema-based validation and completions driven by the bundled `kindlm.schema.json`. This adds a second layer of validation that works alongside the KindLM extension's custom diagnostics and completions. It is not required, but recommended for the best editing experience.

## Troubleshooting

**Extension not activating**

The extension only activates when a `kindlm.yaml` or `kindlm.yml` file exists in your workspace root. Open VS Code with the folder that contains your config file, not a parent directory.

**Completions not showing**

- Confirm the file is named exactly `kindlm.yaml` or `kindlm.yml`
- Press `Ctrl+Space` (`Cmd+Space`) to manually trigger completions
- Check the Extensions panel to confirm the KindLM extension is enabled

**Schema validation not working**

Schema-driven validation requires the Red Hat YAML extension (`redhat.vscode-yaml`). Install it from the Marketplace and reload VS Code. The KindLM extension's own diagnostics (version, suites, provider format, etc.) run independently of the Red Hat YAML extension.

**Diagnostics show errors on a valid file**

The extension's diagnostics check for `version:` and `suites:` at the top level. Ensure your config has both fields. If you believe a diagnostic is incorrect, open an issue at [github.com/petrkindlmann/kindlm](https://github.com/petrkindlmann/kindlm).
