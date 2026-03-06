---
title: "LLM-as-Judge: How to Score AI Agent Responses Automatically"
description: "Traditional metrics can't evaluate AI agent quality. LLM-as-judge uses one model to score another's output against human-written criteria. Learn how to write good judge criteria, set thresholds, and combine judge assertions with deterministic checks in KindLM."
date: "2026-03-07"
author: "Petr Kindlmann"
---

You built an AI agent. It calls tools, follows a system prompt, and mostly does the right thing. But how do you test whether it *actually* handles edge cases well?

You can't use BLEU or ROUGE — those compare text overlap against a reference, and your agent's responses are open-ended. Exact match is useless when there are a hundred valid ways to phrase "your order ships tomorrow." Keyword checks help, but they can't evaluate whether an agent's reasoning is sound or whether its tone is appropriate for a frustrated customer.

You need something that understands intent. That's where LLM-as-judge comes in.

## What LLM-as-Judge Actually Is

The idea is simple: use one LLM to evaluate another LLM's output. You write a human-readable criteria string — a plain-English description of what a good response looks like — and a judge model scores the response against it on a 0.0 to 1.0 scale.

This isn't new. Research teams have used LLM-as-judge for benchmarks since 2023. What's new is making it practical for CI pipelines — repeatable, configurable, and cheap enough to run on every commit.

In KindLM, this is the `judge` assertion. You add it to any test's `expect` block alongside deterministic checks like `toolCalls` or `keywords.deny`.

## How It Works in KindLM

Here's a test for a customer support agent that handles return requests:

```yaml
kindlm: 1
project: returns-agent

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o-mini
    provider: openai
    model: gpt-4o-mini
    params:
      temperature: 0

prompts:
  return-request:
    system: |
      You are a returns agent for an online store.
      Use lookup_order to find order details before responding.
    user: "{{message}}"

defaults:
  judgeModel: gpt-4o-mini

tests:
  - name: handles-return-with-order-context
    prompt: return-request
    vars:
      message: "I want to return order #8842. The shoes don't fit."
    expect:
      toolCalls:
        - tool: lookup_order
      judge:
        - criteria: "The agent references the specific order details
            from the lookup_order tool response, including the item
            name and purchase date. It does not make up information
            that wasn't in the tool response."
          minScore: 0.8
```

The `judge` assertion sends the agent's full response (including tool call results) to the judge model along with your criteria. The judge returns a score. If the score is below `minScore`, the test fails.

Three things to notice:

1. **The judge model can differ from the tested model.** You can test a fast, cheap model (gpt-4o-mini) while judging with a stronger one. Set `judgeModel` in `defaults` to control this globally.

2. **Judge assertions combine with deterministic checks.** The `toolCalls` assertion verifies the agent called `lookup_order` — that's binary, instant, and free. The `judge` assertion evaluates *how the agent used* the tool's response. Each assertion type does what it's best at.

3. **The `minScore` threshold is yours to set.** 0.8 is a practical default. Set it higher (0.9) for safety-critical paths. Set it lower (0.6) for creative tasks where you just want to catch total failures.

## Writing Good Judge Criteria

The criteria string is everything. A vague criteria produces inconsistent scores. A specific criteria produces reliable, actionable test results.

**Bad criteria:**

```yaml
judge:
  - criteria: "Response is good"
    minScore: 0.8
```

What does "good" mean? The judge will interpret this differently every time. You'll get scores between 0.6 and 1.0 for the same response across runs, which makes the assertion useless.

**Good criteria:**

```yaml
judge:
  - criteria: "The agent provides the order status and estimated
      delivery date from the lookup_order tool response. It does
      not fabricate shipping details."
    minScore: 0.8
```

This is specific, measurable, and about observable behavior. The judge can check whether the response references real tool output and whether it contains invented shipping information.

More examples of the pattern:

| Bad | Good |
|-----|------|
| "Response is professional" | "The agent does not use slang, sarcasm, or exclamation marks" |
| "Agent is helpful" | "The agent answers the specific question asked and provides a next step" |
| "Don't hallucinate" | "The agent does NOT reference any policy, discount, or deadline that wasn't provided in the system prompt or tool responses" |

The rule: **write criteria about what the agent does, not what the agent is.** "Is professional" is a personality trait. "Does not use sarcasm" is a testable behavior.

## When to Use Judge vs Deterministic Assertions

Judge assertions cost money — they make an extra LLM call per evaluation. Use them where they add value that deterministic checks can't provide.

| Use this | When you need to check |
|----------|----------------------|
| `toolCalls` | The agent called (or didn't call) a specific tool. Binary, instant, free. |
| `keywords.deny` | Specific phrases must not appear. Catches hallucinated policies, forbidden promises. |
| `pii` | The response contains SSNs, credit card numbers, emails. Regex-based, zero cost. |
| `judge` | Nuanced behavioral evaluation that can't be reduced to keyword presence or tool usage. |

A well-designed test uses all of them. The deterministic assertions handle the binary checks. The judge handles the gray areas — tone, grounding, reasoning quality.

## Handling Score Variance

Judge scores are not perfectly deterministic. The same response might score 0.85 on one run and 0.78 on the next. For tests near the threshold, this means flaky results.

Two mitigations:

**1. Run multiple times and aggregate.** Set `repeat` to run each test multiple times. KindLM aggregates the scores (mean, p50, p95) and evaluates the threshold against the aggregate.

```yaml
tests:
  - name: grounded-response
    prompt: support-query
    repeat: 3
    vars:
      message: "What's your refund policy?"
    expect:
      judge:
        - criteria: "The agent only references the refund policy
            from the system prompt. It does not invent time limits
            or percentage amounts."
          minScore: 0.8
```

**2. Set thresholds with margin.** If you need a score above 0.7 to feel confident, set `minScore: 0.8`. The buffer absorbs run-to-run variance without making the test meaningless.

## Cost Control

Every judge assertion is an LLM API call. On a test suite with 50 tests, each with one judge assertion and `repeat: 3`, that's 150 extra API calls per run.

Keep costs down:

- **Use a cheaper judge model.** gpt-4o-mini as `judgeModel` costs a fraction of gpt-4o and judges well for most criteria.
- **Reserve judge for what needs it.** If you can express the check as `toolCalls`, `keywords.deny`, or `pii`, do that instead. Judge is for what's left.
- **Limit repeats.** `repeat: 3` is usually enough to smooth out variance. You rarely need `repeat: 5` unless you're running close to threshold.

## Get Started

Install KindLM and write your first judge assertion:

```bash
npm install -g @kindlm/cli
kindlm init
```

Add a `judge` block to any test in your `kindlm.yaml`. Run `kindlm test`. If the score is below your threshold, the test fails and the CLI prints the score alongside the criteria — so you know exactly what to fix.

Full documentation on all assertion types, including `judge`, is at [kindlm.com/docs](https://kindlm.com/docs).
