# VIDEO 04: Tutorial — "LLM-as-Judge: Score Output Quality" (3 min)

## Script

---

Your agent's output looks fine. But is it actually good? Does it use the right tone? Does it follow your brand guidelines? Does it avoid making promises you can't keep?

[pause]

KindLM uses an LLM as a judge to score every response against your criteria.

[pause]

As you can see on screen, in the YAML config under judge, you define each criterion as plain English. Empathetic tone. No promises about timeline. Uses correct company terminology. For each one, you set a minimum score from zero to one.

[pause]

When you run the test, KindLM sends both the prompt and the agent's response to a judge model. The judge scores each criterion independently and explains why.

[pause]

Look at this result. Empathetic tone scored zero point nine two. Passes. No promises about timeline scored zero point seven one. That fails the zero point eight threshold. Now you know exactly which criterion dropped and why.

[pause]

The judge explanation is stored in the test output. It's not a black box. You can read exactly what the judge flagged and decide if the threshold needs adjusting.

[pause]

This is how you turn subjective quality into a measurable gate in your CI pipeline. Every deploy is checked against your quality standards automatically.

---

## Overlay plan
- 0:00-0:20 → Avatar (the quality problem)
- 0:20-0:50 → Screen: YAML judge config
- 0:50-1:30 → Screen: Test output with judge scores and progress bars
- 1:30-2:10 → Screen: Judge explanation text, highlighting specific feedback
- 2:10-2:40 → Screen: CI pipeline with judge gate pass/fail
- 2:40-3:00 → Avatar (CTA)


---


# VIDEO 05: Quick Demo — "Catch a Regression in 60 Seconds" (60s Twitter/TikTok clip)

## Script

---

Watch me catch an AI agent regression in sixty seconds.

[pause]

Here's my agent. It handles refund requests. I have four tests checking tool calls, output quality, and PII safety.

As you can see on screen, I run kindlm test. Seven out of eight pass. One fails. GPT-4o stopped calling lookup_order on the order-missing scenario.

[pause]

The gate fails because eighty-seven point five percent is below my ninety-five percent threshold. This would have blocked the deploy. That's it. Three lines of YAML. One command.

---

## Overlay plan
- 0:00-0:10 → Avatar (hook)
- 0:10-0:50 → Full screen terminal recording of `kindlm test`
- 0:50-0:60 → Avatar (CTA) + end card


---


# VIDEO 06: Quick Demo — "Compare Claude vs GPT-4o" (60s)

## Script

---

Same agent. Same tests. Two models. Which one is better?

[pause]

As you can see on screen, I run kindlm test with multi-model config. It tests against Claude and GPT-4o simultaneously.

Claude passes all four tests. GPT-4o fails one. The judge scores are close, but Claude's latency is higher. Cost per run? Claude is fourteen cents, GPT-4o is nine cents.

[pause]

Now you have actual data for the model decision. Not vibes. Numbers.

---
