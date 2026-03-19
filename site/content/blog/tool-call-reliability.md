---
title: "Tool calls break before the text does"
description: "Why small prompt or toolkit changes can silently degrade tool-calling agents, and how to test for it before deploy."
date: "2026-03-20"
author: "Petr Kindlmann"
---

The dangerous thing about tool-call regressions is that the user often never sees them.

An agent can answer in polished English, sound confident, and still call the wrong tool, skip a required tool, or pass the wrong arguments. If you only review final text, you miss the failure mode that matters most in production: the agent did the wrong thing while sounding fine.

Recent work on function calling robustness backs this up. Rabinovich and Anaby-Tavor (2025) tested agentic function calling under two changes that happen in real systems all the time: meaning-preserving rephrasings of user requests, and toolkit expansion with semantically related tools. Across nine strong models, simply rephrasing the query caused measurable performance drops in abstract syntax tree correctness. In their reported results, drops ranged from 8% to 19%, even though the underlying task did not change. Expanding the available toolkit also degraded performance, with failures splitting mostly between wrong function selection and wrong parameter assignment. In other words: same intent, same user problem, worse tool behavior.

A separate 2025 study by Faghih et al. makes the situation even less comfortable. They showed that editing only the *description* of a tool, without changing its functionality, can drastically alter how often the model chooses it. In controlled experiments, some edited descriptions received more than 10x the usage of the original versions. That is not a small prompt-engineering effect. It means your agent’s behavior can change because someone rewrote a docstring, renamed a capability, or added a more assertive description to a competing tool.

This is why I treat tool use as a regression-testing problem, not a prompt-quality problem.

## Why small changes hit tool use so hard

Most function-calling stacks ask the model to do two different tasks at once:

1. understand the user’s intent
2. map that intent onto a tool schema chosen from a text-only menu

That second step is fragile. The model is not selecting from a type-safe function registry the way a compiler would. It is doing language matching over tool names, descriptions, argument fields, and the surrounding prompt. Change the wording, change the competition set, change the prior examples, and the mapping can move.

Rabinovich and Anaby-Tavor (2025) showed exactly that with rephrased requests and related-tool expansion. Faghih et al. (2025) showed it with description edits. The common pattern is simple: tool selection is not just task understanding. It is also ranking under ambiguity.

That has three practical consequences.

First, prompt edits are not local. A “harmless” rewrite of the system prompt can shift whether the model believes it should call a tool at all.

Second, adding a new tool can break an old behavior. Teams often think of new tools as additive. In practice, every new tool is also a new distractor.

Third, text review is a weak safety signal. If the model hallucinates less and sounds cleaner after a prompt update, you may still have made production behavior worse.

## What to test instead of staring at outputs

For tool-using agents, I want tests that answer four questions:

1. Did the agent call the required tool?
2. Did it pass the right arguments?
3. Did it call tools in the right order?
4. Did it avoid tools it should never call in this scenario?

That is exactly the layer where silent regressions show up.

Here is a minimal example.

```yaml
kindlm: 1
project: "billing-agent"

suite:
  name: "refunds"

providers:
  openai:
    apiKeyEnv: "OPENAI_API_KEY"

models:
  - id: "gpt-4o"
    provider: "openai"
    model: "gpt-4o"
    params:
      temperature: 0

prompts:
  refunds:
    system: |
      You are a billing support agent.
      Use lookup_order(order_id) before answering refund questions.
    user: "{{message}}"

tests:
  - name: "refund request must inspect order first"
    prompt: "refunds"
    vars:
      message: "Can I get a refund for order #12345?"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: "delivered", refund_window_days: 14 }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "12345" }
```

If a prompt rewrite causes the model to answer from general policy instead of checking the order, this test fails even if the prose still sounds helpful.

Now add the negative assertion, because agents often regress by becoming over-eager:

```yaml
tests:
  - name: "refund query must not cancel subscription"
    prompt: "refunds"
    vars:
      message: "I want a refund for order #12345"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: "shipped" }
      - name: "cancel_subscription"
        responses:
          - when: { user_id: "u_1" }
            then: { cancelled: true }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch: { order_id: "12345" }
        - tool: "cancel_subscription"
          shouldNotCall: true
```

This catches the fluent-but-dangerous class of failure where the model overgeneralizes from “refund” to “cancel.”

## The regression suite you actually need

If you ship agents, I would keep three categories of tool-call tests.

**Golden path tests.** The obvious requests. These catch total breakage.

**Near-neighbor tests.** Similar intents that should lead to different tools. These catch tool confusion when the toolkit grows.

**Paraphrase tests.** Same task, several user phrasings. These catch prompt sensitivity.

That third category matters more than most teams realize. The Rabinovich and Anaby-Tavor result is a reminder that semantic equivalence for humans is not behavioral equivalence for agents.

I also like to repeat tests. Non-determinism hides regressions. A prompt change that reduces tool-call reliability from 99% to 92% may look fine in a single run and hurt you badly over thousands of sessions.

## A better rule of thumb

Do not ask “did the answer get better?”

Ask “did the behavior stay invariant under wording changes, tool catalog changes, and prompt edits?”

That is a harder standard, but it is the one production agents need. Tool-calling systems live or die on action correctness, not eloquence.

Prompt evals are still useful. I use them. But they answer a different question. They tell you whether the model said something good. Behavioral regression tests tell you whether the agent still *did* the right thing.

Those are not interchangeable.

If your agent can trigger payments, send emails, modify records, access internal data, or hit external APIs, text quality is downstream. Tool-call correctness is the contract.

And contracts deserve tests.

## References

- Ella Rabinovich and Ateret Anaby-Tavor. 2025. *On the Robustness of Agentic Function Calling*. TrustNLP 2025.
- Kian Faghih, Eugene Sheng, and colleagues. 2025. *Tool Preferences in Agentic LLMs are Unreliable*. arXiv.
- Han Wang et al. 2025. *Improving Large Language Models Function Calling and Reasoning Capabilities via Structured Reasoning*. EMNLP 2025.
