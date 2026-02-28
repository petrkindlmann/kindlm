# Product Hunt Listing: KindLM

---

## Tagline (60 chars max)

Behavioral regression tests for AI agents

## Short Description (260 chars max)

Open-source CLI that tests what AI agents DO, not just what they say. Verify tool calls, detect PII leaks, validate structured output, and enforce safety guardrails. YAML config, CI-ready, works with any LLM. Free forever.

## Detailed Description

### The Problem

AI agents break silently. A prompt change causes your refund agent to stop verifying orders before processing returns. A model update makes your coding assistant skip the test-running step. A fine-tuning tweak causes your medical intake bot to leak patient data in its reasoning chain.

These failures are invisible to traditional evaluation. Text quality metrics score the broken agent highly — the response sounds great, it's just doing the wrong thing.

### The Solution

KindLM tests what your AI agent actually does. Not the text it generates — the decisions it makes, the functions it calls, and the data it produces.

Define test suites in YAML:

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
      - type: judge
        criteria: "Response is helpful and professional"
        threshold: 0.8
```

### 11 Assertion Types

- **tool_called** — Agent called the right function with correct arguments
- **tool_not_called** — Agent respected safety guardrails
- **tool_order** — Agent followed the correct protocol sequence
- **schema** — Structured output validates against JSON Schema
- **judge** — LLM-as-judge scores response quality (0.0-1.0)
- **no_pii** — Detects SSN, credit card, email, phone, IBAN patterns
- **keywords_present** — Required phrases appear in output
- **keywords_absent** — Forbidden phrases do not appear
- **drift** — Behavioral comparison against stored baselines
- **latency** — Response time under threshold
- **cost** — Token cost under budget

### Works With Any Provider

OpenAI, Anthropic, Google Gemini, Mistral, Cohere, Ollama. Write tests once, run against any model. Compare providers empirically.

### Built for CI

JUnit XML output for GitHub Actions, GitLab CI, Jenkins. JSON reporter for programmatic consumption. Exit code 0 for pass, 1 for fail. Pass-rate gates to block deploys when agents degrade.

### EU AI Act Compliance

Generate Annex IV-compliant documentation from your test results with `kindlm test --compliance`. Automated testing evidence, SHA-256 tamper proof, timestamped reports.

### Open Source, Free Forever

The CLI is MIT-licensed. All 11 assertion types, all providers, CI integration, compliance reports — all free. We sustain development through KindLM Cloud, an optional paid dashboard for team collaboration, test history, and enterprise features.

### Get Started

```bash
npm i -g @kindlm/cli
kindlm init
kindlm test
```

Know what your agent will do before your users do.

---

## First Comment from Maker

Hey Product Hunt! I'm the creator of KindLM.

We built this after deploying a customer service agent that silently broke when we updated its system prompt. The agent stopped calling `lookup_order` before processing refunds. Every eval we had said the agent was performing great — because the response text was perfect. The behavior was catastrophically wrong.

The root cause: our tests evaluated text quality but completely ignored tool calling behavior. We looked for a tool that could test what agents DO (function calls, decision sequences, safety guardrails) and found nothing that fit.

So we built KindLM.

A few things I want to highlight:

**It's genuinely free.** The CLI has every feature. All 11 assertion types. All providers. CI integration. Compliance reports. MIT licensed. We make money from KindLM Cloud (team dashboards, test history), but the testing tool itself will never be behind a paywall. Testing infrastructure is too important to gate.

**It's designed for CI.** This isn't a playground or notebook tool. It's built to run in your pipeline, fail your builds when agents break, and produce standard reporting formats.

**The compliance feature is a bonus.** If you're worried about the EU AI Act (and you should be — August 2026 is coming), every test run with `--compliance` generates Annex IV documentation automatically.

I'd love your feedback. What assertion types would you add? What providers are missing? What would make this more useful for your workflow?

GitHub: github.com/kindlm/kindlm

---

## Topics / Categories

- Developer Tools
- Artificial Intelligence
- Open Source
- Testing
- SaaS

## Media Suggestions

1. **Hero image:** Terminal screenshot showing KindLM test output with green/red pass/fail indicators
2. **Gallery image 1:** YAML config file showing assertion types
3. **Gallery image 2:** JUnit XML rendered in GitHub Actions
4. **Gallery image 3:** Compliance report output
5. **Gallery image 4:** Multi-provider comparison results
