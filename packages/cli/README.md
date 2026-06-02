# KindLM

![CI](https://github.com/petrkindlmann/kindlm/actions/workflows/ci.yml/badge.svg)

**Behavioral CI tests for AI agents, with compliance evidence built in.**

KindLM tests the decisions your agent actually makes: which tools it calls, which arguments it passes, what structured output it returns, whether it leaks PII, and whether it stays within latency and cost budgets. Mock tool responses make tests deterministic enough for CI; failed expectations return exit code 1, JUnit XML, and GitHub Actions-friendly output. No SDK and no hosted backend required. Optionally generate an EU AI Act Annex IV documentation draft from the same run (not legal advice, not a conformity assessment).

## Why not promptfoo?

Use [promptfoo](https://promptfoo.dev) when you want a broad AI security and eval platform with a large ecosystem. Use KindLM when you want a small, provider-neutral CI gate focused on agent behavior: mocked tool calls, pass/fail regression tests, PII/cost/drift gates, JUnit output, and optional compliance evidence without adopting a hosted trace platform or instrumenting your app with an SDK.

## Features

- **Tool call assertions** — verify agents call the right tools with the right arguments, in the right order
- **Schema validation** — structured output checked against JSON Schema (AJV)
- **PII detection** — a guardrail (not a full DLP system). Default detection covers SSN, credit card, and email; phone, IBAN, IP, JWT, and API-key detectors are available via opt-in `detectors: [...]`
- **LLM-as-judge** — score responses against natural-language criteria (0.0–1.0). Results are probabilistic; use repeated runs for critical gates
- **Drift detection** — field-level baseline comparison, plus semantic drift with embeddings where supported (OpenAI embeddings are supported today)
- **Keyword guards** — require or forbid specific phrases in output
- **Latency & cost budgets** — fail tests that exceed time thresholds, or cost thresholds for priced models (OpenAI, Anthropic, Gemini)
- **EU AI Act documentation draft** — map test/gate results to selected EU AI Act articles. A starting-point document, **not legal advice** and not a conformity assessment
- **CI-native** — exit code 0/1, JUnit XML reporter, GitHub Actions ready

## Supported Providers

Providers are configured under `providers:` and referenced by key from each entry in `models:` (see the Quick Start below). The `provider:` key is one of:

| Provider | `provider:` key | Example model | Notes |
|----------|-----------------|---------------|-------|
| OpenAI | `openai` | `gpt-4o` | Azure OpenAI works via `openai` + a custom `baseUrl` |
| Anthropic | `anthropic` | `claude-sonnet-4-5-20250929` | |
| Google Gemini | `gemini` | `gemini-2.0-flash` | key is `gemini`, not `google` |
| Mistral | `mistral` | `mistral-large-latest` | no cost estimation yet |
| Cohere | `cohere` | `command-r-plus` | no cost estimation yet |
| Ollama | `ollama` | `llama3` | local; no cost |
| HTTP | `http` | any | generic OpenAI-compatible endpoint |
| MCP | `mcp` | — | passthrough HTTP POST to an MCP-style tool server |

**Not yet supported:** AWS Bedrock, and a first-class Azure adapter (use `openai` + `baseUrl` for Azure).

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

`kindlm init` scaffolds a tool-call test by default. Use `--template pii`, `--template structured`, or `--template compliance` for other starters.

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
| `--reporter <type>` | Output format: `pretty` (default), `json`, `junit`. Report is written to stdout — redirect to a file with `> report.xml` | v1.0.0 |
| `--compliance` | Generate the EU AI Act documentation draft (not legal advice) | v1.0.0 |
| `--pdf <path>` | Export the compliance draft as PDF (requires `--compliance`) | v1.0.0 |
| `-s, --suite <name>` | Assert the configured suite matches this name (a config has one suite) | v1.0.0 |
| `--runs <count>` | Override the `repeat` count from config | v1.0.0 |
| `--gate <percent>` | Fail if suite pass rate falls below threshold (0–100) | v1.0.0 |
| `-c, --config <path>` | Path to config file (default `kindlm.yaml`) | v2.1.0 |
| `--dry-run` | Validate config and print the test plan without executing | v2.1.0 |
| `--watch` | Re-run tests when `kindlm.yaml` changes | v2.1.0 |
| `--no-cache` | Disable response caching | v2.1.0 |
| `--isolate` | Copy the config + referenced schema files into a detached-HEAD git worktree and run there (requires git). This isolates the **config**, not your agent code or `node_modules`. | v2.0.0 |
| `--concurrency <n>` | Override the concurrency setting from config (≥ 1) | v2.1.0 |
| `--timeout <ms>` | Override the per-test timeout in ms (does not affect provider HTTP timeout) | v2.1.0 |

Reports go to stdout; redirect with `>` to write a file (there is no `--output` flag).

## Other Commands

| Command | Description |
|---------|-------------|
| `kindlm init` | Scaffold a `kindlm.yaml` |
| `kindlm validate` | Validate config without running |
| `kindlm baseline set\|compare\|list` | Manage drift baselines |
| `kindlm trace` | Ingest OTLP traces and run assertions |
| `kindlm cache` | Inspect or clear the response cache |
| `kindlm redteam` | Run adversarial red-team suites (experimental) |
| `kindlm login` / `kindlm upload` | KindLM Cloud auth and run upload |

## CI Integration

```yaml
# .github/workflows/test.yml
- run: npm install -g @kindlm/cli
- run: kindlm test --reporter junit > results.xml
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

Full docs: [kindlm.com/docs](https://kindlm.com/docs) | Source: [`docs/`](./docs/)

## License

MIT (core + CLI) | AGPL (cloud)
