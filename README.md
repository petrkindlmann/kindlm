# KindLM

Test AI agents in CI by asserting tool calls, decisions, and structured outputs.
Catch regressions that text evals miss.

![CI](https://github.com/petrkindlmann/kindlm/actions/workflows/ci.yml/badge.svg)

## Demo

<!-- TODO: Record terminal GIF with `vhs` or `asciinema` showing: kindlm test on the basic-tool-call example -->
<!-- Replace this block with: ![KindLM terminal demo](site/public/terminal-demo.gif) -->

See it fail:

```yaml
# kindlm.yaml — the agent should call lookup_order but calls cancel_order instead
expect:
  toolCalls:
    - tool: lookup_order
      argsMatch: { order_id: "12345" }
```

```
kindlm test

  support-agent / looks-up-order

  gpt-4o
    ✗ looks-up-order  (1.1s)
      ✗ tool_called: expected lookup_order, got cancel_order
      ✓ pii: no PII detected

  0 passed, 1 failed — exit 1
```

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
- **Worktree isolation** — run tests in isolated git worktrees with `--isolate`

## Supported Providers

| Provider | Example config |
|----------|---------------|
| OpenAI | `openai:gpt-4o` |
| Anthropic | `anthropic:claude-sonnet-4-5-20250929` |
| Google Gemini | `google:gemini-2.0-flash` |
| Mistral | `mistral:mistral-large-latest` |
| Cohere | `cohere:command-r-plus` |
| Ollama | `ollama:llama3` |
| MCP | `mcp:http://localhost:8080` |

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
- run: kindlm test --reporter junit --concurrency 4 --timeout 30000 > junit.xml
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
  dashboard/  — Cloud dashboard UI (Next.js + Tailwind)
  vscode/     — VS Code extension (YAML intellisense)
docs/         Technical specs and documentation
site/         Landing page + docs (Next.js)
```

## Examples

| File | What it tests |
|------|---------------|
| [basic-tool-call.yaml](examples/basic-tool-call.yaml) | Agent calls the right tool with correct arguments |
| [pii-guardrail.yaml](examples/pii-guardrail.yaml) | No PII leaked in responses |
| [escalation-handling.yaml](examples/escalation-handling.yaml) | Agent escalates to human when asked |
| [github-action.yml](examples/github-action.yml) | CI workflow template |

## License

MIT (core + CLI) | AGPL (cloud)
