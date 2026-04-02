# KindLM — Product Requirements Document

**Version:** 1.0  
**Last updated:** February 2026  
**Author:** Petr Kindlmann  
**Status:** Active

---

## 1. Problem Statement

Teams building AI agents (support bots, fintech copilots, HR screeners, medical triage) have no reliable way to test agent **behavior** before deploying. Existing tools test text output quality, but agents make decisions — they call tools, route conversations, approve transactions, escalate tickets. A prompt change on Friday can silently break tool call logic by Monday. No errors fire. No alerts trigger. The output looks fine. The behavior is wrong.

Compounding this: the EU AI Act (Regulation 2024/1689) requires companies deploying high-risk AI systems to maintain test documentation by **August 2, 2026**. Penalties reach 7% of global annual revenue. Most companies have no tooling to generate this documentation from their existing test processes.

---

## 2. Product Vision

KindLM is a CLI-first testing framework that lets engineering teams define behavioral tests for AI agents in YAML and run them locally or in CI. It tests what agents **do** (tool calls, structured output, guardrail compliance), not just what they **say** (text quality). It also generates EU AI Act–aligned compliance documentation from test results.

**One-liner:** Regression tests for AI agents — tool calls, output quality, and compliance. Defined in YAML, run in CI.

---

## 3. Target Users

### Primary: AI Engineer (Individual Contributor)

- **Profile:** Works at a Series A–C startup (20–200 people). Writes Python + TypeScript. Uses Claude or GPT-4o APIs. Builds agentic features — support bots, internal copilots, data pipelines with LLM steps.
- **Pain:** Prompt changes break agent behavior silently. No test framework understands tool calls. Existing eval tools (Promptfoo, Braintrust) test text, not agent decisions.
- **Discovery:** GitHub, Hacker News, Twitter/X, dev newsletters.
- **Trigger:** A production incident where an agent did the wrong thing after a prompt update.
- **What they need:** `npm install`, write YAML, run `kindlm test`, get pass/fail in CI. Under 10 minutes to first test.

### Secondary: Compliance-Anxious CTO

- **Profile:** VP Engineering or CTO at a European (or EU-serving) company in fintech, healthtech, or HR-tech. 50–500 employees. Already uses AI in production. Aware of EU AI Act but hasn't started compliance work.
- **Pain:** August 2026 deadline approaching. Legal team flagged risk. No idea how to generate required test documentation. Compliance consultants quote €50K+.
- **Discovery:** LinkedIn, compliance newsletters, CTO peer groups, conferences.
- **Trigger:** Board meeting or legal review flags EU AI Act risk.
- **What they need:** `--compliance` flag that generates auditor-ready documentation. Cloud dashboard their compliance officer can access.

### Tertiary: QA Lead Adding AI Coverage

- **Profile:** Leads QA at a company with established test culture (Playwright, Cypress, Jest). Company is adding AI features. Responsible for "how do we test the AI?"
- **Pain:** Traditional test frameworks can't assert on non-deterministic LLM behavior. Can't write `expect(response).toBe(...)` for AI output.
- **Discovery:** Testing communities, QA conferences, team Slack channels.
- **Trigger:** Manager asks "how do we test the AI features?"
- **What they need:** Familiar patterns (YAML config, assertions, CI integration, JUnit XML). Feels like a testing tool, not an ML platform.

---

## 4. Product Scope

### In Scope (v1.0 — MVP)

| Feature | Description |
|---------|-------------|
| YAML config | Define test suites, providers, assertions in `kindlm.yaml` |
| Provider adapters | OpenAI, Anthropic, Ollama |
| Tool call assertions | Assert which tools were called, with what args, in what order |
| Schema assertions | Validate structured output against JSON Schema (AJV) |
| LLM-as-judge | Score responses against natural language criteria |
| PII detection | Regex-based SSN, credit card, email, phone, IBAN detection |
| Keyword guardrails | Required/forbidden phrases |
| Drift detection | Compare against stored baselines |
| Latency + cost assertions | Performance and budget guardrails |
| Multi-run aggregation | Run each test N times, aggregate scores |
| Pass/fail gates | Configurable thresholds for pass rate, schema failures |
| Terminal reporter | Colored, readable output |
| JSON reporter | Full structured report for programmatic use |
| JUnit XML reporter | Drop into any CI system |
| Compliance reporter | EU AI Act Annex IV markdown document |
| Baseline management | Save, compare, list baselines |
| CLI commands | init, validate, test, baseline |
| CI integration | Exit codes, env detection, JUnit output |

### In Scope (v2.0 — Cloud)

| Feature | Description |
|---------|-------------|
| Cloud dashboard | Web UI for test history, trends, team visibility |
| Upload from CLI | `kindlm upload` or `--upload` flag |
| Team management | Org, members, roles |
| Plan gating | Free / Team / Enterprise feature limits |
| Compliance PDF | Branded PDF export of compliance reports |
| Webhooks | Slack and webhook notifications on failures |
| GitHub OAuth | Authentication via GitHub |

### In Scope (v3.0 — Enterprise)

| Feature | Description |
|---------|-------------|
| SSO / SAML | Enterprise auth integration |
| Audit log API | Queryable compliance audit trail |
| Signed reports | Digitally signed compliance documents |
| Stripe billing | Self-serve plan management |
| SLA | 99.9% uptime guarantee |

### Out of Scope (Not Building)

| What | Why |
|------|-----|
| Training data management | Out of domain — KindLM tests inference, not training |
| Prompt engineering / optimization | KindLM tests prompts, doesn't write them |
| Model fine-tuning | Not a training tool |
| Full GRC platform | KindLM generates test artifacts, not policies or risk assessments |
| Real-time monitoring / observability | KindLM runs discrete test suites, not continuous monitoring |
| A/B testing in production | KindLM tests in pre-deployment or CI, not in production traffic |
| Visual UI for writing tests | CLI + YAML is the interface. No drag-and-drop test builder. |

---

## 5. Success Metrics

### North Star Metric
**Weekly active test runs** (opt-in anonymous telemetry). A test run = one execution of `kindlm test`. This measures real adoption, not vanity metrics.

### Leading Indicators

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| GitHub stars | 500 | 2,000 | 5,000 |
| npm weekly downloads | 100 | 500 | 2,000 |
| Blog monthly visitors | 1,000 | 5,000 | 20,000 |
| YouTube subscribers | 100 | 500 | 2,000 |
| Twitter/X followers | 300 | 1,000 | 3,000 |
| Discord/community members | 50 | 200 | 500 |

### Revenue Metrics (Post-Cloud Launch)

| Metric | Month 6 | Month 12 |
|--------|---------|----------|
| Free CLI users | 5,000 | 15,000 |
| Team plan subscribers | 100 | 300 |
| Enterprise subscribers | 10 | 30 |
| MRR | $7,890 | $23,670 |

### Quality Metrics

| Metric | Target |
|--------|--------|
| Time to first test (new user) | < 10 minutes |
| CLI cold start time | < 2 seconds |
| Test execution overhead (vs raw API call) | < 15% |
| Issue response time | < 24 hours |
| PR review turnaround | < 48 hours |

---

## 6. User Journeys

### Journey 1: First Test (AI Engineer)

1. Finds KindLM via GitHub search for "AI agent testing" or Hacker News post
2. Reads README — sees YAML config example, recognizes testing patterns
3. Runs `npm i -g @kindlm/cli && kindlm init`
4. Edits `kindlm.yaml` — points at their existing system prompt, writes 2–3 test cases
5. Runs `kindlm test` — sees green/red terminal output in 30 seconds
6. Adds `kindlm test --reporter junit` to their GitHub Actions workflow
7. Commits, PR passes CI with KindLM check — done

**Success criteria:** Steps 2–7 complete in under 10 minutes. No account needed. No API key for KindLM.

### Journey 2: Compliance Report (CTO)

1. Engineer on their team is already using KindLM for testing
2. CTO learns about `--compliance` flag from a blog post or LinkedIn article
3. Engineer adds `compliance` section to existing `kindlm.yaml`
4. Runs `kindlm test --compliance` — gets markdown report mapping tests to EU AI Act articles
5. CTO shares report with legal team — legal says "this covers most of Annex IV, we need it stored and signed"
6. Team signs up for KindLM Cloud Enterprise ($299/mo)
7. `kindlm upload` sends reports to Cloud. Compliance officer gets dashboard access.

**Success criteria:** Steps 3–4 add < 5 minutes to existing workflow. Report is useful to legal without modification.

### Journey 3: CI Pipeline (QA Lead)

1. QA lead evaluates KindLM alongside Promptfoo and Braintrust
2. Reads assertions doc — sees tool call assertions (unique to KindLM)
3. Writes test suite for their customer support agent (10 test cases)
4. Sets up GitHub Actions job: `kindlm test --reporter junit --gate 90`
5. PR fails because agent stopped calling `lookup_order` — exactly the kind of bug they were looking for
6. Team adopts KindLM as standard AI test framework
7. Upgrades to Team plan when they want shared dashboard

**Success criteria:** Evaluation to adoption in < 1 week. JUnit XML integrates with existing CI reporting.

---

## 7. Competitive Positioning

### Positioning Statement

KindLM is the testing framework for AI agents that tests what agents **do** (tool calls, decisions, behavior), not just what they **say** (text output). Plus, it generates the compliance documentation your legal team will need by August 2026. One CLI. YAML config. Open source.

### Competitive Matrix

| Capability | KindLM | Promptfoo | Braintrust | DeepEval | LangSmith |
|-----------|--------|-----------|------------|----------|-----------|
| Tool call assertions | ✓ | — | — | — | — |
| YAML-first config | ✓ | ✓ | — | — | — |
| LLM-as-judge | ✓ | ✓ | ✓ | ✓ | ✓ |
| Schema validation | ✓ | ✓ | — | — | — |
| PII detection | ✓ | — | — | — | — |
| Drift detection | ✓ | — | — | — | — |
| EU AI Act compliance reports | ✓ | — | — | — | — |
| CI-native (JUnit XML) | ✓ | ✓ | — | — | — |
| Multi-model comparison | ✓ | ✓ | ✓ | ✓ | — |
| Open source CLI | ✓ (MIT) | ✓ (MIT) | — | ✓ (Apache) | — |
| TypeScript-first | ✓ | ✓ | — | — (Python) | — (Python) |
| No account required | ✓ | ✓ | — | ✓ | — |

### Key Differentiators

1. **Tool call assertions** — Only KindLM can assert which tools an agent called, with what arguments, in what order. This is the core differentiator.
2. **Compliance reports** — Built-in EU AI Act Annex IV documentation generation. No competitor offers this.
3. **YAML + CLI simplicity** — No SDK to learn. Any engineer can read the config and write tests.
4. **Open-core with generous free tier** — Full CLI forever free. Cloud is additive, not gated.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EU AI Act deadline delayed | Low | Medium | Testing value stands without compliance. Pivot messaging to "prepare regardless." |
| Promptfoo adds tool call assertions | Medium | High | Ship compliance features fast — that's harder to copy. Build community moat. |
| AI-generated content detected as "slop" | Medium | Medium | Every piece of marketing shows real terminal output and real code. Authenticity first. |
| Low GitHub adoption (< 200 stars in 6 weeks) | Medium | High | Validate PMF early. If < 200 stars, revisit positioning before investing in Cloud. |
| Cloud costs exceed revenue | Low | Medium | Cloudflare Workers + D1 is near-zero cost at low scale. Don't build Cloud until CLI has traction. |
| Provider API changes break adapters | Medium | Low | Adapter pattern isolates changes. Community can contribute fixes. |
| Open-source fork competes | Low | Medium | Stay ahead on compliance features. Build brand and community trust. AGPL on cloud prevents easy SaaS forks. |

---

## 9. Launch Plan

### Phase 1: MVP Launch (Weeks 1–6)

- Ship CLI with all Phase 1 features
- GitHub repo public, npm published
- 5 blog posts, 3 YouTube tutorials
- Show HN post
- Target: 500 GitHub stars, 100 npm weekly downloads

### Phase 2: Cloud Beta (Weeks 7–12)

- Cloud dashboard MVP (test history, trends)
- Invite 20 beta users from CLI community
- Product Hunt launch (week 10)
- Compliance content push (EU AI Act deadline approaching)
- Target: 2,000 GitHub stars, 50 Cloud signups

### Phase 3: General Availability (Weeks 13–18)

- Cloud GA with billing (Stripe)
- Enterprise features (SSO, audit log, signed reports)
- Conference talks (local Prague/Berlin events)
- Target: 5,000 GitHub stars, 100 paying teams

---

## 10. Open Questions

| Question | Owner | Deadline |
|----------|-------|----------|
| Should we support custom assertion plugins (user-defined)? | Petr | Before v1.0 |
| What's the right default for `runs` — 1 or 3? | Petr | Before v1.0 |
| Should compliance reports be a separate CLI command or always a flag? | Petr | Before v1.0 |
| Is AGPL the right license for Cloud, or BSL (Business Source License)? | Petr | Before Cloud launch |
| Should we offer annual pricing (discount)? | Petr | Before Cloud GA |
| Do we need a Discord or is GitHub Discussions sufficient? | Petr | Week 2 |
