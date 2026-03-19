---
title: "LLM-as-judge is better than people think, and worse than marketers say"
description: "Where judge models are genuinely useful, where they fail, and how to combine them with deterministic assertions."
date: "2026-03-20"
author: "Petr Kindlmann"
---

I like LLM-as-judge. I also do not trust it blindly.

Both positions are rational.

The popular debate is too binary. One side acts like judge models are fake science. The other side acts like GPT can replace evaluation design. The literature says something more interesting: LLM judges can be quite useful when the criteria are legible and the task is scoped correctly, but they remain sensitive to prompt design, bias, and calibration.

Start with the optimistic result. Zheng et al. (2023), the MT-Bench and Chatbot Arena paper, reported that strong judges such as GPT-4 achieved over 80% agreement with human preferences in their setup. That paper is one reason LLM-as-judge took off. It showed that, for pairwise preference judgments, a strong model can be a practical proxy for human labeling.

Now the caution. Thakur et al. (2024) evaluated thirteen judge models and found that only the best and largest achieved reasonable alignment with humans. Even then, they remained well behind inter-human agreement, and assigned scores could differ by up to five points from human scores. Their analysis also identified sensitivity to prompt complexity and length, plus a tendency toward leniency.

Stureborg et al. (2024) pushed the critique further. Using summarization tasks, they found familiarity bias, skewed rating distributions, anchoring effects in multi-attribute judgments, and sensitivity to prompt differences that humans would consider insignificant. So yes, judges can work. But they do not work like a lab instrument.

The most useful framing I have seen comes from Jung, Brahman, and Choi (2024). Their *Trust or Escalate* paper argues that the right question is not “is the judge always right?” but “when is the judge reliable enough to trust?” They show that selective evaluation can provide a guarantee of human agreement at a chosen risk level by calibrating confidence and escalating hard cases.

That is the mental model I recommend for engineering teams.

## What judge models are actually good at

Judge models are strongest when you need to score qualities that are expensive to specify deterministically:

- helpfulness
- completeness
- tone fit
- whether a response answered the user’s intent
- whether a summary preserved the key point

These are fuzzy but still legible. Humans can usually explain why an answer is better, even if they disagree on the exact numeric score.

Judge models are weaker when the task is really a hidden deterministic check in disguise:

- did the model call the right tool?
- did it include the required field?
- did it reveal an email address?
- did the JSON validate?

For those, using an LLM judge is usually a design mistake. If the property is machine-verifiable, verify it directly.

That leads to a simple rule: use judges for *quality*, not *ground truth you forgot to encode*.

## A judge is a measurement device. Treat it like one.

In practice, I care about three judge failure modes.

**Prompt sensitivity.** Small wording changes shift scores. Thakur et al. (2024) and Stureborg et al. (2024) both show this is real.

**Leniency or harshness drift.** A judge can be directionally useful while still being miscalibrated on absolute thresholds.

**Task leakage.** If your rubric is vague, the judge fills in the gaps with its own preferences.

This is why I do not ask a judge one vague question like “Is this good?” I give a narrow criterion and a threshold.

Here is a reasonable KindLM example:

```yaml
kindlm: 1
project: "support-agent"

suite:
  name: "judge-scoring"

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
  support:
    system: |
      You are a customer support agent.
      Answer clearly and suggest next steps.
    user: "{{message}}"

tests:
  - name: "refund reply is helpful and actionable"
    prompt: "support"
    vars:
      message: "My refund hasn't arrived after 10 days."
    expect:
      judge:
        - criteria: "Response explains likely timing, acknowledges the issue, and gives a concrete next step."
          minScore: 0.8
```

That is much better than “response is good.”

But I still would not stop there. Add deterministic checks for objective properties.

```yaml
tests:
  - name: "refund reply must mention timeline and must not reveal PII"
    prompt: "support"
    vars:
      message: "My refund hasn't arrived after 10 days."
    expect:
      output:
        contains:
          - "refund"
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: "Response is empathetic, specific, and tells the user what to do next."
          minScore: 0.8
```

That combination is the sweet spot. Let the judge handle fuzzy quality. Let deterministic assertions police hard requirements.

## When to trust the score

I trust judge scores more when:

- the rubric is narrow
- the output space is narrow
- the criterion is semantically coherent
- I have checked score stability on a small calibration set
- the score is used comparatively or as a gate with margin, not as a pseudo-precise truth value

I trust them less when:

- the rubric mixes many dimensions at once
- the output is long and creative
- the threshold is tight, like 0.79 versus 0.80
- the evaluated examples are politically loaded, subjective, or domain specialized
- I have never validated the judge against human review in my domain

That last point matters. The literature is informative, but your task distribution is your real benchmark.

## A better evaluation stack

My preferred stack for agent evaluation looks like this:

1. deterministic assertions for behavior and safety
2. schema validation for structured outputs
3. judge scoring for user-facing quality
4. repeated runs for non-determinism
5. human review on a sampled subset for recalibration

This is not overkill. It is how you stop one noisy metric from becoming your entire QA strategy.

Judge models are not magic and they are not junk. They are useful evaluators with known measurement error. The right move is not to worship them or ban them. It is to constrain them.

That is especially true for agents. If a system can call tools, mutate state, or access sensitive information, the LLM judge should be an accessory to evaluation, not the foundation of it.

Use it where natural-language judgment is genuinely needed. Everything else should be asserted directly.

## References

- Lianmin Zheng et al. 2023. *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*. arXiv.
- Aman Singh Thakur et al. 2024. *Judging the Judges: Evaluating Alignment and Vulnerabilities in LLMs-as-Judges*. arXiv.
- Rickard Stureborg, Dimitris Alikaniotis, and Yoshi Suhara. 2024. *Large Language Models are Inconsistent and Biased Evaluators*. arXiv.
- Jaehun Jung, Faeze Brahman, and Yejin Choi. 2024. *Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement*. arXiv.
- Alessandra Bavaresco et al. 2025. *LLMs instead of Human Judges? A Large Scale Empirical Study across 20 NLP Evaluation Tasks*. ACL 2025.
