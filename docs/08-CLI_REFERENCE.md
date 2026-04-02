# KindLM CLI Reference

## Installation

```bash
npm install -g @kindlm/cli

# Or use npx (no install)
npx @kindlm/cli test kindlm.yaml
```

---

## Commands

### `kindlm init`

Scaffolds a new KindLM project in the current directory.

```bash
kindlm init
kindlm init --template agent     # agent-focused template
kindlm init --template basic     # simple prompt test template
kindlm init --template compliance # EU AI Act compliance template
```

**Templates:**
- `basic` — minimal config with a single prompt test and judge assertion
- `agent` — tool-calling agent with simulated tools, tool call assertions, and PII guardrails
- `compliance` — includes the `compliance:` section with EU AI Act metadata fields pre-filled

**Creates:**
```
kindlm.yaml               # Config file
schemas/                   # JSON schema directory
  example.schema.json      # Example output schema
.kindlm/                  # Local data directory (gitignored)
  baselines/               # Baseline snapshots
```

**Exit codes:** 0 success, 1 write error

---

### `kindlm validate <config>`

Validates a config file without executing any tests or calling any providers.

```bash
kindlm validate kindlm.yaml
kindlm validate ./path/to/config.yaml
```

**Validates:**
- YAML syntax
- Zod schema compliance
- Cross-reference integrity (prompt refs, model refs, provider refs)
- Schema file existence (checks paths resolve)
- Variable completeness (all `{{vars}}` in prompts have matching test vars)

**Exit codes:** 0 valid, 1 invalid (prints errors to stderr)

---

### `kindlm test`

Executes the test suite and produces reports. After running, test results are cached to `.kindlm/last-run.json` so they can be uploaded to KindLM Cloud via `kindlm upload` without re-running.

```bash
# Basic usage
kindlm test

# With options
kindlm test \
  -c kindlm.yaml \
  -s my-suite \
  --reporter pretty \
  --runs 5 \
  --gate 95 \
  --compliance
```

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c, --config` | string | `kindlm.yaml` | Path to config file |
| `-s, --suite` | string | — | Run a specific suite |
| `--reporter` | `pretty\|json\|junit` | `pretty` | Output format |
| `--runs` | int | from config | Override repeat run count |
| `--gate` | number | from config | Fail if pass rate below threshold (percent) |
| `--compliance` | boolean | false | Generate EU AI Act compliance report |
| `--pdf <path>` | string | — | Export compliance report as PDF (requires `--compliance`) |
| `--isolate` | boolean | false | Run in an isolated git worktree (v2.0.0) |
| `--concurrency <n>` | int | from config | Override `defaults.concurrency`; must be ≥ 1 (v2.1.0) |
| `--timeout <ms>` | int | from config | Override `defaults.timeoutMs`; must be ≥ 0 (v2.1.0) |

**`--isolate`** (v2.0.0): Creates a temporary git worktree, copies the config file and any referenced schema files into it, runs the test suite there, then removes the worktree on completion or error (fail-closed). Requires git to be available. If git is not installed or the current directory is not a git repository, the flag is silently ignored and tests run normally.

**`--concurrency <n>`** (v2.1.0): Overrides `defaults.concurrency` from the config file. Must be an integer ≥ 1 — exits with code 1 and an error message otherwise. Does not affect provider HTTP timeouts.

**`--timeout <ms>`** (v2.1.0): Overrides `defaults.timeoutMs` from the config file. Must be ≥ 0 — exits with code 1 and an error message otherwise. Controls test execution timeout only; provider HTTP connection/response timeouts are separate.

**Note:** The config schema supports a `tags` field on test cases and the `--runs` CLI flag overrides the `defaults.repeat` config value. The flag is named `--runs` (not `--repeat`) for brevity.

**Command tests:** Tests can use `command:` instead of `prompt:` to run shell commands and assert on their output. Command tests run once per repeat (not multiplied by models). See [10-COMMAND-TESTS.md](./10-COMMAND-TESTS.md) for details.

**Exit codes:** 0 = all gates passed, 1 = failure or gates failed

---

### `kindlm trace`

Ingests OpenTelemetry traces and runs assertions against them. Use this to test real agent executions by collecting their OTLP trace data.

```bash
# Listen for traces on default port, run assertions from config
kindlm trace

# Spawn a command and collect its traces
kindlm trace --command "python run_agent.py"

# Custom port and timeout
kindlm trace --port 9318 --timeout 60000
```

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c, --config` | string | `kindlm.yaml` | Path to config file |
| `--port` | int | `4318` | OTLP HTTP listener port |
| `--command` | string | — | Command to spawn (traces collected while it runs) |
| `--timeout` | int | `30000` | Timeout in ms to wait for traces |
| `--reporter` | `pretty\|json\|junit` | `pretty` | Output format |

**How it works:**
1. Starts an OTLP/HTTP listener on `POST /v1/traces`
2. Optionally spawns a command with `OTEL_EXPORTER_OTLP_ENDPOINT` set
3. Collects spans, filters by config, maps to assertion context
4. Evaluates assertions from config against the trace data
5. Reports results and exits with code 0 (pass) or 1 (fail)

**Trace config in kindlm.yaml:**
```yaml
trace:
  port: 4318
  timeoutMs: 30000
  spanMapping:
    outputTextAttr: gen_ai.completion.0.content
    modelAttr: gen_ai.response.model
    inputTokensAttr: gen_ai.usage.input_tokens
    outputTokensAttr: gen_ai.usage.output_tokens
  spanFilter:
    namePattern: "^chat\\."
    minDurationMs: 100
```

**Exit codes:** 0 = all assertions passed, 1 = any assertion failed

---

### `kindlm baseline <subcommand>`

Manage local baselines.

```bash
# Save current report as a baseline
kindlm baseline set kindlm-report.json --label "v2.1-release"

# List baselines
kindlm baseline list

# Compare a report against a baseline
kindlm baseline compare kindlm-report.json --baseline "v2.1-release"

# Remove a baseline
kindlm baseline remove "v2.1-release"
```

Baselines are stored in `.kindlm/baselines/` as JSON snapshots. Each baseline contains the output text per test case (for drift comparison) and the summary metrics (for delta reporting).

---

### `kindlm login`

Authenticate with KindLM Cloud. Create an API token in the Cloud dashboard, then paste it here.

```bash
# Interactive: prompts for token paste
kindlm login

# Non-interactive: pass token directly
kindlm login --token klm_abc123

# Check current auth status
kindlm login --status

# Remove stored credentials
kindlm login --logout
```

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `-t, --token` | string | API token (skips interactive prompt) |
| `--status` | boolean | Show current authentication status |
| `--logout` | boolean | Remove stored credentials |

Token is stored in `~/.kindlm/credentials` (file permissions 600). The `KINDLM_API_TOKEN` environment variable can also be used as an alternative to stored credentials.

---

### `kindlm upload`

Upload the last test run to KindLM Cloud. Reads cached results from `.kindlm/last-run.json` (written automatically by `kindlm test`).

```bash
# Upload with auto-detected project name (from git remote)
kindlm upload

# Specify project name explicitly
kindlm upload --project acme-support

# Use a specific token (overrides stored credentials)
kindlm upload --token klm_abc123
```

**Flags:**

| Flag | Type | Description |
|------|------|-------------|
| `-t, --token` | string | API token (overrides stored/env token) |
| `-p, --project` | string | Project name (defaults to git remote name or cwd basename) |

**How it works:** The upload command finds or creates the project and suite in Cloud, creates a run, batch-inserts all test results, and finalizes the run with aggregated metrics. Git commit SHA, branch, and CI environment are auto-detected.

Useful when tests are run in a CI step and upload happens in a separate step.

> **Cloud is optional.** The CLI works fully offline with all features. `login` and `upload` are only needed if you want Cloud dashboard features. Free plan: 1 project, 7-day history. Team ($49/mo): 5 projects, 90 days. Enterprise ($299/mo): unlimited.

---

## Feature Flags

Local feature flags are read from `.kindlm/config.json` at startup. This file is optional — if absent, all flags default to `false`.

```json
{
  "features": {
    "betaJudge": true,
    "costGating": true,
    "runArtifacts": true
  }
}
```

| Flag | Default | Description |
|------|---------|-------------|
| `betaJudge` | false | Enables 3-pass median judge scoring. Failed/errored passes are excluded. Requires ceil(N/2) successful passes to produce a score; falls back to single-pass if insufficient passes succeed. |
| `costGating` | false | Controls whether the `gates.costMaxUsd` field in your config is enforced by the test runner. When disabled, cost assertions still run but the gate does not fail the suite. |
| `runArtifacts` | false | When enabled, saves full test run artifacts (raw responses, assertion details) to `.kindlm/runs/{runId}/{executionId}/` after each run. Directory is append-only — artifacts are never overwritten. |

The `.kindlm/` directory is gitignored by default. Commit `.kindlm/config.json` deliberately if you want feature flags checked into source control.

---

## Terminal Output (Pretty Format)

```
┌─────────────────────────────────────────────────────┐
│  KindLM v0.1.0                                       │
│  Suite: support-agent-regression                      │
│  Config: a1b2c3d4e5f6                                │
│  Models: claude-sonnet, gpt-4o                       │
│  Tests: 4 × 2 models × 3 repeats = 24 executions    │
└─────────────────────────────────────────────────────┘

Running tests...

  ✓ refund-double-charge (claude-sonnet) 3/3 passed [1.2s]
  ✓ refund-double-charge (gpt-4o)       3/3 passed [0.9s]
  ✓ refund-order-not-found (claude-sonnet) 3/3 passed [1.1s]
  ✗ refund-order-not-found (gpt-4o)     2/3 passed [1.0s]
      Run 2: TOOL_CALL_MISSING — Expected "lookup_order" was never called
  ✓ escalation-legal-threat (claude-sonnet) 3/3 passed [1.3s]
  ✓ escalation-legal-threat (gpt-4o)    3/3 passed [1.1s]
  ✓ greeting-response (claude-sonnet)   3/3 passed [0.5s]
  ✓ greeting-response (gpt-4o)          3/3 passed [0.4s]

┌─────────────────────────────────────────────────────┐
│  Summary                                             │
├─────────────┬────────────────────────────────────────┤
│ Pass rate   │ 87.5% (7/8 aggregated)                 │
│ Schema      │ 0 failures                             │
│ PII         │ 0 failures                             │
│ Judge avg   │ 0.89                                   │
│ Drift       │ 0.04                                   │
│ Cost        │ $0.12                                  │
│ Latency     │ 940ms avg                              │
├─────────────┼────────────────────────────────────────┤
│ Gates       │ ✗ FAILED                               │
│             │ ✗ passRateMin: 87.5% < 95.0%           │
│             │ ✓ schemaFailuresMax: 0 ≤ 0             │
│             │ ✓ piiFailuresMax: 0 ≤ 0                │
│             │ ✓ judgeAvgMin: 89.0% ≥ 80.0%           │
│             │ ✓ driftScoreMax: 0.04 ≤ 0.15           │
└─────────────┴────────────────────────────────────────┘

Top failures:
  1. refund-order-not-found (gpt-4o) — TOOL_CALL_MISSING

Report: kindlm-report.json
Compliance: ./compliance-reports/kindlm-compliance-a1b2c3d4-2026-02-15.md
Exit code: 1 (gates failed)
```

---

## JUnit XML Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="support-agent-regression" tests="8" failures="1" time="8.5">
  <testsuite name="claude-sonnet" tests="4" failures="0" time="4.1">
    <testcase name="refund-double-charge" classname="support-agent-regression.claude-sonnet" time="1.2"/>
    <testcase name="refund-order-not-found" classname="support-agent-regression.claude-sonnet" time="1.1"/>
    <testcase name="escalation-legal-threat" classname="support-agent-regression.claude-sonnet" time="1.3"/>
    <testcase name="greeting-response" classname="support-agent-regression.claude-sonnet" time="0.5"/>
  </testsuite>
  <testsuite name="gpt-4o" tests="4" failures="1" time="3.4">
    <testcase name="refund-double-charge" classname="support-agent-regression.gpt-4o" time="0.9"/>
    <testcase name="refund-order-not-found" classname="support-agent-regression.gpt-4o" time="1.0">
      <failure type="TOOL_CALL_MISSING" message="Expected tool &quot;lookup_order&quot; was never called">
Pass rate: 2/3 (66.7%)
Run 2: TOOL_CALL_MISSING — Expected "lookup_order" was never called. Called: issue_refund
      </failure>
    </testcase>
    <testcase name="escalation-legal-threat" classname="support-agent-regression.gpt-4o" time="1.1"/>
    <testcase name="greeting-response" classname="support-agent-regression.gpt-4o" time="0.4"/>
  </testsuite>
</testsuites>
```

---

## CI Integration Examples

### GitHub Actions

```yaml
name: KindLM Regression Tests
on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'kindlm.yaml'
      - 'schemas/**'

jobs:
  kindlm-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install -g @kindlm/cli

      - name: Run KindLM tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: kindlm test --reporter json --compliance

      - name: Upload to KindLM Cloud
        if: always()
        env:
          KINDLM_API_TOKEN: ${{ secrets.KINDLM_API_TOKEN }}
        run: kindlm upload --project my-project
```

### GitLab CI

```yaml
kindlm-test:
  stage: test
  image: node:20
  variables:
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
    OPENAI_API_KEY: $OPENAI_API_KEY
  script:
    - npm install -g @kindlm/cli
    - kindlm test kindlm.yaml --format json --junit junit.xml --out kindlm-report.json
  artifacts:
    reports:
      junit: junit.xml
    paths:
      - kindlm-report.json
      - compliance-reports/
    when: always
  rules:
    - changes:
        - prompts/**
        - kindlm.yaml
        - schemas/**
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `MISTRAL_API_KEY` | Mistral API key |
| `CO_API_KEY` | Cohere API key |
| `KINDLM_API_TOKEN` | Cloud API token (alternative to `kindlm login`) |
| `KINDLM_CLOUD_URL` | Cloud API URL override (default: `https://api.kindlm.com`) |
| `KINDLM_NO_COLOR` | Disable ANSI colors |
| `KINDLM_DEBUG` | Enable debug logging |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Auto-set when using `kindlm trace --command` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Auto-set to `http/json` by trace command |
| `CI` | Auto-detected; disables interactive features |

---

## Google Gemini

KindLM supports Google Gemini models via the Generative Language API.

### Configuration

```yaml
providers:
  gemini:
    apiKeyEnv: GOOGLE_API_KEY

models:
  - id: gemini-2.0-flash
    provider: gemini
    model: gemini-2.0-flash
    params:
      temperature: 0
      maxTokens: 2048
```

### Notes

- **API key**: Get one at https://aistudio.google.com/apikey
- **Cost tracking**: Pricing table included for Gemini 2.0 Flash, 1.5 Pro, 1.5 Flash variants
- **Tool support**: Full function calling support
- **System prompts**: Supported via Gemini's `systemInstruction` field

---

## Mistral

KindLM supports Mistral models via the Mistral API (OpenAI-compatible format).

### Configuration

```yaml
providers:
  mistral:
    apiKeyEnv: MISTRAL_API_KEY

models:
  - id: mistral-large
    provider: mistral
    model: mistral-large-latest
    params:
      temperature: 0
      maxTokens: 2048
```

### Notes

- **API key**: Get one at https://console.mistral.ai/
- **Cost tracking**: Not available (returns null)
- **Tool support**: Full function calling support

---

## Cohere

KindLM supports Cohere models via the v2 Chat API.

### Configuration

```yaml
providers:
  cohere:
    apiKeyEnv: CO_API_KEY

models:
  - id: command-r-plus
    provider: cohere
    model: command-r-plus
    params:
      temperature: 0
      maxTokens: 2048
```

### Notes

- **API key**: Get one at https://dashboard.cohere.com/
- **Cost tracking**: Not available (returns null)
- **Tool support**: Full function calling support
- **Parameter naming**: `topP` is automatically mapped to Cohere's `p` parameter

---

## Ollama (Local Models)

KindLM supports Ollama for running tests against local open-source models with zero API cost.

### Configuration

```yaml
providers:
  ollama:
    # No apiKeyEnv needed — Ollama runs locally
    # baseUrl: http://localhost:11434   # default

models:
  - id: llama3.2
    provider: ollama
    model: llama3.2
    params:
      temperature: 0
      maxTokens: 2048
  - id: mistral
    provider: ollama
    model: mistral
    params:
      temperature: 0
```

### Usage

```bash
# Ensure Ollama is running
ollama serve

# Pull the model if not already downloaded
ollama pull llama3.2

# Run tests (no API key needed)
kindlm test -c kindlm.yaml
```

### Notes

- **No API key required**: The `apiKeyEnv` field is optional for Ollama
- **Cost**: Always reported as $0.00 (local inference)
- **Tool support**: Ollama supports tool calling for compatible models
- **Custom server**: Use `baseUrl` to point to a remote Ollama instance
- **Mixed providers**: You can test the same prompts against both cloud and local models:

```yaml
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
  ollama: {}

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
  - id: llama3.2
    provider: ollama
    model: llama3.2
```
