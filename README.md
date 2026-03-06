# KindLM

![CI](https://github.com/petr-kin/kindlm/actions/workflows/ci.yml/badge.svg)

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
| Ollama | `ollama:llama3` |
| Google Gemini | `google:gemini-2.0-flash` |
| AWS Bedrock | `bedrock:anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Azure OpenAI | `azure:my-gpt4o-deployment` |

## Quick Start

```bash
npm install -g @kindlm/cli
kindlm init
```

Edit the generated `kindlm.yaml`:

```yaml
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 3

suites:
  - name: refund-agent
    system_prompt: "You are a refund support agent."
    tests:
      - name: looks-up-order
        input: "I want to return order #12345"
        assert:
          - type: tool_called
            value: lookup_order
          - type: no_pii
          - type: judge
            criteria: "Response is empathetic and professional"
            threshold: 0.8
```

Run your tests:

```bash
kindlm test
```

Output:

```
refund-agent
  ✓ looks-up-order (3/3 runs passed)
    ✓ tool_called: lookup_order
    ✓ no_pii
    ✓ judge: 0.92 ≥ 0.8

1 suite, 1 test, 3 assertions — all passed
```

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
