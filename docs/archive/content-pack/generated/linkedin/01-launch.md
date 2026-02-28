# LinkedIn Post: Launch Announcement

---

I'm excited to share what we've been building.

**KindLM is now open source** — a CLI tool for behavioral regression testing of AI agents.

Here's the problem we solve: AI agents don't just generate text. They call tools, make decisions, and produce structured data that feeds into real systems. When an agent breaks, it's rarely because the text quality degraded. It's because it stopped calling the right functions, started leaking PII, or silently dropped a critical step from its workflow.

Traditional eval frameworks measure text quality. KindLM tests behavior.

You define test suites in YAML:
```yaml
assert:
  - type: tool_called
    value: lookup_order
    args:
      order_id: "12345"
  - type: tool_not_called
    value: process_refund
  - type: no_pii
```

11 assertion types cover tool calls, safety guardrails, schema validation, PII detection, LLM-as-judge scoring, baseline drift, latency, and cost. It runs against any major LLM provider and integrates into CI with JUnit XML output and proper exit codes.

The CLI is MIT-licensed and free forever. We believe testing tools should be free.

We also offer KindLM Cloud for teams that need shared dashboards, test history, and compliance report storage — that's how we sustain development. But everything you need to test your agents is in the open-source CLI.

If you're shipping AI agents to production, give it a try:

```
npm i -g @kindlm/cli
```

GitHub: github.com/kindlm/kindlm

Know what your agent will do before your users do.

#AIAgents #OpenSource #Testing #LLM #AITesting
