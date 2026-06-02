---
title: "Cost and latency are regressions, so gate them in CI"
description: "A passing agent that quietly got 3x more expensive or 2x slower is still a regression. Why token cost and latency belong in your CI gate, not a dashboard you check later."
date: "2026-05-26"
author: "Petr Kindlmann"
---

You merge a prompt tweak, CI goes green, and three weeks later finance asks why the model bill tripled.

That gap between "tests pass" and "we are paying double" is the subject of this post. Most teams treat cost and latency as things you observe after the fact: a Grafana panel, a billing alert, an end-of-month spreadsheet. By the time those tell you something is wrong, the regression has already shipped and run against real traffic. I want to argue the opposite position: cost and latency are correctness properties, and they belong in the same pass/fail gate as your tool-call assertions, enforced in the pull request that caused them.

## A passing agent that got 3x more expensive is a regression

We accept this reasoning everywhere else. If a database query that used to take 5ms starts taking 500ms, that is a regression even though the query still returns correct rows. If a function that allocated 1MB starts allocating 100MB, you fix it before merge. Nobody says "the output is correct, ship it" and waits for the bill.

Agents are the one place teams suspend this rule. The output is plausible, the demo path completes, the tests are green, so the prompt change merges. Meanwhile the agent now takes two extra tool round-trips to reach the same answer, and each round-trip is another full-context model call. Behavior is "correct." Economics are broken. That is still a regression, and the cheapest place to catch it is the diff that introduced it, not production telemetry weeks later.

## Why cost and latency drift in the first place

The drift is rarely dramatic. It accumulates from ordinary, well-intentioned changes:

**Model swaps.** Someone moves a step from a small model to a larger one "for quality," or a routing layer falls back to a more expensive model under load. Per-token price and per-call latency both move, and nothing in a correctness-only suite notices.

**Longer system prompts.** Every "also, please remember to..." you append to the system prompt is input tokens on every single call. A prompt that grew from 400 to 1,200 tokens tripled the fixed cost of every request in the suite. Output looks the same. The meter does not.

**More tool round-trips.** A subtle instruction change makes the agent verify something twice, or call a lookup it used to skip. Each extra round-trip is another inference pass over the full conversation. Two extra hops can quietly double both cost and wall-clock time.

**Retries.** Backoff on rate limits and transient 5xxs is correct behavior, but a flakier upstream or a tighter timeout turns occasional retries into routine ones, and retries are full re-inferences, not free.

None of these throw an error. All of them show up on the bill and in p95 latency. The only question is whether you find out in the PR or in the postmortem.

## Averages lie, especially about latency

If you gate on latency, gate carefully. The mean is the wrong statistic. An agent can hold a perfectly respectable average while a meaningful slice of requests are miserable, and those slow requests are the ones users actually feel, because a single user interaction often fans out into several model calls and is only as fast as its slowest component.

This is the core argument of Dean and Barroso's "The Tail at Scale" (CACM, 2013): in systems that compose many calls, tail latency dominates the user-visible experience, and optimizing the average does little for the tail. An agent that makes five tool calls per task is exactly that kind of fan-out system. If even one in twenty calls is slow, a multi-step task hits it routinely.

So in practice you want p95 thinking, not "is the average under a second." KindLM aggregates per-test latency across runs and exposes p50 and p95 in the report. When you set a threshold, set it against the tail you actually care about, and use a high enough `--runs` count that the p95 number means something rather than being one sample.

## Put the threshold in the gate, in the PR

Here is a suite that gates cost and latency the same way it gates tool calls. Per-test budgets sit under `expect`; suite-wide ceilings sit under `gates`. If anything blows the budget, the command exits 1 and the pull request check fails.

```yaml
kindlm: 1
project: support-agent

suite:
  name: refund-flow-budgets
  description: Behavioral tests with cost and latency budgets

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o-2024-08-06
    provider: openai
    model: gpt-4o-2024-08-06
    params:
      temperature: 0
      maxTokens: 1024

prompts:
  refund-agent:
    system: |
      You are a support agent. Always look up the order before acting.
      Never refund orders over $500 without manager approval.
    user: "{{message}}"

tests:
  - name: refund-stays-cheap-and-fast
    prompt: refund-agent
    vars:
      message: "I want to return order #12345"
    tools:
      - name: lookup_order
        description: Look up an order by id
        defaultResponse:
          status: "shipped"
          total_usd: 42.00
    expect:
      toolCalls:
        - tool: lookup_order
      latency:
        maxMs: 4000
      cost:
        maxUsd: 0.02

gates:
  passRateMin: 1.0
  latencyMaxMs: 3500
  costMaxUsd: 0.05
```

The mock `lookup_order` response keeps the tool-call path deterministic, so the only things moving between runs are the model's token usage and its latency, which is exactly what you want a budget gate to measure. Run it in CI with `kindlm test --reporter junit --runs 5`. The JUnit XML lands on the PR, and the exit code does the gating.

## The honest limitation: cost only works for three providers

Be straight about what the cost gate can and cannot do. KindLM estimates cost from per-model pricing tables, and today those tables only cover OpenAI, Anthropic, and Gemini. For Mistral, Cohere, raw HTTP, or MCP-backed models, there is no price table, so cost comes back null and any `cost.maxUsd` assertion fails with `COST_UNKNOWN` rather than silently passing.

That is deliberate. A budget gate that quietly passes because it could not measure anything is worse than no gate, because it gives you false confidence. If you are on an unpriced provider, gate on latency, which works everywhere, and track tokens out of band until pricing lands. The same caveat applies to embedding-based drift: only OpenAI implements embeddings today, so semantic drift methods need an OpenAI model.

Latency, for what it is worth, has none of these gaps. Every provider returns wall-clock timing, so `latency.maxMs` and `gates.latencyMaxMs` are portable across all of them.

## The takeaway

Cost and latency are not observability. They are behavior, and behavior is what you regression-test. A dashboard tells you the bill went up; it does not tell you which merge did it, and it does not block that merge. A gate does both. Decide what a single agent task is allowed to cost and how slow it is allowed to get, write those numbers into the gate, and let the PR fail when reality drifts past them. The point of a CI gate is that you find the 3x before your finance team does.

## References

- Jeffrey Dean and Luiz André Barroso. 2013. *The Tail at Scale*. Communications of the ACM, 56(2).
