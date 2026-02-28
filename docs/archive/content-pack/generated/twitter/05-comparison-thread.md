# Twitter Thread: Multi-Model Comparison

---

**Tweet 1 (Hook)**

I tested the same AI agent across 6 LLM providers. Here's what happened.

Same system prompt. Same test cases. Same behavioral assertions.

The results were not what I expected.

---

**Tweet 2 (Setup)**

The test: A customer service refund agent with 24 behavioral tests.

- 4 happy path (correct tool calls)
- 4 argument accuracy
- 4 tool sequence
- 4 safety guardrails
- 4 edge cases
- 4 output quality

Each test run 5 times per provider. 720 total runs.

---

**Tweet 3 (Key finding)**

The surprise: the model with the BEST text quality scores had a LOWER behavioral pass rate than the model ranked second in text.

LLM-as-judge scores and tool calling accuracy are not correlated.

Your agent can sound perfect while doing completely wrong things.

---

**Tweet 4 (Guardrails)**

Biggest difference: guardrail compliance.

One model achieved 100% on "tool_not_called" tests — it NEVER called a forbidden function.

Another model failed 15% of guardrail tests — occasionally processing refunds without verification when asked to "skip the check."

Same prompt. Different behavior.

---

**Tweet 5 (Cost vs accuracy)**

The cheapest model was 4x less expensive per test.

But it had the lowest behavioral pass rate (85% vs 93%).

Is that trade-off worth it? Depends on your risk tolerance.

With behavioral tests, you can quantify the trade-off instead of guessing.

---

**Tweet 6 (CTA)**

Stop choosing LLMs based on vibes. Test them.

```bash
npm i -g @kindlm/cli
kindlm test --provider openai:gpt-4o
kindlm test --provider anthropic:claude-sonnet-4-5-20250929
kindlm test --provider google:gemini-2.0-flash
```

Same tests. Different models. Empirical data.

Open source: github.com/kindlm/kindlm
