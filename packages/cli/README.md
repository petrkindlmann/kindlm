# KindLM

![CI](https://github.com/petrkindlmann/kindlm/actions/workflows/ci.yml/badge.svg)

Behavioral regression testing for AI agents. Test what your agents **do** — not just what they say.

## Why KindLM?

LLM evals measure text quality. KindLM tests **behavior** — the tool calls your agent makes, the decisions it takes, and whether it leaks PII or violates compliance rules. It runs in CI so regressions never ship.

## Features

- **Tool call assertions** — verify agents call the right tools with the right arguments, in the right order
- **Schema validation** — structured output checked against JSON Schema (AJV)
- **PII detection** — catch leaked SSNs, credit cards, emails, phone numbers, IBANs
- **LLM-as-judge** — score responses against natural-language criteria (0.0–1.0)
- **Drift detection** — semantic + field-level comparison against saved baselines
- **Keyword guards** — require or forbid specific phrases in output
- **Latency & cost budgets** — fail tests that exceed time or token-cost thresholds
- **EU AI Act compliance** — generate Annex IV documentation from test results
- **CI-native** — exit code 0/1, JUnit XML reporter, GitHub Actions ready

## Supported Providers

| Provider | Example config |
|----------|---------------|
| OpenAI | `openai:gpt-4o` |
| Anthropic | `anthropic:claude-sonnet-4-5-20250929` |
| Google Gemini | `google:gemini-2.0-flash` |
| Mistral | `mistral:mistral-large-latest` |
| Cohere | `cohere:command-r-plus` |
| Ollama | `ollama:llama3` |

## Quick Start

Try it instantly:

```bash
npx @kindlm/cli init
```

Or install globally:

```bash
npm install -g @kindlm/cli
kindlm init
```

Edit the generated `kindlm.yaml`:

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

Run your tests:

```bash
kindlm test
```

Output:

```
  refund-agent / looks-up-order

  gpt-4o
    ✓ looks-up-order  (1.3s)
      ✓ tool_called: lookup_order
      ✓ pii: no PII detected
      ✓ judge: 0.92 ≥ 0.80

  1 passed, 0 failed
  Gates: ✓ PASSED
```

## CLI Flags

| Flag | Description | Added |
|------|-------------|-------|
| `--reporter <type>` | Output format: `pretty` (default), `json`, `junit` | v1.0.0 |
| `--output <path>` | Write report to file | v1.0.0 |
| `--compliance` | Generate EU AI Act Annex IV report | v1.0.0 |
| `--pdf <path>` | Export compliance report as PDF (requires `--compliance`) | v1.0.0 |
| `-s <suite>` | Run a specific suite by name | v1.0.0 |
| `--runs <count>` | Override the `repeat` count from config | v1.0.0 |
| `--gate <percent>` | Fail if suite pass rate falls below threshold (0–100) | v1.0.0 |
| `--isolate` | Run in an isolated git worktree (clean environment) | v2.0.0 |
| `--concurrency <n>` | Override the concurrency setting from config | v2.1.0 |
| `--timeout <ms>` | Override the per-test timeout from config | v2.1.0 |

## CI Integration

```yaml
# .github/workflows/test.yml
- run: npm install -g @kindlm/cli
- run: kindlm test --reporter junit --output results.xml
```

## Repository Layout

```
packages/
  core/       @kindlm/core  — Business logic, zero I/O dependencies
  cli/        @kindlm/cli   — CLI entry point
  cloud/      @kindlm/cloud — Cloudflare Workers API + D1 database
docs/         Technical specs and documentation
site/         Documentation website (Next.js)
```

## Documentation

Full docs: [kindlm.dev](https://kindlm.dev) | Source: [`docs/`](./docs/)

## License

MIT (core + CLI) | AGPL (cloud)
