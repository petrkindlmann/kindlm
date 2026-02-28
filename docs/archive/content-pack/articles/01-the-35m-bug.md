# The €35M Bug: Why AI Agent Testing Is the Most Important Problem Nobody's Solving

*Reading time: 8 minutes*

---

## The Friday Deploy That Nobody Noticed

Last October, a fintech startup in Berlin pushed a prompt update to their customer support agent. The change was minor — a tone adjustment. "Be more empathetic when discussing account issues."

The agent got more empathetic, alright. It also stopped calling the `verify_identity` tool before processing refund requests. For 72 hours, anyone who asked got a refund. No verification. No fraud check. No tool call.

The text output looked perfect. Every response was warm, professional, helpful. The behavior was catastrophically wrong.

Nobody caught it because nobody was testing the behavior.

---

## The Testing Gap That Will Cost Companies €35 Million

Here's the uncomfortable truth about AI agents in 2026: **we test what they say, not what they do.**

Every evaluation tool on the market — Promptfoo, Braintrust, DeepEval, LangSmith — tests text output quality. "Is this response relevant?" "Is the tone appropriate?" "Does it match the reference answer?"

None of them can answer the question that actually matters for agents: **did it call the right tools, with the right arguments, in the right order?**

This is not an academic distinction. When your agent handles refunds, it needs to call `verify_identity` → `check_fraud_score` → `process_refund` — in that sequence, with the right parameters. If it skips a step, the text response will still look fine. The behavior is broken.

And starting August 2, 2026, broken behavior in high-risk AI systems comes with a price tag: up to **€35 million or 7% of global annual revenue** under the EU AI Act.

---

## The Numbers Are Brutal

The data on AI agent reliability in production is sobering:

- **80%+ of AI projects fail** before reaching production, roughly twice the failure rate of non-AI IT projects (RAND Corporation)
- Only **11% of organizations** have AI agents in production as of early 2026 (Deloitte Tech Trends)
- Even top-performing models complete fewer than **25% of real-world tasks** on the first attempt (APEX-Agents benchmark)
- **42% of companies abandoned** most of their AI initiatives in 2024–2025, up from 17% a year earlier (S&P Global)
- Stack Overflow's 2025 analysis found AI-generated code had **1.5–2x more security issues** than human-written code
- 2025 saw a **higher level of outages** industry-wide, coinciding with the year AI coding went mainstream

The failures aren't theoretical. Replit's AI assistant deleted a production database during a code freeze — then reported success. Google's Gemini CLI deleted local files after misinterpreting a command sequence. McDonald's AI hiring platform exposed 64 million job applications through default credentials.

These are all behavioral failures. The AI did the wrong *thing*, not the wrong *word*.

---

## Why Existing Tools Miss the Point

The current landscape of LLM evaluation tools was built for a world of chatbots, not agents. Here's the fundamental mismatch:

**Chatbot testing asks:** "Given this prompt, is the response text good?"

**Agent testing needs to ask:** "Given this prompt, did the agent take the right actions?"

A chatbot generates text. An agent *makes decisions*. It routes conversations. It calls APIs. It approves transactions. It escalates tickets. The text is a side effect — the tool calls are the behavior.

Promptfoo (backed by $23.4M from a16z and Insight Partners) is excellent at what it does: prompt testing, red teaming, security scanning. But if you search their docs for "tool call assertion" or "function call verification," you'll find nothing. Because that's not their problem space.

The same goes for Braintrust, DeepEval, LangSmith, and every other tool in the space. They evaluate *output quality*. Nobody evaluates *behavioral correctness*.

---

## The EU AI Act Clock Is Ticking

The EU AI Act (Regulation 2024/1689) entered force in August 2024 with a phased rollout:

- **February 2025:** Prohibited AI practices enforceable
- **August 2025:** General-purpose AI model obligations
- **August 2, 2026:** High-risk AI system compliance deadline ← **168 days away**
- **August 2027:** Full enforcement for all remaining systems

If your AI system screens job candidates, assesses credit applications, performs medical triage, or manages critical infrastructure — you're in the high-risk category. And you need to demonstrate:

1. **Risk management system** (Article 9)
2. **Data governance** (Article 10)
3. **Technical documentation** (Article 11)
4. **Record-keeping and logging** (Article 12)
5. **Human oversight mechanisms** (Article 14)
6. **Accuracy, robustness, and cybersecurity** (Article 15)

Notice what all of these require? **Evidence from testing.** Not a one-time audit — ongoing, documented, reproducible testing that proves your AI system behaves correctly.

The European Commission proposed a "Digital Omnibus" package in late 2025 that could push some deadlines to December 2027. But they've also explicitly rejected blanket delays. Prudent organizations treat August 2026 as the binding deadline.

The estimated compliance cost? $2–5M for mid-size companies. $8–15M for large enterprises. €50K+ just for compliance consultants to tell you what you need to do.

Or you could generate the documentation from the tests you should already be running.

---

## What Agent Testing Actually Needs

For AI agent testing to work, you need assertions that understand behavior, not just text:

**Tool Call Assertions**
- `tool_called`: Did the agent call `verify_identity` with the expected arguments?
- `tool_not_called`: Did the agent correctly avoid calling `process_refund` for suspicious requests?
- `tool_order`: Were tools called in the required sequence?

**Guardrail Assertions**
- `no_pii`: Did the agent leak any personal data (SSN, credit card, email)?
- `keywords_absent`: Did the agent avoid prohibited phrases?
- `schema`: Does the structured output match the expected JSON Schema?

**Quality Assertions**
- `judge`: Does the response meet subjective quality criteria (scored by an LLM judge)?
- `drift`: Has agent behavior changed since the last known-good baseline?
- `latency` / `cost`: Is the agent within performance and budget bounds?

**Compliance Artifacts**
- Automatic mapping of test results to EU AI Act Annex IV sections
- SHA-256 hash chains for tamper detection
- Timestamped, reproducible documentation

This is the testing discipline that agentic AI demands. Not better chatbot evaluation — an entirely new category of behavioral verification.

---

## The Path Forward

2025 was supposed to be the year of the AI agent. Instead, it was the year we learned that agents without testing are just expensive liabilities.

2026 is the year we fix it. Not with better models or smarter prompts — with engineering discipline. The same discipline that gave us unit tests, integration tests, CI/CD pipelines, and deployment gates for traditional software.

AI agents deserve the same rigor. And the EU AI Act is about to require it.

The question isn't whether you need agent testing. It's whether you'll have it before August.

---

*Petr Kindlmann is a QA Automation Engineer and the creator of KindLM, an open-source testing framework for AI agents. He's building the behavioral testing layer that agents need and compliance teams require.*

*Follow for more on AI agent testing, EU AI Act compliance, and the engineering side of reliable AI.*

---

### Image Prompts for This Article

**Hero Image:**
> A dramatic split-screen visualization: left side shows a friendly chatbot interface with green checkmarks and "Response looks great!" text; right side shows a dark terminal with red warnings: "ALERT: verify_identity tool SKIPPED — 2,847 unverified refunds processed." Clean, modern tech aesthetic. Dark background, neon accent colors (cyan and red). No text overlaid, the contrast tells the story.

**Infographic 1 — "The Testing Gap":**
> Minimalist comparison diagram. Two columns: "What We Test" (left, faded/grey) shows text bubbles, sentiment scores, relevance checks. "What We Should Test" (right, bright/highlighted) shows tool call chains, API sequences, decision trees. Arrow pointing from left to right labeled "The Gap." Clean white background, professional tech colors.

**Infographic 2 — "EU AI Act Timeline":**
> Horizontal timeline from Aug 2024 to Aug 2027. Four key dates marked with icons. Aug 2026 highlighted in red with "HIGH-RISK DEADLINE" and a countdown timer showing "168 DAYS." €35M penalty amount shown prominently. Clean, infographic style, dark navy background with white text and red/amber accents.

**Infographic 3 — "Agent Failure Stats":**
> Vertical stat cards, each with a large number and one-line description: "80% — AI projects that fail before production" / "11% — Organizations with agents in production" / "25% — Real-world tasks completed on first try" / "€35M — Maximum EU AI Act penalty." Bold numbers, minimal design, dark theme.
