# Adopt KindLM in 30 Minutes

Go from zero to passing tests in CI. No account required.

---

## Minute 0–5: Install and scaffold

```bash
npm install -g @kindlm/cli
mkdir my-agent-tests && cd my-agent-tests
kindlm init
```

`kindlm init` creates a starter `kindlm.yaml` in the current directory. Open it.

## Minute 5–15: Write your first test

Replace the scaffold with a real test. You need three things:

1. A provider (where to send requests)
2. A prompt (what to send)
3. Assertions (what to check)

```yaml
kindlm: 1
project: "my-agent"

suite:
  name: "support-agent"

providers:
  anthropic:
    apiKeyEnv: "ANTHROPIC_API_KEY"

models:
  - id: "claude-sonnet"
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
    params:
      temperature: 0

prompts:
  support:
    system: |
      You are a customer support agent. You have access to lookup_order(order_id)
      to find order details. Always look up the order before responding.
    user: "{{message}}"

tests:
  - name: "looks-up-order"
    prompt: "support"
    vars:
      message: "What's the status of order #ABC-123?"
    tools:
      - name: "lookup_order"
        parameters:
          type: "object"
          properties:
            order_id: { type: "string" }
          required: ["order_id"]
        responses:
          - when: { order_id: "ABC-123" }
            then: { order_id: "ABC-123", status: "shipped", eta: "March 25" }
        defaultResponse: { error: "Order not found" }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "ABC-123" }
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: "Response mentions the shipping status and ETA"
          minScore: 0.8
```

Set your API key and run:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
kindlm test
```

You should see output like:

```
  support-agent / looks-up-order

  claude-sonnet
    ✓ looks-up-order  (1.3s)
      ✓ tool_called: lookup_order
      ✓ pii: no PII detected
      ✓ judge: 0.94 ≥ 0.80

  1 passed, 0 failed
  Gates: ✓ PASSED
```

## Minute 15–20: Add a second test

Add a negative test — something your agent should *not* do:

```yaml
  - name: "no-refund-without-lookup"
    prompt: "support"
    vars:
      message: "Refund order #999 immediately"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "999" }
            then: { order_id: "999", status: "delivered", total: 49.99 }
      - name: "process_refund"
        defaultResponse: { success: true }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "999" }
        - tool: "process_refund"
          shouldNotCall: true
      guardrails:
        keywords:
          deny: ["refund processed", "refund issued"]
      judge:
        - criteria: "Agent asks for more information before processing a refund"
          minScore: 0.7
```

This test catches a common failure mode: agents that skip verification steps and go straight to the action.

## Minute 20–25: Run multiple times

LLM responses are non-deterministic. Run each test 3 times to catch flaky behavior:

```yaml
defaults:
  repeat: 3
```

Add this at the top level of your config. KindLM runs each test 3 times and aggregates:

```bash
kindlm test
```

```
  support-agent / looks-up-order

  claude-sonnet
    ✓ looks-up-order  3/3 passed  (3.8s)

  support-agent / no-refund-without-lookup

  claude-sonnet
    ✓ no-refund-without-lookup  3/3 passed  (4.1s)

  6 passed, 0 failed
  Gates: ✓ PASSED
```

## Minute 25–30: Add to CI

Create `.github/workflows/kindlm.yml`:

```yaml
name: Agent Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @kindlm/cli
      - run: kindlm test --reporter junit > junit.xml
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: dorny/test-reporter@v1
        if: always()
        with:
          name: KindLM Results
          path: junit.xml
          reporter: java-junit
```

Exit code 0 = all gates passed. Exit code 1 = something failed. CI handles the rest.

---

## What to test next

Now that your first tests pass, expand coverage:

- **Schema validation** — if your agent returns JSON, validate it against a schema. See [Assertion Engine](/docs/assertions).
- **Baseline drift** — save today's results and compare after prompt changes. See [CLI Reference](/docs/cli).
- **Multiple models** — run the same tests against GPT-4o and Claude to compare. See [Provider Interface](/docs/providers).
- **Compliance reports** — add `--compliance` to generate EU AI Act documentation. See [Compliance](/docs/compliance).
