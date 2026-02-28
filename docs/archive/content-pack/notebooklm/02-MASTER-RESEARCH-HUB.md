# Option 2: KindLM Master Research Hub — NotebookLM Configuration

## Purpose

A single, always-updated NotebookLM notebook that serves as the **content production engine** for all KindLM marketing, sales, and thought leadership. Upload everything once, then use it to generate new content on demand.

---

## Notebook Setup

### Notebook Name
`KindLM — Master Research Hub`

### Custom Goal (Configure Notebook → Gear Icon → Full 10,000 chars)

```
You are a senior developer relations strategist and technical writer for KindLM, 
an open-source CLI tool for testing AI agent behavior. Your knowledge covers:

PRODUCT:
- KindLM is a CLI-first, YAML-configured testing framework for AI agents
- Core differentiator: tool call assertions (tool_called, tool_not_called, tool_order)
- Also supports: LLM-as-judge, PII detection, schema validation, drift detection
- Open source (MIT) CLI, paid cloud dashboard (Team $49/mo, Enterprise $299/mo)
- Built in TypeScript, targets the AI agent ecosystem (OpenAI, Anthropic, Ollama)
- Generates EU AI Act Annex IV compliance documentation from test results
- Created by Petr Kindlmann, QA Automation Engineer with 4+ years Playwright experience

MARKET CONTEXT:
- No existing tool tests agent tool-calling behavior (Promptfoo, Braintrust, DeepEval test text output only)
- Promptfoo has $23.4M from a16z, positioned for security/red-teaming
- EU AI Act high-risk deadline: August 2, 2026 (€35M / 7% penalties)
- 80%+ AI projects fail before production (RAND), only 11% have agents in production (Deloitte 2026)
- 2025 saw major agent incidents: Replit DB deletion, Gemini CLI file deletion, Copilot data leaks

AUDIENCE:
- Primary: AI Engineers who build agent-based products (30-40 age range, senior IC to lead level)
- Secondary: CTOs/VPs Engineering worried about EU AI Act compliance
- Tertiary: QA Leads expanding into AI testing

VOICE & STYLE:
- Technical but accessible. Lead with data, not claims.
- No buzzwords: never use "revolutionary," "game-changing," "cutting-edge," "leverage"
- Show real YAML configs and terminal output when relevant
- Builder narrative: "I built this because..." not "You should use this because..."
- Cite specific numbers, incidents, and regulatory articles
- Be skeptical of AI hype. Acknowledge limitations honestly.

When I ask for content, generate it in this voice. When I ask for analysis, 
be specific and data-driven. When I ask for comparisons, be fair but highlight 
KindLM's unique capabilities clearly.
```

---

## Sources to Upload (Organized by Category)

### Category A: KindLM Documentation (11 sources)

Upload these as PDFs (convert .md → .pdf for better parsing):

| # | File | Content |
|---|------|---------|
| A1 | `01-README.md` | Product overview, quick start |
| A2 | `03-CONFIG_SCHEMA.md` | YAML configuration reference |
| A3 | `04-PROVIDER_INTERFACE.md` | Provider adapter pattern |
| A4 | `05-ASSERTION_ENGINE.md` | All 11 assertion types |
| A5 | `07-COMPLIANCE_SPEC.md` | EU AI Act report mapping |
| A6 | `09-CLI_REFERENCE.md` | CLI commands and options |
| A7 | `10-PRICING.md` | Free/Team/Enterprise tiers |
| A8 | `12-PRD.md` | Product requirements, personas, competitive positioning |
| A9 | `13-EPICS.md` | User stories and acceptance criteria |
| A10 | `16-TESTING_STRATEGY.md` | Internal testing approach |
| A11 | `20-ROADMAP.md` | Timeline and milestones |

### Category B: Published Articles (5 sources)

| # | Source | Type |
|---|--------|------|
| B1 | Article 1: "The €35M Bug" | URL (once published on Medium) |
| B2 | Article 2: "80% of AI Agents Fail" | URL |
| B3 | Article 3: "I Built an Open-Source Tool" | URL |
| B4 | Article 4: "EU AI Act Compliance Clock" | URL |
| B5 | Article 5: "Tool Call Assertions" | URL |

### Category C: Competitor Intelligence (6 sources)

| # | Source | URL |
|---|--------|-----|
| C1 | Promptfoo CBInsights | `https://www.cbinsights.com/company/promptfoo` |
| C2 | Braintrust: Best Eval Tools | `https://www.braintrust.dev/articles/best-prompt-evaluation-tools-2025` |
| C3 | ZenML: Promptfoo Alternatives | `https://www.zenml.io/blog/promptfoo-alternatives` |
| C4 | Getmaxim: Top Prompt Testing Tools | `https://www.getmaxim.ai/articles/top-5-prompt-testing-optimization-tools-in-2026/` |
| C5 | Comet: LLM Eval Frameworks | `https://www.comet.com/site/blog/llm-evaluation-frameworks/` |
| C6 | Braintrust: Prompt Management 2026 | `https://www.braintrust.dev/articles/best-prompt-management-tools-2026` |

### Category D: Market Intelligence (8 sources)

| # | Source | URL |
|---|--------|-----|
| D1 | Reworked: Year of the Agent | `https://www.reworked.co/digital-workplace/2025-was-supposed-to-be-the-year-of-the-agent-it-never-arrived/` |
| D2 | Composio: Why Pilots Fail | `https://composio.dev/blog/why-ai-agent-pilots-fail-2026-integration-roadmap` |
| D3 | Medium: Agents Fail Everywhere | `https://medium.com/analysts-corner/six-weeks-after-writing-about-ai-agents-im-watching-them-fail-everywhere-fb6636a4568e` |
| D4 | Stack Overflow: AI Bugs | `https://stackoverflow.blog/2026/01/28/are-bugs-and-incidents-inevitable-with-ai-coding-agents` |
| D5 | ISACA: AI Pitfalls 2026 | `https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents` |
| D6 | AI Incident Database | `https://incidentdatabase.ai/blog/incident-report-2025-august-september-october/` |
| D7 | Medium: Agentic Engineering | `https://medium.com/generative-ai-revolution-ai-native-transformation/2025-overpromised-ai-agents-2026-demands-agentic-engineering-5fbf914a9106` |
| D8 | IBM: AI Agents Reality | `https://www.ibm.com/think/insights/ai-agents-2025-expectations-vs-reality` |

### Category E: EU AI Act Regulation (5 sources)

| # | Source | URL |
|---|--------|-----|
| E1 | Official Timeline | `https://artificialintelligenceact.eu/implementation-timeline/` |
| E2 | SecurePrivacy Guide | `https://secureprivacy.ai/blog/eu-ai-act-2026-compliance` |
| E3 | Axis Intelligence News | `https://axis-intelligence.com/eu-ai-act-news-2026/` |
| E4 | DataGuard Timeline | `https://www.dataguard.com/eu-ai-act/timeline` |
| E5 | Digital Applied CZ/V4 Guide | `https://www.digitalapplied.com/blog/eu-ai-act-2026-compliance-european-business-guide` |

**Total: ~35 sources** (within free tier's 50-source limit)

---

## Content Generation Workflows

### Workflow 1: Generate New LinkedIn Posts

**Chat prompt:**
```
Based on all sources in this notebook, generate a LinkedIn post about [TOPIC]. 

Requirements:
- Opening hook: one punchy sentence that stops scrolling
- Body: 150-250 words, short paragraphs (1-2 sentences each)
- Include 2-3 specific data points with sources
- End with a subtle CTA pointing to KindLM
- No hashtags in the post body
- No emojis
- No links in the body (I'll add in first comment)

Topic: [e.g., "the difference between tracing and testing for AI agents"]
```

### Workflow 2: Generate Competitive Comparison Tables

**Chat prompt:**
```
Create a detailed comparison table of KindLM vs Promptfoo vs Braintrust vs DeepEval 
vs LangSmith across these dimensions:

1. Core focus (what problem does each solve?)
2. Tool call assertions (yes/no, what kind?)
3. CI/CD integration (how?)
4. Pricing model
5. Open source?
6. EU AI Act compliance features
7. Language/ecosystem
8. Funding/backing

Format as a clean markdown table. Be fair — acknowledge where competitors are 
stronger. Highlight KindLM's unique capabilities.
```

**Then export as Data Table → Google Sheets → screenshot for LinkedIn.**

### Workflow 3: Find New Content Angles

**Chat prompt:**
```
Analyze all sources in this notebook and identify 5 content topics I haven't 
covered yet that would resonate with AI engineers worried about agent reliability. 

For each topic:
- One-sentence pitch
- Key data point from sources that supports it
- How it connects to KindLM's value proposition
- Estimated engagement potential (high/medium/low) based on current discourse
```

### Workflow 4: Generate Conference Talk Outline

**Chat prompt:**
```
Create a 20-minute conference talk outline titled "Behavioral Testing for AI Agents: 
The Discipline That's Missing." Target audience: 200 developers at a European tech 
conference.

Structure:
- Hook (1 min)
- Problem with real examples (5 min)
- Why existing tools miss it (3 min)
- The solution framework (5 min)
- Live demo walkthrough (4 min)
- EU AI Act relevance (2 min)

For each section: key message, supporting data from sources, slide concept.
Include speaker notes with exact statistics to cite.
```

### Workflow 5: Generate Email Outreach Templates

**Chat prompt:**
```
Write 3 cold outreach email templates for reaching:

1. DevRel leads at AI companies (pitch: "your users need this testing tool")
2. Engineering managers at EU-based companies (pitch: "EU AI Act compliance deadline")
3. Tech conference organizers (pitch: "I have a talk on the biggest gap in AI tooling")

Each email: max 150 words, specific to KindLM, includes one compelling data point, 
clear ask. No generic openers.
```

### Workflow 6: Weekly Trend Monitoring

**Chat prompt (run weekly):**
```
Based on all sources, what are the most important developments this week in:
1. AI agent failures or incidents
2. EU AI Act enforcement updates
3. Competitor moves (Promptfoo, Braintrust, DeepEval)
4. New tools or frameworks entering the AI testing space

For each, suggest: should I write a reactive LinkedIn post about this? If yes, 
draft a hook.
```

### Workflow 7: Generate Slide Decks

Use NotebookLM Studio Panel → Slide Deck:
- **Investor pitch deck:** Select sources A8 (PRD), A10 (Pricing), A11 (Roadmap), C1 (Promptfoo funding)
- **Product overview deck:** Select A1 (README), A4 (Assertions), A6 (CLI), A7 (Compliance)
- **EU AI Act briefing deck:** Select E1-E5, A7 (Compliance)

### Workflow 8: Generate Data Tables for Infographics

**Chat prompt:**
```
Extract every statistic, percentage, and numerical finding across all sources 
about AI agent failures and EU AI Act compliance. 

Format as a data table with columns:
- Stat (exact number)
- What it measures
- Source
- Date/year
- Relevance to KindLM messaging

Sort by impact (most compelling first).
```

**Export to Sheets → use for infographic creation.**

---

## Maintenance Schedule

| When | Action |
|------|--------|
| **Weekly** | Add new competitor blog posts or market articles as sources |
| **After each article** | Add published Medium URL as source |
| **Monthly** | Run Workflow 6 trend analysis |
| **Before any content** | Quick chat: "What's the most relevant data for [topic]?" |
| **After launch** | Add GitHub README, npm page, and user testimonials as sources |

---

## Deep Research Mode Usage

NotebookLM's Deep Research combines your notebook sources with web search. Use for:

- "What new AI agent incidents have been reported in the last 30 days?"
- "What has Promptfoo announced recently?"
- "Are there any new EU AI Act enforcement actions?"
- "What AI testing tools have launched since January 2026?"

This is your **competitive intelligence radar** — run it weekly before writing new content.

---

## Data Table Export Recipes

### Recipe 1: Competitor Feature Matrix
```
Create a data table comparing features of these tools mentioned in my sources:
KindLM, Promptfoo, Braintrust, DeepEval, LangSmith, Langfuse

Columns: Tool, Tool Call Assertions, Drift Detection, EU Compliance, 
CI Integration, Pricing, Open Source, Primary Focus
```

### Recipe 2: AI Incident Timeline
```
Create a data table of every AI agent incident mentioned across all sources.
Columns: Date, Company/Product, What Happened, Root Cause Category, 
Could Behavioral Testing Have Caught It (yes/no/partial)
```

### Recipe 3: EU AI Act Article-to-Engineering Mapping
```
Create a data table mapping EU AI Act articles to engineering requirements.
Columns: Article Number, Article Name, What It Requires, 
Engineering Work Needed, KindLM Feature That Helps, Priority (P0/P1/P2)
```

Export all as Google Sheets → screenshot the best ones for LinkedIn carousels.
