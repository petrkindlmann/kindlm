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

### `kindlm test <config>`

Executes the test suite and produces reports.

```bash
# Basic usage
kindlm test kindlm.yaml

# With all options
kindlm test kindlm.yaml \
  --project acme-support \
  --upload true \
  --baseline latest \
  --out ./reports/kindlm-report.json \
  --junit ./reports/junit.xml \
  --format pretty \
  --fail-on any \
  --threshold-pass-rate 0.95 \
  --repeat 5 \
  --concurrency 4 \
  --timeout-ms 30000 \
  --tags regression,smoke \
  --models claude-sonnet \
  --compliance \
  --verbose
```

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--project` | string | from config | Project ID for cloud upload routing |
| `--upload` | boolean | false | Upload results to KindLM Cloud |
| `--baseline` | string | — | Baseline run ID or `latest` for active baseline |
| `--out` | string | `kindlm-report.json` | JSON report output path |
| `--junit` | string | — | JUnit XML output path (if set, generates JUnit) |
| `--format` | `pretty\|json` | `pretty` | Terminal output format |
| `--fail-on` | `any\|schema\|pii\|judge\|drift` | `any` | Which gate failures cause exit code 1 |
| `--threshold-pass-rate` | 0..1 | from config | Override pass rate gate |
| `--repeat` | int | from config | Number of repeat runs per test case |
| `--concurrency` | int | from config | Max concurrent provider calls |
| `--timeout-ms` | int | from config | Timeout per provider call |
| `--tags` | string | — | Comma-separated tags to filter test cases |
| `--models` | string | — | Comma-separated model IDs to run (subset) |
| `--compliance` | boolean | from config | Generate compliance report |
| `--verbose` | boolean | false | Show per-assertion details in terminal |
| `--dry-run` | boolean | false | Parse config and print plan, don't execute |
| `--no-color` | boolean | false | Disable ANSI colors (auto-detected in CI) |

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | All gates passed |
| 1 | One or more gates failed |
| 2 | Config invalid |
| 3 | Provider error (auth, network) |
| 4 | Internal error |

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

Authenticate with KindLM Cloud.

```bash
kindlm login
# Opens browser for OAuth flow, or:
kindlm login --token <token>
# Stores token directly
```

Token is stored in `~/.kindlm/credentials.json`.

---

### `kindlm upload <report>`

Upload a previously generated report without re-running tests.

```bash
kindlm upload kindlm-report.json --project acme-support
```

Useful when tests are run in a CI step and upload happens in a separate step.

> **Cloud is optional.** The CLI works fully offline with all features. `login` and `upload` are only needed if you want Cloud dashboard features. Free plan: 1 project, 7-day history. Team ($49/mo): 5 projects, 90 days. Enterprise ($299/mo): unlimited.

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
        run: |
          kindlm test kindlm.yaml \
            --format json \
            --junit junit.xml \
            --compliance \
            --out kindlm-report.json

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: kindlm-reports
          path: |
            kindlm-report.json
            junit.xml
            compliance-reports/

      - name: Publish JUnit results
        if: always()
        uses: mikepenz/action-junit-report@v4
        with:
          report_paths: junit.xml
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
| `KINDLM_CLOUD_TOKEN` | Cloud API token (alternative to `kindlm login`) |
| `KINDLM_CLOUD_URL` | Cloud API URL override |
| `KINDLM_NO_COLOR` | Disable ANSI colors |
| `KINDLM_DEBUG` | Enable debug logging |
| `CI` | Auto-detected; disables interactive features |
