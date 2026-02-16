# KindLM Pricing & Business Model

## Open-Core Model

KindLM follows an open-core model. The CLI and core library are MIT-licensed and free forever. Revenue comes from KindLM Cloud — a paid SaaS layer that adds team collaboration, test history, compliance storage, and enterprise features.

**Principle:** The CLI solves the engineering problem for free. Cloud solves the organizational problem for money.

---

## Plans

### Open Source — $0/forever

Everything a developer or small team needs to test AI agents locally and in CI.

**Includes:**
- All assertion types (tool calls, schema, judge, PII, drift, keywords, latency, cost)
- All provider adapters (OpenAI, Anthropic, Ollama, custom)
- Compliance report generation (local markdown with SHA-256 hashes)
- JUnit XML, JSON, and pretty terminal reporters
- Baseline comparison and drift detection
- Multi-model testing
- Unlimited local test runs
- MIT license

**Distribution:**
- `npm install -g @kindlm/cli`
- GitHub: `github.com/kindlm/kindlm`

### Team — $49/month

For engineering teams that need visibility, collaboration, and compliance workflows.

**Includes everything in Open Source, plus:**
- Cloud dashboard with test history (90-day retention)
- Up to 10 team members
- Up to 5 projects
- Slack and webhook notifications
- Compliance PDF export with company branding
- Email support
- 1,000 API requests/hour

**Target buyer:** Engineering lead or VP Engineering at a Series A–C startup using AI agents.

### Enterprise — $299/month

For regulated companies that need audit-grade compliance and enterprise controls.

**Includes everything in Team, plus:**
- Unlimited test history retention
- Unlimited team members and projects
- Digitally signed compliance reports
- SSO / SAML authentication
- Audit log API (queryable by auditors)
- 99.9% SLA
- Dedicated support channel
- 10,000 API requests/hour
- Custom data retention policies

**Target buyer:** CTO or VP Engineering at a fintech, healthtech, or HR-tech company subject to EU AI Act.

---

## Revenue Projections

Conservative estimates assuming 5,000 CLI users by month 6:

| Metric | Month 6 | Month 12 |
|--------|---------|----------|
| CLI users (free) | 5,000 | 15,000 |
| Team conversions (2%) | 100 | 300 |
| Enterprise conversions (0.2%) | 10 | 30 |
| Team MRR | $4,900 | $14,700 |
| Enterprise MRR | $2,990 | $8,970 |
| **Total MRR** | **$7,890** | **$23,670** |

---

## Additional Revenue Streams

### Consulting ($150–250/hour)
Help companies set up AI testing and compliance workflows. You're the expert on the tool and the EU AI Act deadline.

### Training Workshops (€500–1,000/seat)
"AI Agent Testing for EU AI Act Compliance" — run in Prague, Berlin, or remotely. Target 10–20 attendees per session.

### Compliance Template Packs ($49–199 each)
Pre-built test suites for specific industries:
- Fintech: transaction approval, credit scoring, fraud detection
- Healthtech: triage, symptom checking, appointment booking
- HR-tech: resume screening, interview scheduling, offer generation

---

## What Stays Free (Forever)

These features will NEVER be moved behind a paywall:
- All assertion types
- All provider integrations
- CLI test execution (unlimited runs)
- Local compliance report generation
- JUnit XML / JSON reporters
- Baseline comparison
- Multi-model testing

---

## What NOT To Do

- Don't put core assertion features behind a paywall (developers will fork)
- Don't add usage limits to the CLI (feels hostile)
- Don't charge for provider integrations (kills adoption)
- Don't relicense later (MongoDB/Elastic community backlash)
- Don't gate CI integration (CI-native is a selling point)

---

## Competitive Pricing Comparison

| Tool | Free Tier | Paid Starting |
|------|-----------|---------------|
| KindLM | Full CLI, all features | $49/mo (Cloud) |
| Promptfoo | Open source CLI | Custom pricing (cloud) |
| Braintrust | Limited free tier | $25/user/mo |
| LangSmith | 5K traces/mo | $39/seat/mo |
| Arize Phoenix | Open source | Custom enterprise |

KindLM's positioning: most generous free tier (full CLI, no limits) with the clearest compliance story.
