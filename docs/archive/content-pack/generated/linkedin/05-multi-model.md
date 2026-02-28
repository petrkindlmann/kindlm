# LinkedIn Post: Multi-Model Comparison

---

We ran the same 24 behavioral tests against GPT-4o, Claude Sonnet, and Gemini Flash. The results challenged our assumptions.

The model with the highest text quality scores (0.92 average from LLM-as-judge) had a lower behavioral pass rate than the model that scored second on text (0.88).

In other words: the model that sounded best wasn't the one that did the right things most consistently.

The starkest difference was in guardrail compliance. One model achieved 100% on safety tests — it never called a forbidden function across 20 runs. Another failed 15% of the time, occasionally skipping verification steps when prompted to "just process it."

Same system prompt. Same tool definitions. Same tests. Different behavior.

This is why model selection based on playground impressions is unreliable. You can't evaluate tool calling reliability, guardrail compliance, and argument accuracy by reading a few responses. You need automated tests with statistical significance.

KindLM makes this comparison trivial:

```bash
kindlm test --provider openai:gpt-4o
kindlm test --provider anthropic:claude-sonnet-4-5-20250929
kindlm test --provider google:gemini-2.0-flash
```

One YAML config. Multiple providers. Empirical data instead of opinions.

The cheapest model was 4x less expensive but had an 85% pass rate vs 93%. Whether that trade-off makes sense depends on your risk tolerance — but now you can quantify it instead of guessing.

Full methodology and results: [blog link]

github.com/kindlm/kindlm

#LLM #AIBenchmarks #ModelSelection #AIEngineering
