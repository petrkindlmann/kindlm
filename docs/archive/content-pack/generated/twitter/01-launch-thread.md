# Twitter Thread: Launch Announcement

---

**Tweet 1 (Hook)**

Your AI agent broke in production last week.

You just don't know it yet.

It's still responding. Still sounding helpful. But it stopped calling the right tools three deploys ago.

We built something to fix this. Thread:

---

**Tweet 2 (What KindLM does)**

Introducing KindLM — open-source behavioral regression tests for AI agents.

It tests what your agent DOES (tool calls, decisions, structured output), not just what it SAYS.

One YAML config. Any LLM provider. Runs in CI.

```
npm i -g @kindlm/cli
```

---

**Tweet 3 (YAML example)**

Here's what a test looks like:

```yaml
tests:
  - name: "refund-flow"
    input: "Return order #12345"
    assert:
      - type: tool_called
        value: lookup_order
        args:
          order_id: "12345"
      - type: tool_not_called
        value: process_refund
      - type: no_pii
```

Readable. Declarative. Catches what eval frameworks miss.

---

**Tweet 4 (Assertion types)**

11 assertion types that cover the full behavioral surface:

- tool_called / tool_not_called / tool_order
- schema (JSON Schema validation)
- judge (LLM-as-judge)
- no_pii (SSN, CC, email, phone, IBAN)
- keywords_present / keywords_absent
- drift (baseline comparison)
- latency / cost

All in one test file.

---

**Tweet 5 (Multi-model)**

Write tests once. Run against any provider:

```bash
kindlm test --provider openai:gpt-4o
kindlm test --provider anthropic:claude-sonnet-4-5-20250929
kindlm test --provider google:gemini-2.0-flash
kindlm test --provider ollama:llama3.1
```

Same assertions. Different models. Empirical comparison instead of vibes.

---

**Tweet 6 (Compliance)**

The EU AI Act requires documented testing evidence for high-risk AI systems by August 2026.

KindLM generates Annex IV compliance reports from your test results:

```bash
kindlm test --compliance
```

Every test you run today is compliance documentation you won't need to create later.

---

**Tweet 7 (CTA)**

KindLM is MIT-licensed and free forever.

Install it. Write your first test. Know what your agent will do before your users do.

GitHub: github.com/kindlm/kindlm
Docs: docs.kindlm.com

Star the repo if this is useful. We're just getting started.
