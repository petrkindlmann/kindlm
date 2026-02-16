# KindLM

Regression testing and compliance guardrails for agentic AI workflows.

```bash
npm install -g @kindlm/cli
kindlm init
kindlm test kindlm.yaml
```

---

## What KindLM Does

KindLM is a CLI tool that runs test suites against your LLM-powered features and agents. Define test cases in YAML, run them locally or in CI, and get clear pass/fail results with actionable failure reasons.

**What makes it different:**

- **Agent-aware** — assert on tool calls (which tool was called, with what arguments, in what order), not just text output
- **LLM-as-judge** — evaluate subjective quality ("is this response empathetic?") using configurable judge models
- **Compliance reports** — generate EU AI Act–aligned test documentation for auditors
- **CI-native** — exit codes, JUnit XML, JSON reports. Drop it into your pipeline in 5 minutes

## Quick Example

```yaml
# kindlm.yaml
kindlm: 1
project: "my-agent"

providers:
  anthropic:
    apiKeyEnv: "ANTHROPIC_API_KEY"

models:
  - id: "claude-sonnet"
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
    params:
      temperature: 0.2

prompts:
  support:
    system: |
      You are a support agent. Use lookup_order(order_id) to find orders.
      Respond in JSON with { "action": string, "message": string }.
    user: "{{message}}"

tests:
  - name: "refund-request"
    prompt: "support"
    vars:
      message: "Refund order #123 please"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "123" }
            then: { order_id: "123", total: 49.99, status: "delivered" }
    expect:
      output:
        format: "json"
        schemaFile: "./schemas/response.schema.json"
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "123" }
      guardrails:
        pii:
          enabled: true
        keywords:
          deny: ["not my problem"]
      judge:
        - criteria: "Response acknowledges the refund request professionally"
          minScore: 0.8

gates:
  passRateMin: 0.95
  schemaFailuresMax: 0
```

```bash
$ kindlm test kindlm.yaml

  ✓ refund-request (claude-sonnet) 3/3 passed [1.2s]

  Pass rate: 100% | Schema: 0 failures | Judge avg: 0.92
  Gates: ✓ PASSED
```

## Features

### Assertions

| Type | What It Checks |
|------|----------------|
| **Schema** | JSON parse + JSON Schema validation (AJV) |
| **PII** | Regex patterns for SSN, credit cards, emails, custom |
| **Keywords** | Deny list (forbidden words) + allow list |
| **Judge** | LLM evaluates output against natural language criteria |
| **Tool calls** | Correct tool, correct arguments, correct order, shouldNotCall |
| **Drift** | Compare output against a baseline (LLM judge or field diff) |
| **Contains** | Output must/must not contain specific substrings |

### Reports

- **Terminal** — colored summary with top failures
- **JSON** — full structured report for programmatic use
- **JUnit XML** — plug into any CI system's test reporting
- **Compliance** — EU AI Act–aligned markdown report with audit hashes

### Agent Testing

KindLM simulates tool responses so you can test agent behavior without calling real APIs:

```yaml
tools:
  - name: "lookup_order"
    responses:
      - when: { order_id: "123" }
        then: { order_id: "123", total: 49.99 }
    defaultResponse: { error: "Order not found" }
```

The engine runs a multi-turn conversation: sends the prompt, intercepts tool calls, returns simulated responses, and continues until the model produces a final text response. Then all assertions run against the full conversation.

### Baseline Drift Detection

```bash
# Save a baseline
kindlm baseline set kindlm-report.json --label "v2.0-release"

# Future runs compare against it
kindlm test kindlm.yaml --baseline latest
```

Drift is measured using LLM-as-judge comparison by default — it understands semantic changes, not just string differences.

### Compliance Reports

```yaml
compliance:
  enabled: true
  framework: "eu-ai-act"
  outputDir: "./compliance-reports"
  metadata:
    systemName: "Customer Support Agent"
    riskLevel: "limited"
    operator: "ACME Corp"
```

Generates a structured markdown document mapping test results to EU AI Act Annex IV requirements, with SHA-256 artifact hashes for audit trail.

## CI Integration

```yaml
# GitHub Actions
- run: kindlm test kindlm.yaml --junit junit.xml --format json
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Exit code 0 = all gates passed. Exit code 1 = gates failed. That's it.

## Cloud (Optional)

Upload results to KindLM Cloud for history, trends, and team collaboration:

```bash
kindlm login
kindlm test kindlm.yaml --upload true
```

The CLI works fully offline with every feature. Cloud is optional and adds:

| | Open Source (Free) | Team ($49/mo) | Enterprise ($299/mo) |
|-|-------------------|---------------|---------------------|
| CLI (all assertions, providers, reports) | ✓ | ✓ | ✓ |
| Compliance reports (local markdown) | ✓ | ✓ | ✓ |
| Cloud dashboard + test history | — | 90 days | Unlimited |
| Team members | — | 10 | Unlimited |
| Compliance PDF export | — | ✓ | ✓ |
| Signed compliance reports | — | — | ✓ |
| SSO / SAML | — | — | ✓ |
| Audit log API | — | — | ✓ |
| Slack + webhook alerts | — | ✓ | ✓ |

> **Philosophy:** The open-source CLI solves the engineering problem. Cloud solves the organizational problem. Engineers choose the tool. Their company pays for the dashboard.

## Documentation

| Document | Description |
|----------|-------------|
| [Config Reference](docs/config-reference.md) | Complete YAML config schema |
| [Assertions](docs/assertions.md) | All assertion types with examples |
| [Providers](docs/providers.md) | Provider adapter setup |
| [CI Integration](docs/ci-integration.md) | GitHub Actions, GitLab CI, Jenkins |
| [Compliance](docs/compliance.md) | EU AI Act report generation |
| [Cloud](docs/cloud.md) | Cloud API and dashboard |

## License

MIT
