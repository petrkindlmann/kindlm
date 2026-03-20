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

```bash
npm install -g @kindlm/cli
kindlm init
```

Edit the generated `kindlm.yaml`:

```yaml
kindlm: 1
project: "my-agent"

suite:
  name: "support-agent"

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
  support:
    system: "You are a support agent. Use lookup_order(order_id) to find orders."
    user: "{{message}}"

tests:
  - name: "looks-up-order"
    prompt: "support"
    vars:
      message: "Where is order #12345?"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: "shipped" }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "12345" }
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: "Response is helpful and mentions shipping status"
          minScore: 0.8
```

Run your tests:

```bash
kindlm test
```

```
  support-agent / looks-up-order

  gpt-4o
    ✓ looks-up-order  (1.3s)
      ✓ tool_called: lookup_order
      ✓ pii: no PII detected
      ✓ judge: 0.92 ≥ 0.80

  1 passed, 0 failed
  Gates: ✓ PASSED
```

## CI Integration

```yaml
# .github/workflows/kindlm.yml
- run: npm install -g @kindlm/cli
- run: kindlm test --reporter junit > junit.xml
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Exit code 0 = all gates passed. Exit code 1 = something failed.

## Documentation

| Guide | Description |
|-------|-------------|
| [Adopt KindLM in 30 Minutes](https://kindlm.com/docs/adopt) | Install → first test → CI in one sitting |
| [Tutorial: Refund Agent](https://kindlm.com/docs/tutorial) | Full walkthrough with tool calls, PII, and guards |
| [CI: GitHub Actions in 5 Minutes](https://kindlm.com/docs/ci-guide) | Copy-paste workflow for CI |
| [KindLM vs Promptfoo vs Scripts](https://kindlm.com/docs/comparison) | When to use which |
| [Examples Gallery](https://kindlm.com/docs/examples) | 7 copy-paste configs for common scenarios |
| [How to Model My System](https://kindlm.com/docs/modeling) | Decision tree for picking assertion types |
| [Troubleshooting](https://kindlm.com/docs/troubleshooting) | Common errors and fixes |

Full docs: [kindlm.com/docs](https://kindlm.com/docs)

## Repository Layout

```
packages/
  core/       @kindlm/core  — Business logic, zero I/O dependencies
  cli/        @kindlm/cli   — CLI entry point
  cloud/      @kindlm/cloud — Cloudflare Workers API + D1 database
docs/         Technical specs and documentation
site/         Landing page + docs (Next.js)
```

## License

MIT (core + CLI) | AGPL (cloud)
