# LinkedIn Post 1: The €35M Bug

**Best posting time:** Tuesday or Wednesday, 8–10 AM CET
**Format:** Text post with infographic image
**Attach:** Agent Failure Stats infographic

---

A fintech startup pushed a "tone adjustment" to their AI agent.

The agent got more empathetic.
It also stopped verifying identity before processing refunds.

For 72 hours, anyone who asked got money back. No check. No fraud detection.

The text output? Perfect. Warm, professional, helpful.
The behavior? Catastrophically broken.

Here's the problem nobody in AI is talking about:

We test what agents SAY.
We don't test what agents DO.

Every eval tool on the market — Promptfoo, Braintrust, DeepEval — tests text output quality. "Is the response relevant? Is the tone right?"

None of them answer the question that matters for agents:

"Did it call the right tools, with the right arguments, in the right order?"

The data is sobering:
→ 80%+ of AI projects fail before production (RAND)
→ Only 11% of organizations have agents in production (Deloitte)
→ Top models complete <25% of real-world tasks on first try

And starting August 2, 2026, broken agent behavior in the EU comes with a new price tag:

€35 million. Or 7% of global revenue.

The EU AI Act requires documented, reproducible testing for high-risk AI systems. That's 168 days away.

We don't need better chatbot evaluators.
We need behavioral testing for agents — tool call assertions, decision verification, compliance documentation.

That's what I'm building with KindLM.

Open source. CLI-first. YAML config.
Tests what your agent DOES, not just what it SAYS.

Link in comments.

---

**Comment to post immediately after:**
Full deep-dive on Medium: [link]
GitHub: github.com/kindlmann/kindlm
Star it if this resonates.

---

**Hashtags (add as first comment, not in post):**
#AIAgents #AItesting #EUAIAct #OpenSource #DevTools #QAAutomation #AICompliance #LLM
