# Twitter Thread: Your AI Agent Broke in Production

---

**Tweet 1 (Hook)**

Your AI agent broke in production and you didn't know.

Not a crash. Not an error. Something worse:

It silently changed its behavior and nobody caught it.

Here are 5 real failure modes we've seen:

---

**Tweet 2 (Wrong tool calls)**

1/ WRONG TOOL CALLS

A refund agent stopped calling lookup_order after a prompt update. It started approving every refund without verification.

The response text? Perfect. Empathetic, clear, helpful.

The behavior? Catastrophically wrong.

LLM-as-judge score: 0.95. Actual damage: $47K in unauthorized refunds.

---

**Tweet 3 (PII leakage)**

2/ PII LEAKAGE

A medical intake agent included a patient's SSN in its chain-of-thought reasoning. The final output was clean, but the sensitive data was exposed in logs.

No text quality metric catches this. You need pattern scanning on every response, every time.

---

**Tweet 4 (Silent regression)**

3/ SILENT CAPABILITY REGRESSION

A coding agent stopped calling run_tests after a model update. Still generated good code. Still explained it correctly. Just silently dropped a critical workflow step.

The only signal was the absence of a tool call. How do you test for absence?

---

**Tweet 5 (Schema drift)**

4/ STRUCTURED OUTPUT DRIFT

An agent returning JSON changed order_id to orderId after fine-tuning. Every downstream consumer broke.

The response text described the data correctly. The actual data was structurally wrong.

JSON Schema validation catches this in milliseconds. Text eval cannot.

---

**Tweet 6 (Solution)**

These failures have one thing in common: they're invisible to text quality evaluation.

You can't catch wrong tool calls with BLEU scores.
You can't catch PII leaks with LLM-as-judge.
You can't catch missing actions with similarity metrics.

You need behavioral testing.

We built @kindaboratory to do exactly this. Test what your agent does, not just what it says.

github.com/kindlm/kindlm
