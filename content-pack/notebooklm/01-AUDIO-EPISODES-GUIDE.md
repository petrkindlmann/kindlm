# Option 1: KindLM Audio Overview Episodes — Complete Setup Guide

## Overview

5 podcast-style episodes generated via NotebookLM Audio Overviews, each paired with a Medium article and LinkedIn post from the content pack. Each episode gets its own notebook with curated sources and a custom generation prompt.

---

## Pre-Setup Checklist

Before creating notebooks:

1. **Export all KindLM docs as PDFs** (NotebookLM handles PDFs better than raw .md for Audio Overviews)
2. **Publish Medium articles first** — you can paste their URLs directly as NotebookLM sources
3. **Prepare supplementary sources** — competitor pages, EU AI Act pages, incident reports (URLs listed per episode below)
4. **Set Google Account language to English** (Audio Overviews use your account language by default)

---

## Episode 1: "The Bug That Could Cost You €35 Million"

**Paired with:** Medium Article 1 ("The €35M Bug") + LinkedIn Post 1

### Notebook Name
`KindLM EP01 — The €35M Bug`

### Sources to Upload (6–8 sources)

| # | Source | Type | Why |
|---|--------|------|-----|
| 1 | Article 1: "The €35M Bug" | PDF/URL | Core narrative |
| 2 | `12-PRD.md` (KindLM PRD) | PDF | Problem statement, personas, competitive positioning |
| 3 | EU AI Act Timeline page | URL: `https://artificialintelligenceact.eu/implementation-timeline/` | Official timeline data |
| 4 | EU AI Act 2026 compliance guide | URL: `https://secureprivacy.ai/blog/eu-ai-act-2026-compliance` | Penalties, requirements, compliance gaps |
| 5 | Reworked: "2025 Was Supposed to Be the Year of the Agent" | URL: `https://www.reworked.co/digital-workplace/2025-was-supposed-to-be-the-year-of-the-agent-it-never-arrived/` | RAND/Deloitte stats, APEX-Agents benchmark |
| 6 | Medium: "2025 Overpromised AI Agents" | URL: `https://medium.com/generative-ai-revolution-ai-native-transformation/2025-overpromised-ai-agents-2026-demands-agentic-engineering-5fbf914a9106` | Engineering discipline narrative |
| 7 | Stack Overflow: "Are bugs inevitable with AI agents?" | URL: `https://stackoverflow.blog/2026/01/28/are-bugs-and-incidents-inevitable-with-ai-coding-agents` | 1.5–2x security bugs data |

### Notebook Custom Goal (Configure Notebook → Gear Icon)

```
You are a developer-focused tech podcast covering AI infrastructure and tooling. 
Your audience is senior software engineers, QA leads, and CTOs who build AI-powered 
products. They care about reliability, testing, and compliance — not hype.

Tone: Technical but accessible. Think Changelog podcast meets Hacker News front page. 
No buzzwords. Use specific numbers and real examples. Be skeptical of AI hype.

When discussing AI agent failures, reference specific incidents with details.
When discussing regulation, cite specific articles and penalty amounts.
```

### Audio Overview Custom Prompt

```
This episode is about why AI agent testing is broken and why it's about to become 
a €35 million problem. Structure the discussion as:

1. Open with the Berlin fintech story — the agent that stopped verifying identity 
   after a tone adjustment. This is real-world context for the problem.

2. Walk through the failure statistics — 80% project failure rate (RAND), only 11% 
   in production (Deloitte), <25% task completion (APEX-Agents). Make the hosts 
   genuinely surprised by specific numbers.

3. Explain THE GAP: current tools test text output quality, but agents need behavioral 
   testing — tool call assertions, argument validation, sequence verification. Use the 
   refund agent as a concrete example.

4. Cover the EU AI Act timeline with urgency — August 2, 2026 deadline, €35M penalties, 
   what Articles 9-15 actually require from engineering teams.

5. End with: what would the solution look like? A testing framework that verifies 
   agent BEHAVIOR, not just output. Mention that open-source tools are emerging 
   in this space.

Keep the discussion grounded in real data and specific examples. 
The hosts should debate whether the 80% failure rate is overstated or understated.
Target 12-15 minutes.
```

### Post-Production Workflow

1. Generate Audio Overview
2. Listen once, note timestamps of best quotes (for LinkedIn clips)
3. Download the audio
4. Extract 3 clips (60-90 seconds each) at key moments:
   - Clip A: The Berlin fintech story (~0:30-1:30)
   - Clip B: The failure stats reveal (~3:00-4:30)  
   - Clip C: EU AI Act penalty discussion (~8:00-9:30)
5. Upload clips as LinkedIn native video with captions
6. Full episode linked in Medium article and LinkedIn comments

---

## Episode 2: "Why 80% of AI Agent Pilots Die in Production"

**Paired with:** Medium Article 2 ("80% of AI Agents Fail") + LinkedIn Post 2

### Notebook Name
`KindLM EP02 — Engineering Discipline`

### Sources to Upload

| # | Source | Type | Why |
|---|--------|------|-----|
| 1 | Article 2: "80% of AI Agents Fail" | PDF/URL | Core narrative |
| 2 | `14-ADR.md` (Architecture Decision Records) | PDF | Technical choices context |
| 3 | `16-TESTING_STRATEGY.md` | PDF | Three-layer testing framework |
| 4 | Composio: "Why AI Agent Pilots Fail" | URL: `https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap` | Karpathy "OS" metaphor, Dumb RAG / Brittle Connectors |
| 5 | Medium: "Watching Agents Fail Everywhere" | URL: `https://medium.com/analysts-corner/six-weeks-after-writing-about-ai-agents-im-watching-them-fail-everywhere-fb6636a4568e` | Replit incident, RAND data, real failure modes |
| 6 | ISACA: "Avoiding AI Pitfalls in 2026" | URL: `https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents` | McDonald's McHire, organizational failures |
| 7 | AI Incident Database roundup | URL: `https://incidentdatabase.ai/blog/incident-report-2025-august-september-october/` | Gemini CLI file deletion, Copilot data leak |

### Audio Overview Custom Prompt

```
This episode examines why AI agents fail in production and what engineering discipline 
fixes it. Structure as:

1. Open with Andrej Karpathy's insight: "We have a powerful kernel but no OS." 
   Discuss what this means practically.

2. Walk through specific 2025 incidents. Be detailed:
   - Replit deleting a production database and reporting success
   - Google Gemini CLI deleting local files
   - Microsoft Copilot leaking private repo content
   - Stack Overflow finding 1.5-2x more security issues in AI code
   For each: what went wrong, and why existing testing wouldn't have caught it.

3. Introduce the 3-layer agent testing stack:
   - Layer 1: Behavioral Assertions (tool calls, arguments, sequences)
   - Layer 2: Drift Detection (semantic regression testing)
   - Layer 3: Compliance Documentation (audit trails)
   Compare this to the traditional testing pyramid (unit/integration/E2E).

4. Discuss CI/CD integration — why tests in notebooks don't work, and why tests 
   in CI pipelines do. Use the GitHub Actions example.

5. End with the thesis: "2026 won't be won by better demos. It will be won by 
   engineers who treat agent behavior as testable and verifiable."

The hosts should have a genuine back-and-forth about whether traditional QA 
practices apply to non-deterministic AI systems.
Target 12-15 minutes.
```

---

## Episode 3: "I Spent 4 Years Testing Websites. Then AI Changed Everything."

**Paired with:** Medium Article 3 + LinkedIn Post 3

### Notebook Name
`KindLM EP03 — The Builder Story`

### Sources to Upload

| # | Source | Type | Why |
|---|--------|------|-----|
| 1 | Article 3: "I Spent 4 Years Testing Websites" | PDF/URL | Core personal narrative |
| 2 | `01-README.md` (KindLM README) | PDF | What the tool does |
| 3 | `09-CLI_REFERENCE.md` | PDF | CLI commands, real usage |
| 4 | `05-ASSERTION_ENGINE.md` | PDF | All 11 assertion types explained |
| 5 | Braintrust: "5 Best Prompt Eval Tools 2025" | URL: `https://www.braintrust.dev/articles/best-prompt-evaluation-tools-2025` | Competitive landscape, what Promptfoo does/doesn't do |
| 6 | ZenML: "Promptfoo Alternatives" | URL: `https://www.zenml.io/blog/promptfoo-alternatives` | Promptfoo limitations: Node.js dependency, no UI, CLI-only |
| 7 | Promptfoo CBInsights page | URL: `https://www.cbinsights.com/company/promptfoo` | $23.4M funding, a16z backing, market validation |

### Audio Overview Custom Prompt

```
This is a builder story episode. Frame it as: a QA automation engineer with 4+ years 
of Playwright experience realizes AI agents need the same testing discipline as websites.

1. Open with the personal angle — what does a QA engineer's daily life look like? 
   Writing Playwright tests for news websites, checking buttons, forms, page loads. 
   Then AI features arrive, and the testing toolkit has no answer.

2. Walk through the research journey: Promptfoo ($23.4M from a16z), Braintrust, 
   DeepEval, LangSmith — what each does well, and the specific gap none fills: 
   tool call assertions. Make the hosts explore this gap with genuine curiosity.

3. Show what the solution looks like with a concrete YAML example. Explain tool_called, 
   tool_not_called, tool_order, no_pii, and judge assertions in plain terms. Use the 
   order support agent as the running example.

4. Discuss the design decisions and have the hosts debate them:
   - Open source (MIT) vs. paid — why free?
   - CLI-first vs. web UI — who is this for?
   - YAML config vs. code-based — tradeoffs
   - TypeScript — matching the AI ecosystem

5. End with: what the builder learned that was unexpected. Non-determinism is 
   manageable. The testing patterns are familiar. The market doesn't exist yet.

This should feel like a fireside chat with a developer, not a product pitch.
Target 10-12 minutes.
```

---

## Episode 4: "168 Days Until the EU AI Act Deadline"

**Paired with:** Medium Article 4 + LinkedIn Post 4

### Notebook Name
`KindLM EP04 — EU AI Act Compliance Clock`

### Sources to Upload

| # | Source | Type | Why |
|---|--------|------|-----|
| 1 | Article 4: "The EU AI Act Compliance Clock" | PDF/URL | Core narrative |
| 2 | `07-COMPLIANCE_SPEC.md` | PDF | KindLM's compliance report mapping |
| 3 | `18-SECURITY.md` | PDF | Security model, data protection |
| 4 | EU AI Act 2026 compliance guide | URL: `https://secureprivacy.ai/blog/eu-ai-act-2026-compliance` | Requirements, penalties, organizational gaps |
| 5 | DataGuard timeline | URL: `https://www.dataguard.com/eu-ai-act/timeline` | Three deadline paths explained |
| 6 | Axis Intelligence EU AI Act News | URL: `https://axis-intelligence.com/eu-ai-act-news-2026/` | Digital Omnibus, cost estimates, Finland enforcement |
| 7 | Digital Applied compliance guide | URL: `https://www.digitalapplied.com/blog/eu-ai-act-2026-compliance-european-business-guide` | Phase-by-phase roadmap, Czech/V4 context |
| 8 | K&L Gates EU/Luxembourg update | URL: `https://www.klgates.com/EU-and-Luxembourg-Update-on-the-European-Harmonised-Rules-on-Artificial-IntelligenceRecent-Developments-1-20-2026` | Digital Omnibus details, financial sector |

### Audio Overview Custom Prompt

```
This episode is a practical compliance guide for engineering teams. NOT legal advice — 
engineering work required to meet EU AI Act requirements.

1. Open with the hard facts: August 2, 2026 deadline. €35M or 7% of global revenue. 
   Finland already enforcing. No blanket delays approved. Create genuine urgency 
   without fear-mongering.

2. Explain WHO is affected — the hosts should walk through the list of high-risk 
   categories and have an "oh, that's broader than I thought" moment. Job screening, 
   credit assessment, medical triage, infrastructure...

3. Map the 6 key articles (9-15) to specific engineering work:
   - Article 9 (Risk Management) → automated test suites
   - Article 10 (Data Governance) → diverse test inputs
   - Article 11 (Technical Documentation) → auto-generated reports
   - Article 12 (Record-Keeping) → structured logs with git metadata
   - Article 14 (Human Oversight) → escalation trigger testing
   - Article 15 (Accuracy) → multi-run consistency testing

4. Discuss the cost: $2-5M for mid-size companies, $8-15M for large enterprises. 
   Then contrast with: what if compliance artifacts are generated from tests you're 
   already running? The cost drops dramatically.

5. Cover the Digital Omnibus — might delay to Dec 2027, but requirements don't change.

6. End with the 168-day sprint plan: Foundation → Coverage → Documentation.

The hosts should express both concern about the deadline and practical optimism 
about engineering-driven compliance.
Target 12-15 minutes.
```

---

## Episode 5: "Tool Call Assertions: The Primitive Nobody Built"

**Paired with:** Medium Article 5 + LinkedIn Post 5

### Notebook Name
`KindLM EP05 — Tool Call Assertions Deep Dive`

### Sources to Upload

| # | Source | Type | Why |
|---|--------|------|-----|
| 1 | Article 5: "Tool Call Assertions" | PDF/URL | Core narrative |
| 2 | `05-ASSERTION_ENGINE.md` | PDF | Technical specification of all assertion types |
| 3 | `04-PROVIDER_INTERFACE.md` | PDF | How providers work, tool simulation |
| 4 | `03-CONFIG_SCHEMA.md` | PDF | YAML configuration details |
| 5 | `17-ERROR_HANDLING.md` | PDF | How assertion errors are handled |
| 6 | Comet: "LLM Evaluation Frameworks" | URL: `https://www.comet.com/site/blog/llm-evaluation-frameworks/` | Promptfoo/DeepEval/LangSmith comparison |
| 7 | Braintrust: "Best Prompt Management Tools 2026" | URL: `https://www.braintrust.dev/articles/best-prompt-management-tools-2026` | Competitive landscape, what's missing |

### Audio Overview Custom Prompt

```
This is the most technical episode. The audience is developers who build AI agents 
and want to understand tool call assertions at a deep level.

1. Start with the analogy: Every testing framework has a core primitive. 
   Jest has expect().toBe(). Playwright has expect(locator).toBeVisible(). 
   AI agent testing needs expect(agent).toHaveCalledTool(). This doesn't exist yet.

2. Explain WHY tool calls are the unit of agent behavior. Use the refund agent 
   example: verify_identity → check_fraud_score → process_refund. The text is 
   cosmetic; the tool calls are the behavior.

3. Deep dive into the three types of tool call assertions:
   - tool_called (with argument matching — exact, partial, wildcard, nested)
   - tool_order (sequence verification, allows interleaved calls)
   - tool_not_called (guardrails against dangerous actions)
   Use specific YAML examples for each.

4. Explain multi-turn tool simulation: how the test framework acts as both user 
   and external systems, running the agent loop until completion. 
   The "when/then" mock pattern.

5. Compare with LLM-as-judge: tool call assertions are faster (no API call), 
   cheaper (zero tokens), more reliable (no hallucination), more specific 
   (exact matching). They complement each other.

6. Introduce the concept of "Behavioral TDD" — write the assertions first, 
   then write the prompt that passes them. Same philosophy as test-driven 
   development, applied to AI.

The hosts should geek out on this. It's a technical deep-dive for builders.
Target 10-12 minutes.
```

---

## Distribution Strategy for Audio Episodes

### LinkedIn (Primary)

For each episode, create 3 short clips (60-90 seconds) as **native LinkedIn video**:
- Clip the most surprising stat, the best analogy, and the strongest conclusion
- Add captions (LinkedIn video autoplays muted)
- Post one clip per day across 3 days, then the full episode link

**Video post format:**
```
🎙️ New episode: [Title]

[1-sentence hook from the episode]

Full episode: [link in comments]

This is from my AI Agent Testing podcast — generated with NotebookLM 
from my research on [topic]. More at kindlm.com
```

### YouTube

- Upload full episodes as YouTube videos with a static image or simple waveform visual
- Add timestamps in description
- Title format: "KindLM Podcast EP01: The €35M Bug — AI Agent Testing"
- Playlist: "AI Agent Testing Deep Dives"

### Spotify / Apple Podcasts (Optional, Week 6+)

- Use Anchor.fm or Riverside for free podcast distribution
- RSS feed → Spotify, Apple, Google
- Consistent branding: "KindLM: The AI Agent Testing Podcast"

---

## Timeline

| Week | Episode | Paired With |
|------|---------|-------------|
| Week 1 | EP01: The €35M Bug | Article 1 + LinkedIn Post 1 |
| Week 2 | EP02: Engineering Discipline | Article 2 + LinkedIn Post 2 |
| Week 3 | EP03: Builder Story | Article 3 + LinkedIn Post 3 |
| Week 4 | EP04: EU AI Act Clock | Article 4 + LinkedIn Post 4 |
| Week 5 | EP05: Tool Call Assertions | Article 5 + LinkedIn Post 5 |
| Week 6 | Launch recap / Q&A episode | Launch content |
