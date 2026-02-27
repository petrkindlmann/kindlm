# Why We Built KindLM

*Testing AI agents shouldn't require a leap of faith.*

---

It was a Friday afternoon — the kind where you push one last deploy before the weekend because everything looks good in staging. Our refund agent had been working flawlessly for weeks. Customers would say "I want to return order #12345," and the agent would look up the order, verify eligibility, and walk them through the return process. Clean, reliable, predictable.

We'd updated the system prompt that morning. A small tweak to make the agent sound more empathetic. Nothing structural. Nothing that should have changed behavior. We ran our existing tests — a handful of LLM-as-judge evaluations that checked whether the response "sounded helpful." They all passed.

Monday morning, we had 47 support tickets.

The agent had stopped calling `lookup_order` entirely. Instead of checking order status before processing returns, it was rubber-stamping every request. "I'd be happy to process your refund right away!" No verification. No eligibility check. Just blind approval. Customers who were outside the return window, customers with final-sale items, even a few who seemed to be testing the system with made-up order numbers — they all got approved.

The financial damage was real, but the trust damage was worse. Our ops team lost confidence in the agent. Leadership started asking whether we should roll back to human-only support. Three weeks of automation progress, gone because of a prompt change that none of our tests caught.

That's when we asked ourselves: why didn't our tests catch this?

## The Testing Gap Nobody Talks About

The answer was painfully simple. Our tests were checking the wrong thing.

We were evaluating whether the agent's *text* was good. Was it empathetic? Was it professional? Did it address the customer's concern? By every text-quality metric, the broken agent was performing beautifully. It was warm, reassuring, and completely wrong about what it was doing.

This is the fundamental gap in how most teams test AI agents today. The evaluation frameworks available — and there are good ones — are designed around text quality. BLEU scores. ROUGE scores. LLM-as-judge rubrics that assess tone and helpfulness. These metrics matter, but they don't capture what matters *most* for agents that take actions in the real world.

When your agent calls tools, makes decisions, routes requests, or generates structured data, the *behavior* is what matters. Did it call the right function? Did it pass the correct arguments? Did it avoid calling a dangerous function it shouldn't have? Did it follow the expected sequence of operations?

Text quality evaluation can't answer these questions. You can have a perfectly articulate agent that calls completely wrong tools. You can have a response that scores 0.95 on helpfulness while leaking a customer's Social Security number in the reasoning chain.

We looked for tools that could test agent behavior — the actual decisions, tool calls, and structured outputs — and found nothing that fit. The existing options fell into two camps: heavyweight enterprise platforms that cost six figures and required months of integration, or lightweight eval harnesses that only measured text similarity.

We needed something in between. Something that understood tool calls as first-class citizens. Something that could run in a CI pipeline and fail the build when an agent stopped calling the right functions. Something that treated PII detection, schema validation, and behavioral regression as core testing primitives, not afterthoughts.

So we built it.

## What KindLM Actually Does

KindLM is a CLI tool that runs behavioral regression tests against AI agents. You define test suites in YAML, and KindLM executes them against your agent configuration, checking not just what the agent says but what it *does*.

Here's what a test looks like:

```yaml
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 3

suites:
  - name: "refund-agent"
    system_prompt_file: ./prompts/refund.md
    tests:
      - name: "happy-path-refund"
        input: "I want to return order #12345"
        assert:
          - type: tool_called
            value: lookup_order
            args:
              order_id: "12345"
          - type: tool_not_called
            value: process_refund
          - type: no_pii
          - type: judge
            criteria: "Response is empathetic and professional"
            threshold: 0.8
```

That YAML would have caught our Friday deploy. The `tool_called` assertion verifies the agent invoked `lookup_order` with the correct argument. The `tool_not_called` assertion ensures it didn't jump straight to `process_refund` without verification. The `no_pii` check catches any accidental data exposure. And the `judge` assertion still checks text quality — because that matters too, it just isn't sufficient on its own.

KindLM ships with 11 assertion types that cover the full spectrum of agent behavior:

- **tool_called / tool_not_called / tool_order** — Verify the agent's actions
- **schema** — Validate structured output against JSON Schema
- **judge** — LLM-as-judge scoring for subjective quality
- **no_pii** — Detect SSN, credit card, email, phone, IBAN patterns
- **keywords_present / keywords_absent** — Check for required or forbidden phrases
- **drift** — Compare against stored baselines for regression detection
- **latency / cost** — Performance and budget guardrails

It runs against any major LLM provider — OpenAI, Anthropic, Gemini, Mistral, Cohere, or local models through Ollama. You write your tests once, then run them against any provider to compare behavior.

And it's designed for CI from the ground up. JUnit XML output for test reporting, JSON for programmatic consumption, proper exit codes (0 for pass, 1 for fail), and the ability to set pass-rate gates that fail the build if your agent drops below a threshold.

## Why Open Source

We made KindLM open source because we believe testing tools should be free.

This isn't altruism disguised as marketing. It's a practical conviction. If you're building AI agents — whether it's a side project or an enterprise product — you need to be able to test behavioral correctness before you ship. Gating that capability behind a subscription creates perverse incentives. Teams without budget skip behavioral testing. Agents ship untested. Users get hurt.

The CLI does everything a solo developer or small team needs. Install it with `npm i -g @kindlm/cli`, write your YAML config, run your tests. Free forever. MIT licensed.

We do have a paid product — KindLM Cloud — which adds team collaboration, test history, compliance report storage, and enterprise features. That's how we sustain development. But the core testing capability, the thing that would have caught our broken refund agent, will never be behind a paywall.

## What Comes Next

We shipped KindLM because we needed it ourselves, and we suspect many of you need it too. AI agents are moving from demos to production faster than testing practices can keep up. Every week, someone discovers their agent broke in a way that no text-quality metric would have flagged.

The EU AI Act is adding regulatory pressure on top of the practical need. Starting August 2026, deployers of high-risk AI systems need documented testing evidence. KindLM can generate Annex IV-compliant documentation automatically — not because compliance is exciting, but because it shouldn't be a separate workstream from the testing you're already doing.

If you've ever deployed an AI agent and wondered whether it's still doing the right thing, give KindLM a try. If you've ever been burned by a prompt change that broke behavior without breaking eval scores, you already understand the problem we're solving.

Your agents deserve better tests. Your users deserve agents that behave predictably. And you deserve a weekend where you don't come back to 47 support tickets.

```bash
npm i -g @kindlm/cli
kindlm init
kindlm test
```

Know what your agent will do before your users do.

---

*KindLM is open source at [github.com/kindlm/kindlm](https://github.com/kindlm/kindlm). Star the repo, file issues, contribute. We're building this together.*
