# KindLM

**Behavioral CI tests for AI agents, with compliance evidence built in.**

KindLM tests the decisions your agent actually makes: which tools it calls, which arguments it passes, what structured output it returns, whether it leaks PII, and whether it stays within latency and cost budgets.

Mock tool responses make tests deterministic enough for CI. Failed expectations return exit code 1, JUnit XML, and GitHub Actions-friendly output.

No SDK required. No hosted backend required. Works with OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, Azure OpenAI, and OpenAI-compatible HTTP endpoints.

Optional: generate an EU AI Act Annex IV documentation draft from the same test run. This is a starting point for technical documentation, **not legal advice and not a conformity assessment**.

![CI](https://github.com/petrkindlmann/kindlm/actions/workflows/ci.yml/badge.svg)

## See it fail

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

## Why not promptfoo?

Use [promptfoo](https://promptfoo.dev) when you want a broad AI security and eval platform with a large ecosystem.

Use KindLM when you want a small, provider-neutral CI gate focused on agent behavior: mocked tool calls, pass/fail regression tests, PII/cost/drift gates, JUnit output, and optional compliance evidence without adopting a hosted trace platform or instrumenting your app with an SDK.

## Features

- **Tool call assertions** — verify agents call the right tools with the right arguments, in the right order
- **Schema validation** — structured output checked against JSON Schema (AJV)
- **PII detection** — named, configurable detectors: `ssn`, `credit_card` (Luhn-checked), `email`, `phone` (US + E.164), `iban` (mod-97-checked), `ip`, `jwt`, `api_key` (AKIA/sk-/ghp_/xox)
- **LLM-as-judge** — score responses against natural-language criteria (0.0–1.0)
- **Drift detection** — field-level baseline comparison, plus semantic drift with embeddings where supported (OpenAI embeddings are supported today)
- **Keyword guards** — require or forbid specific phrases in output
- **Latency & cost budgets** — fail tests that exceed time thresholds, or cost thresholds for priced models (OpenAI, Anthropic, Gemini; Mistral/Cohere/HTTP have no pricing yet)
- **EU AI Act documentation draft** — map test/gate results to selected EU AI Act articles. A starting point, **not legal advice** and not a conformity assessment
- **CI-native** — exit code 0/1, JUnit XML reporter, GitHub Actions ready
- **Worktree isolation** — run tests in isolated git worktrees with `--isolate`

## Supported Providers

Configure providers under `providers:` and reference them by key from `models:` (see Quick Start). The `provider:` key is one of:

| Provider | `provider:` key | Example model |
|----------|-----------------|---------------|
| OpenAI | `openai` | `gpt-4o` |
| Anthropic | `anthropic` | `claude-sonnet-4-5-20250929` |
| Google Gemini | `gemini` | `gemini-2.0-flash` |
| Mistral | `mistral` | `mistral-large-latest` |
| Cohere | `cohere` | `command-r-plus` |
| Ollama | `ollama` | `llama3` |
| HTTP | `http` | any OpenAI-compatible endpoint |
| MCP | `mcp` | passthrough to an MCP-style tool server |

Azure OpenAI works via the `openai` provider with a custom `baseUrl`. AWS Bedrock is not yet supported.

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

`kindlm init` scaffolds a tool-call test by default. Pick a different starter with `--template`:

```bash
kindlm init --template tool-calls   # default: assert a tool call + args (deterministic mock)
kindlm init --template pii          # assert no PII leaks
kindlm init --template structured   # assert JSON output against a schema
kindlm init --template compliance   # tool-call test wired for `kindlm test --compliance`
```

The generated `kindlm.yaml` (default `tool-calls` template):

```yaml
kindlm: 1
project: my-agent

suite:
  name: support-agent
  description: Behavioral tests for my AI agent

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
  support:
    system: "You are a support agent. Use lookup_order(order_id) to find orders."
    user: "{{message}}"

tests:
  - name: looks-up-order
    prompt: support
    vars:
      message: "Where is order #12345?"
    # Mock the tool so the test is deterministic and costs one model call.
    tools:
      - name: lookup_order
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: shipped }
        defaultResponse: { status: not_found }
    expect:
      toolCalls:
        - tool: lookup_order
          argsMatch: { order_id: "12345" }
      guardrails:
        pii:
          # Optional: select named built-in detectors.
          # credit_card is Luhn-checked, iban is mod-97-checked.
          enabled: true
      judge:
        - criteria: "Response is helpful and mentions shipping status"
          minScore: 0.8

gates:
  passRateMin: 0.95

defaults:
  repeat: 1
  concurrency: 4
  timeoutMs: 60000
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

## Also included

Beyond `init` and `test`, the CLI ships:

- **`kindlm baseline set|compare|list`** — save known-good results and detect drift over time
- **`kindlm trace`** — ingest OpenTelemetry (OTLP) traces and run assertions against captured agent runs
- **`kindlm redteam init|generate|run`** — generate and run adversarial safety checks against common agent failure modes
- **`kindlm test --watch`** — rerun tests while you edit prompts and configs
- **`kindlm validate`** — check a config without making any provider calls
- **`kindlm login` / `kindlm upload`** — push runs to KindLM Cloud for history and compliance storage

Run `kindlm <command> --help` for flags.

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
