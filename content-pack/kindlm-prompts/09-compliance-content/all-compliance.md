# Compliance Content Prompts

These prompts produce EU AI Act focused content. Deploy during May-July 2026 for maximum urgency as the August 2 deadline approaches.


---


## COMPLIANCE BLOG 01: "EU AI Act Annex IV Checklist for Engineering Teams"

SYSTEM: You are a technical writer who has read the full EU AI Act regulation. Write for engineering leads who need to understand what their team must produce. No legal advice. Just the engineering requirements in plain language.

Write a blog post titled "EU AI Act Annex IV: The Engineering Checklist."

For each Annex IV requirement, provide:
- The actual requirement (paraphrased, not quoted)
- What this means your engineering team needs to produce
- How to automate it (with KindLM where applicable, or manually where not)

Requirements to cover:
1. General description of the AI system
2. Detailed description of elements and development process
3. Information about monitoring, functioning, and control
4. Description of risk management system
5. Description of changes throughout lifecycle
6. List of applied harmonised standards
7. Description of testing procedures and results
8. Description of measures to address bias
9. Input data requirements
10. Pre-market testing and validation measures

For items 7, 8, and 10, show specific KindLM YAML configs and CLI commands.

Length: 2,500-3,000 words. Include a downloadable-ready checklist summary at the end.


---


## COMPLIANCE BLOG 02: "How to Generate Audit-Ready AI Test Reports"

SYSTEM: Write as a DevOps/QA engineer who has been through a compliance audit before (GDPR, SOC2, etc.) and knows what auditors actually want.

Title: "How to Generate Audit-Ready AI Test Reports with KindLM"

Cover: What auditors look for (timestamped evidence, reproducibility, methodology documentation, coverage metrics). Why Jupyter notebooks and Slack threads don't count. Step-by-step: set up KindLM, write comprehensive test suite, run with --compliance, store reports per release. Show the actual report structure — what each section contains. How to integrate into release process so reports auto-generate on every deployment.

Length: 2,000 words. Include complete CI/CD workflow YAML.


---


## COMPLIANCE BLOG 03: Industry-specific — "Testing Fintech AI for EU AI Act Compliance"

SYSTEM: Write for a CTO or VP Engineering at a fintech company that uses AI for credit scoring or fraud detection. These are explicitly Annex III high-risk systems.

Title: "Your AI Credit Scoring System Needs Compliance Tests by August 2026"

Cover: Why credit scoring AI is explicitly high-risk under Annex III. The specific testing requirements. Build a complete KindLM test suite for a loan application agent: test tool calls to credit_check and verify_identity, assert that decisions include explanations, detect discriminatory patterns in output, check PII handling. Show full YAML. Show compliance report output.

Length: 2,500 words.


---


## COMPLIANCE BLOG 04: Industry-specific — "Testing HR-Tech AI for EU AI Act"

Same structure as above but for a resume screening AI agent. Cover: why employment AI is Annex III high-risk, testing for bias in screening decisions, ensuring candidate explanations are provided, PII handling of CV data.

Length: 2,500 words.


---


## COMPLIANCE HEYGEN VIDEO: "EU AI Act Compliance in 10 Minutes" (5-part mini-series)

Paste each into Claude to generate the HeyGen script. Same avatar settings as 01-heygen-videos.

### Part 1: "What is the EU AI Act?" (2 min)
Script prompt: Explain the EU AI Act in 2 minutes for an engineer. What it is, when it hits, who it affects. Use the analogy: "GDPR was for data. This is for AI decisions." Short sentences for HeyGen avatar. Include [pause] markers.

### Part 2: "Is Your AI System High-Risk?" (2 min)
Script prompt: Walk through Annex III categories in 2 minutes. For each category, give one concrete example. End with: "If you recognized your product in any of these, watch part 3."

### Part 3: "What Documentation Do You Need?" (2 min)
Script prompt: Cover Annex IV documentation requirements in 2 minutes. Translate each to an engineering artifact. End with: "Most of this can be automated. That's part 4."

### Part 4: "Automate Compliance Testing" (2 min)
Script prompt: Show KindLM --compliance workflow in 2 minutes. [SCREEN] markers for terminal recording overlay. Cover: write tests, run with flag, generated report, CI integration.

### Part 5: "Your 90-Day Action Plan" (2 min)
Script prompt: Give a concrete timeline. Month 1: inventory AI systems, classify risk. Month 2: write test suites, run first compliance reports. Month 3: integrate into CI, set up monitoring, review with legal. End with links.


---


## COMPLIANCE TWITTER THREAD: "90 days to EU AI Act — a week-by-week breakdown"

Paste into Claude:

Write a 7-tweet thread providing a week-by-week action plan for engineering teams preparing for EU AI Act compliance in the 90 days before August 2, 2026.

Tweet 1: Hook — "90 days until EU AI Act enforcement. Here's exactly what your engineering team should do each week."

Tweets 2-6: Two-week blocks with specific actions: inventory, classify, test, document, monitor.

Tweet 7: "The teams that start now will be ready. The teams that wait will spend 10x more in July." Link to compliance guide.

No emojis except ✓. No hashtags.


---


## COMPLIANCE LINKEDIN: Weekly countdown series

Paste each into Claude. Publish weekly from May through July 2026.

### Week 12 before deadline
"12 weeks until the EU AI Act enforces high-risk system compliance. This week's task: inventory every AI system in your organization. List: system name, purpose, data inputs, decisions made, users affected. You can't classify risk if you don't know what you're running. What's your current AI system count?"

### Week 8 before deadline
"8 weeks. Your AI system inventory should be done. This week: classify each system by risk tier. If it touches hiring, credit, medical, education, or law enforcement — it's high-risk under Annex III. Start writing tests now, not documentation. Tests generate documentation. How many high-risk systems did you find?"

### Week 4 before deadline
"4 weeks. If your automated test suite isn't running in CI yet, this is the week. Every deploy after August 2 needs documented test evidence. Retrofitting is harder than building it in. Where are you on test automation?"

### Week 1 before deadline
"Next week, EU AI Act enforcement begins for high-risk AI systems. If you've been running compliance tests in CI for the past few months, you're ready. If not — start today. Even one month of documented test runs is better than zero. What's your final preparation step this week?"
