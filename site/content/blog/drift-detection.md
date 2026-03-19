---
title: "Your agent can still pass and still be drifting"
description: "Why agent drift shows up before obvious failures, and how behavioral baselines catch degradation that headline metrics miss."
date: "2026-03-20"
author: "Petr Kindlmann"
---

One of the worst phrases in agent ops is “it still works.”

Usually that means nothing more than the demo path still completes.

The problem is that production drift rarely arrives as a clean outage. More often, the agent remains superficially functional while getting worse in ways your top-line success metric does not capture: weaker tool discipline, more verbose answers, different escalation behavior, more leakage of irrelevant details, slower runs, higher cost, or subtle changes in structured output.

That is a measurement problem, not just a model problem.

Recent work is making this more concrete. Meinke et al. (2025) studied goal drift in language model agents and found that all evaluated agents exhibited some degree of drift under pressure, with substantial differences between models. In their experiments, Claude 3.5 Sonnet maintained strong goal adherence for over 100,000 tokens, while GPT-4o mini exhibited goal drift at all tested sequence lengths. That is important because it shows drift is not hypothetical “future scale” speculation. It appears in long-horizon agent behavior today.

Khraishi et al. (2026) looked at a different operational source of drift: model switching in multi-turn systems. In production, teams routinely swap models because of upgrades, routing, or fallback logic. Their paper frames this as a structured distribution shift, where one model must continue a conversation started by another. They show that even final-turn switching can induce measurable drift not predicted by single-model benchmark scores.

That finding should make every platform team uncomfortable. A routing optimization can change behavior even when each individual model looks fine in isolation.

There is also a broader evaluation point here. Many organizations still rely on static benchmark accuracy, pass/fail smoke tests, or a single judge score. Those are useful, but they are bad at catching behavioral movement inside the pass band.

What you need is a baseline.

## Drift is difference from yourself, not just failure against a spec

Traditional testing asks: does the output satisfy today’s requirement?

Drift detection asks: is today’s behavior materially different from the behavior we previously considered acceptable?

That distinction matters because agents often degrade before they fail hard. If your support agent used to check an order and then answer, but now answers directly 20% of the time, you may still pass some user-visible checks while accumulating risk.

I like to think about four kinds of drift in agents:

**Behavioral drift.** Tool selection, ordering, escalation, refusals, or state transitions change.

**Semantic drift.** The answer stays on topic, but meaning shifts relative to a trusted baseline.

**Operational drift.** Latency, token use, and cost move.

**Protocol drift.** The shape of JSON, formatting conventions, or field population changes.

A single quality score compresses all of these into one blurry number.

## Why baseline comparison works

Baselines give you memory.

If you save an accepted output or accepted behavior profile, you can compare future runs against it. This is especially useful when the spec is partly tacit. Human teams often know a good answer when they see it, but never write a full formal specification. Baselines let you preserve that prior decision.

This is not a replacement for explicit assertions. It is what you use when explicit assertions are necessary but not sufficient.

For example, schema validation can tell you the JSON is valid. A baseline can tell you the model started filling optional fields with invented content after an upgrade.

Likewise, a judge score can tell you the answer is still “good enough.” A baseline can tell you the agent has become much more verbose, or stopped mentioning a key caveat it used to include.

## A practical drift test

Here is a simple baseline-style test for structured output.

```yaml
kindlm: 1
project: "triage-agent"

suite:
  name: "drift"

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
  triage:
    system: |
      You are an incident triage agent.
      Classify urgency and return structured JSON.
    user: "{{message}}"

tests:
  - name: "incident triage stays close to approved baseline"
    prompt: "triage"
    vars:
      message: "Payment API returns 500 for all EU customers."
    expect:
      baseline:
        drift:
          maxScore: 0.1
          method: "judge"
```

The `maxScore` sets how much drift is tolerable (0.0 = identical, 1.0 = completely different). The `method` can be `"judge"` (LLM comparison), `"embedding"` (cosine similarity), or `"field-diff"` (JSON field comparison).

This kind of test is useful after model upgrades, prompt edits, and routing changes. It does not claim the baseline is sacred. It simply warns that the behavior moved.

For tool-using agents, combine baseline drift with explicit action assertions.

```yaml
tests:
  - name: "triage still checks service health before classification"
    prompt: "triage"
    vars:
      message: "Payment API returns 500 for all EU customers."
    tools:
      - name: "check_service_health"
        responses:
          - when: { service: "payments" }
            then: { service: "payments", status: "degraded" }
    expect:
      toolCalls:
        - tool: "check_service_health"
          argsMatch: { service: "payments" }
      baseline:
        drift:
          maxScore: 0.12
          method: "judge"

gates:
  latencyMaxMs: 4000
```

Now you are watching behavior, meaning, and operations together. Tool assertions check actions, drift checks meaning, and the latency gate catches operational degradation.

## What to baseline

I would not baseline everything. That creates noisy maintenance.

I would baseline:

- high-risk workflows with external actions
- outputs with important tone or compliance requirements
- structured JSON consumed by downstream systems
- long-running agents where behavioral style matters
- prompts that are expensive to fully formalize

I would not rely on baseline-only checks for hard safety requirements. If the model must not call `delete_user`, do not hope semantic similarity catches that.

## The operational habit that matters most

Run drift checks whenever any of these change:

- model version
- provider
- system prompt
- tool descriptions
- tool catalog
- routing policy
- memory policy

Khraishi et al. (2026) is a good reminder that routing and fallback are not neutral infrastructure details. They are behavior changes.

This is also where repeated runs help. Some drift is non-deterministic. A model may not have moved in average quality but may have grown less stable. That still matters in production.

## “Still working” is not a real acceptance criterion

Agents operate in a wide band between perfect and broken. Most teams only notice the far end of that band.

Behavioral baselines help you notice the movement earlier.

That matters because subtle degradations compound. A slightly worse escalation decision, a slightly slower response, a slightly different tool choice, a slightly looser summary. None of those alone creates an outage. Together they create a system you no longer understand.

So yes, keep the pass/fail tests. Keep the judge scores. Keep the smoke suite.

But add drift detection.

Because in agent systems, “it still works” is often just another way of saying “we stopped measuring the part that moved.”

## References

- David Meinke et al. 2025. *Evaluating Goal Drift in Language Model Agents*. arXiv.
- Raad Khraishi, Iman Zafar, Katie Myles, and Greig A. Cowan. 2026. *Evaluating Performance Drift from Model Switching in Multi-Turn LLM Systems*. ICLR 2026 CAO Workshop.
- Qizhe Zhang et al. 2025. *Unlocking Comprehensive Evaluations for LLM-as-a-Judge*. ACL 2025.
- Adnan Masood. 2026. *Reliability Benchmarks for Production LLM Systems*. Field guide article discussing distribution shift and benchmark saturation.
