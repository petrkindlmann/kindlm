---
title: "Make agent tests deterministic by mocking the tools, not the model"
description: "Most teams never test agent behavior in CI because real tool calls are flaky. The fix is old and boring: stub the tool boundary, fix the temperature, repeat, and gate on the rate."
date: "2026-05-28"
author: "Petr Kindlmann"
---

Most teams I talk to have never run a single behavioral test against their agent in CI, and the reason is always the same: the tests are flaky, so they got deleted.

The story is predictable. Someone writes a test that runs the agent against a real booking API or a real search tool. It passes on Tuesday. On Wednesday the tool returns a slightly different payload, or the rate limiter kicks in, or the sandbox account runs out of credits, and the test goes red for reasons that have nothing to do with the agent's logic. After the third false alarm, the test gets an `xfail` and quietly dies. The agent ships untested.

The fix is old and boring, which is why it works: stub the boundary. We have been unit-testing this way for thirty years. You do not call the real payment processor in a unit test. You inject a fake that returns a known result, then assert that your code did the right thing given that result. The same move applies to agents. The boundary is the tool layer, and the thing you want to pin down is what the model **decides** to do when the tool returns a known value.

## What "deterministic" actually means here

An agent run has several sources of variation, and they are not equal.

The tool results are one source. If `get_weather` returns 14 degrees on one run and 21 on the next, the agent's downstream behavior can change for reasons that have nothing to do with the model. This source is fully under your control, and mocking removes it entirely.

The model sampling is the other source. Even at `temperature: 0`, transformer inference is not perfectly reproducible across hardware, batching, and provider-side changes. You cannot mock this away without mocking away the thing you are trying to test. So you do not try. You shrink it with `temperature: 0`, then measure the residual with repeats and a pass-rate gate.

The trick is to separate these. Mock the part that is environmental noise. Keep the part that is the actual behavior under test. What you are left with is a test that asks one clean question: given this exact tool result, does the model call the right tool next, with the right arguments?

## Mock the tools, not the model

There is a tempting shortcut that ruins the whole exercise: mocking the LLM itself. If you stub out the model call and hardcode its response, your test is now green forever, and it tests nothing about the model. It tests your glue code, your message formatting, your tool-call parser. Those are worth testing, but call it what it is. It is not a behavioral test of the agent.

The boundary that gives you a real test is one level lower. You let the real model run. You let it reason over the system prompt, the user message, and the tool definitions. When it decides to call a tool, you intercept that call and return a value **you** chose, instead of hitting a live backend. Then you assert on the call it made and on what it does with your fabricated result.

This is the difference between testing the decision and testing the plumbing. The model still has to choose `search_orders` over `issue_refund`, still has to extract the order ID from the user's message and put it in the right argument. That is behavior. The tool's return value is environment, and you own it.

## The mechanics in KindLM

In KindLM, mock tools live on the test case, not on the provider. Each tool declares conditional responses with `when`/`then` pairs, plus a `defaultResponse` for unmatched calls. The `when` does a partial match against the arguments the model actually sent.

```yaml
kindlm: 1
project: support-agent

suite:
  name: refund-routing
  description: The agent must look up an order before it refunds anything.

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
      maxTokens: 1024

prompts:
  agent:
    system: |
      You are a support agent. Always look up an order with get_order before
      issuing a refund. Never refund an order that is not "delivered".
    user: "{{message}}"

tests:
  - name: refund-blocked-on-pending-order
    prompt: agent
    repeat: 5
    vars:
      message: "Refund order 8841, it has been ages."
    tools:
      - name: get_order
        description: Look up an order by ID.
        parameters:
          type: object
          properties:
            order_id: { type: string }
          required: [order_id]
        responses:
          - when: { order_id: "8841" }
            then: { order_id: "8841", status: "pending", total_usd: 42.00 }
        defaultResponse: { error: "order not found" }
      - name: issue_refund
        description: Refund a delivered order.
    expect:
      toolCalls:
        - tool: get_order
          argsMatch: { order_id: "8841" }
          order: 0
        - tool: issue_refund
          shouldNotCall: true
      output:
        notContains:
          - refunded

gates:
  passRateMin: 0.9
```

The order is pending, so the policy says no refund. We assert the agent looked up the order first (`order: 0` pins it to the first call), and we assert it never called `issue_refund`. Note that `order:` is opt-in. A bare `toolCalls` list is presence-only and does not enforce sequence; you add `order:` per entry or set `toolCallsOrdered: true`.

## Multi-turn: the agent acts on what you fed it

The reason this technique matters more for agents than for ordinary code is the loop. The model calls a tool, gets a result, and then reasons over that result to decide the next move. If you control the result, you control the input to that next decision, which is exactly where agents go wrong.

KindLM runs the tool-call loop for you. The model calls `get_order`, your mock returns `not_found`, the conversation continues with that mocked result in context, and the model produces its next response. You assert on the turn you care about.

```yaml
tests:
  - name: escalates-when-order-missing
    prompt: agent
    repeat: 5
    vars:
      message: "I want a refund for order 9999."
    maxTurns: 4
    tools:
      - name: get_order
        responses:
          - when: { order_id: "9999" }
            then: { error: "not_found" }
        defaultResponse: { error: "not_found" }
      - name: escalate_to_human
        description: Hand off to a human agent.
    conversation:
      - turn: lookup
        expect:
          toolCalls:
            - tool: get_order
              argsMatch: { order_id: "9999" }
      - turn: resolution
        expect:
          toolCalls:
            - tool: escalate_to_human
            - tool: issue_refund
              shouldNotCall: true
```

We forced a `not_found` from the lookup tool, then asserted that the agent escalated rather than guessing or refunding. That second decision is only reachable because we controlled the first tool result.

## Be honest about the residual

Mocking the tools does not make the test fully deterministic, and pretending otherwise is how you get burned. There is still exactly one real model call per turn, and the model can vary. That is why both examples set `temperature: 0`, use `repeat: 5`, and gate on `passRateMin: 0.9` rather than demanding a perfect run. If the agent picks the right tool four times out of five, you probably have a prompt that is genuinely ambiguous, and the gate surfaces that instead of hiding it behind a single lucky pass.

This is also why the pass-rate gate belongs in the suite, not in your head. A flaky behavioral test is still data. A deleted one is not.

The takeaway is narrow and practical: do not test agents by hitting real systems, and do not test them by faking the model. Stub the tool boundary, fix the temperature, repeat, and gate on the rate. You get a test that fails when the agent's judgment changes and stays quiet when the weather does. KindLM's `tests[].tools` block exists for exactly this, and it is the part of the tool most people never find.
