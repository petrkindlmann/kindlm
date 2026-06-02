---
title: "Text evals miss the agent regressions that actually hurt"
description: "By 2026, asserting tool behavior is table stakes, not a moat. The real question is which layer each tool belongs to: a broad eval platform, hosted observability, or a small per-PR CI gate."
date: "2026-06-01"
author: "Petr Kindlmann"
---

The highest-scoring answer my agent ever produced also called the wrong tool, and that is the whole problem with text-quality evals.

In 2024, "test what the agent does, not just what it says" was a contrarian thing to say. By 2026, it is close to consensus. Most serious eval tools now assert tool trajectories, not just text similarity. So the honest framing is no longer "we are the only ones who check behavior." Behavioral assertions are table stakes. The interesting question is how to think about the layers, and which tool belongs at which layer in your pipeline.

This post is an argument about that, and a small comparison of where each kind of tool fits.

## Two questions, not one

A text-quality eval and a behavioral assertion answer different questions.

A judge score, an embedding similarity, a BLEU-style overlap: these measure what the agent **said**. Was the answer fluent, on-topic, faithful to the reference, free of obvious nonsense. That is a real signal. LLM-as-judge in particular is more useful than skeptics admit. Zheng et al. (2023), the MT-Bench and Chatbot Arena paper, reported strong judges reaching over 80% agreement with human preference in their setup. For open-ended quality, a good judge is a practical proxy for human labeling.

A behavioral assertion measures what the agent **did**. Which tool it called, with which arguments, in which order, which tool it correctly refused to call, whether the structured output validated against a schema, whether it leaked a credit card number, whether it blew the cost budget.

These are not redundant. They are orthogonal. A fluent, higher-scoring answer can still call `refund_full` instead of `lookup_order`, return JSON that fails AJV validation, echo a customer's SSN back in plain text, or quietly cost forty cents per call because someone widened the context window. None of those show up in a judge score, because the prose reads fine. The text got better and the behavior got worse.

This is why I do not let a judge score gate a deploy on its own. A judge tells me the answer was good. It does not tell me the agent did the right thing. Production agents that touch payments, send email, or mutate records live or die on the second question.

## Why the fluent failure is the dangerous one

The reason text evals miss the regressions that hurt is structural, not a bug you can patch.

Language quality and action correctness are produced by the same forward pass, but they are not correlated in the way intuition suggests. A model can become more confident and more articulate after a prompt edit while its tool selection drifts. Tool choice is ranking under ambiguity over a text menu of tool names and descriptions. Prose quality is something else entirely. Optimizing or measuring one tells you very little about the other.

So the failure mode that survives a text eval is precisely the one that costs you: the agent that sounds more polished and acts slightly wrong. You do not catch it by reading transcripts, because the transcript looks better than before.

## One gate, both questions

Here is the concrete version: a single test that asserts text quality with a judge, and behavior with a tool-call check plus a cost ceiling. KindLM supports mock tool responses, so the tool-call decision is deterministic and does not depend on a live backend.

```yaml
kindlm: 1
project: support-agent

suite:
  name: refund-flow
  description: One test, two questions

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o-2024-08-06
    provider: openai
    model: gpt-4o-2024-08-06
    params:
      temperature: 0
      maxTokens: 800

prompts:
  refund-agent:
    system: |
      You are a billing support agent.
      Always look up the order with lookup_order before answering refund questions.
      Never issue a refund without a manager when the amount is over $500.
    user: "{{message}}"

tests:
  - name: inspects-order-and-stays-cheap
    prompt: refund-agent
    vars:
      message: "Refund order #12345 please, it was $40."
    tools:
      - name: lookup_order
        responses:
          - when: { order_id: "12345" }
            then: { order_id: "12345", status: delivered, amount_usd: 40 }
      - name: issue_refund
        defaultResponse: { refunded: true }
    expect:
      toolCalls:
        - tool: lookup_order
          argsMatch: { order_id: "12345" }
      judge:
        - criteria: "The reply is clear, polite, and explains the refund decision."
          minScore: 0.8
      cost:
        maxUsd: 0.05

gates:
  passRateMin: 1.0
  judgeAvgMin: 0.8
  costMaxUsd: 0.05
```

The judge clause answers "was the answer good." The `toolCalls` and `cost` clauses answer "did it do the right thing without overspending." If a prompt rewrite makes the reply warmer but skips `lookup_order`, the judge can still pass while the tool assertion fails. One gate, both questions, and the build goes red on either.

Two accuracy notes, because the limits matter. Cost estimation exists only for OpenAI, Anthropic, and Gemini. On Mistral, Cohere, raw HTTP, or MCP providers a `cost.maxUsd` assertion fails with `COST_UNKNOWN` rather than silently passing. And semantic, embedding-based drift only works with OpenAI, since it is the only provider that implements embeddings. Use `judge` or `field-diff` drift elsewhere.

## Where each tool fits in 2026

I am not going to pretend there is a moat here. There is not. There is a layering question, and different tools sit at different layers.

**Broad eval platforms.** promptfoo ([promptfoo.dev](https://promptfoo.dev)) is the obvious reference point: a large, well-built, open-source eval framework with a huge assertion catalog, red-teaming, model comparison matrices, and a web viewer. If you want one tool to do prompt comparison, dataset-driven evals, and adversarial testing, it is a strong default and it asserts tool behavior too. Behavioral checks there are one capability inside a wide surface.

**Hosted observability.** LangSmith and Braintrust come at it from production traces: you instrument the app, ship spans to a hosted backend, and evaluate over real traffic with dashboards and online evals. That is the right tool when your question is "how is the deployed agent behaving across real users over time." It assumes an SDK, instrumentation, and sending data to a service.

**A small provider-neutral CI gate.** This is the niche KindLM actually fills, and I will keep it narrow. No SDK to wire in. No hosted traces required. The whole suite is YAML that lives in the pull request next to the code it tests, it runs offline against Ollama for the determinable parts, and it returns exit 0 or 1 with JUnit XML for the CI to read. It is the unit-test-shaped layer: cheap, local, deterministic where it can be, and reviewable in a diff.

These overlap, and that is fine. Use the platform for breadth. Use observability for production. Use a small gate for the per-PR check. Picking one does not forbid the others.

The one genuinely differentiated piece I will name is the compliance artifact. `kindlm test --compliance` emits an EU AI Act Annex IV documentation **draft** covering selected articles (9, 10, 12, 13, 15), with a SHA-256 hash for tamper evidence. It is explicitly not legal advice and not a conformity assessment, but it turns a green test run into a dated, hashed evidence record. I have not seen that fall out of the other tools for free.

## Takeaway

Stop asking "did the answer get better." Ask "did the agent still do the right thing." Those are two questions, and a text-quality eval only answers the first. By 2026, every credible tool can check behavior, so the choice is not whether to test what agents do, it is where in your stack each check belongs: breadth, production, or the per-PR gate. Run all three if you can. Just do not let a fluent transcript talk you out of checking the trajectory underneath it.

## References

- Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang, et al. 2023. *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*. NeurIPS 2023 Datasets and Benchmarks Track.
