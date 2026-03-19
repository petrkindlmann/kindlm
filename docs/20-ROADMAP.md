# KindLM — Roadmap & Timeline

**Planning assumptions:**
- Solo developer (Petr), ~20 hrs/week dedicated to KindLM
- Claude Code handles bulk of implementation from specs
- "Week 1" = first week of active development
- Dates are relative — anchor Week 1 to actual start date

---

## Phase 1: MVP (Weeks 1–8) — COMPLETED

**Goal:** Ship a working CLI that someone can `npm install`, write YAML, and get pass/fail in CI. Show HN.

### Week 1–2: Foundation

| Task | Epic | Deliverable |
|------|------|-------------|
| Monorepo setup (Turborepo, npm workspaces, tsup, Vitest) | — | Build passes, test runner works |
| Config parser (YAML → Zod validated typed config) | 1 | `kindlm validate` works |
| Provider adapter interface + OpenAI adapter | 2 | Can call GPT-4o and get typed response |
| Anthropic adapter | 2 | Can call Claude and get typed response |
| Basic test engine (single run, single suite) | 1 | `kindlm test` executes one test |

**Milestone:** `kindlm test` runs one test against one provider and prints result.

### Week 3–4: Assertions

| Task | Epic | Deliverable |
|------|------|-------------|
| `tool_called` assertion | 2 | Verify tool name + args |
| `tool_not_called` assertion | 2 | Verify tool absence |
| `tool_order` assertion | 2 | Verify tool sequence |
| `schema` assertion (AJV) | 2 | Validate JSON output against schema |
| `judge` assertion (LLM-as-judge) | 2 | Score responses with criteria |
| `no_pii` assertion | 2 | Detect SSN, CC, email, phone, IBAN |
| `keywords_present` / `keywords_absent` | 2 | Keyword guardrails |
| `latency` / `cost` assertions | 2 | Performance gates |
| Multi-turn tool simulation | 2 | Tool response injection loop |

**Milestone:** All 11 assertion types working. Full test suite against mock providers passes.

### Week 5–6: Reporters & CLI

| Task | Epic | Deliverable |
|------|------|-------------|
| Terminal reporter (colored output) | 3 | Pretty pass/fail in terminal |
| JSON reporter | 3 | Structured report file |
| JUnit XML reporter | 3 | CI-compatible output |
| Compliance reporter (markdown) | 5 | EU AI Act Annex IV document |
| Multi-run aggregation (N runs per test) | 2 | Configurable `runs` count |
| Pass/fail gates | 3 | `--gate 90` sets threshold |
| `kindlm init` command (scaffolding) | 1 | Creates starter `kindlm.yaml` |
| `kindlm validate` command | 1 | Config validation without API calls |
| Suite/test filtering (`-s`, `-t`, `--grep`) | 1 | Run subset of tests |
| Ollama adapter | 2 | Local model support |

**Milestone:** Full CLI feature-complete. Can init, validate, test, filter, report.

### Week 7: Baselines & Polish

| Task | Epic | Deliverable |
|------|------|-------------|
| `kindlm baseline set` | 4 | Save current results |
| `kindlm baseline compare` | 4 | Diff against baseline |
| `kindlm baseline list` | 4 | Show saved baselines |
| `drift` assertion | 4 | Semantic drift detection |
| Multi-provider comparison | 6 | Same tests across models |
| CI auto-detection (GitHub Actions, GitLab CI) | 3 | Git metadata in reports |
| Error messages polish | — | Actionable, friendly errors |
| README with examples | — | Install → first test in README |

**Milestone:** Complete MVP. All features working, documented, tested.

### Week 8: Launch

| Task | Epic | Deliverable |
|------|------|-------------|
| npm publish `@kindlm/core` + `@kindlm/cli` v0.1.0 | — | Package live on npm |
| GitHub repo public | — | MIT licensed, stars welcome |
| Landing page live (kindlm.com) | — | React landing page deployed |
| Show HN post | — | Launch post with demo |
| Blog post: "Why we built KindLM" | — | Origin story, problem statement |
| Twitter/X announcement thread | — | 5-tweet thread with terminal GIF |
| YouTube: "First test in 5 minutes" tutorial | — | Quick start video |

**Milestone:** Public launch. Target 200+ GitHub stars in first week.

---

## Phase 2: Cloud Beta (Weeks 9–14) — COMPLETED

**Goal:** Ship Cloud dashboard for test history, trends, and team collaboration. Validate willingness to pay.

### Week 9–10: Cloud API

| Task | Epic | Deliverable |
|------|------|-------------|
| Cloudflare Workers + Hono setup | 7 | `/v1/health` responds |
| D1 schema + migrations | 7 | All tables created |
| GitHub OAuth flow | 7 | `kindlm login` works |
| Token generation + auth middleware | 7 | Authenticated API calls |
| `POST /v1/runs/upload` | 7 | CLI can upload results |
| `GET /v1/projects`, CRUD | 7 | Project management |
| `GET /v1/projects/:id/runs` (list, filter) | 7 | Run history with pagination |
| Rate limiting middleware | 7 | Per-org limits enforced |
| Plan gating middleware | 7 | Free/Team/Enterprise limits |

**Milestone:** API complete. CLI can login, upload, and API returns historical data.

### Week 11–12: Dashboard

| Task | Epic | Deliverable |
|------|------|-------------|
| Dashboard app setup (React + Cloudflare Pages) | 7 | `cloud.kindlm.com` loads |
| Login page (GitHub OAuth redirect) | 7 | User can authenticate |
| Project list view | 7 | See all projects |
| Run history view (table + pass rate chart) | 7 | See trends over time |
| Run detail view (assertion breakdown) | 7 | Click into specific run |
| Run comparison view (diff against baseline) | 7 | Side-by-side comparison |
| Responsive mobile layout | 7 | Works on phone |

**Milestone:** Dashboard usable. Beta testers can see their test history.

### Week 13–14: Beta & Content — PARTIALLY COMPLETED

| Task | Epic | Status | Deliverable |
|------|------|--------|-------------|
| Invite 20 beta testers from CLI users | — | Pending | Real usage data |
| Webhook notifications (run.completed, run.failed) | 7 | **Done** | HMAC-signed webhook dispatch |
| Team management (invite, roles) | 7 | **Done** | Multi-user orgs (owner/admin/member) |
| Data retention cron | 7 | **Done** | Auto-cleanup per plan (daily at 02:00 UTC) |
| GitHub OAuth flow | 7 | **Done** | `kindlm login` → browser → token paste |
| Blog: "EU AI Act compliance with KindLM" | — | Pending | Compliance content push |
| Product Hunt launch | — | Pending | Cloud announcement |
| Blog: "From CLI to Cloud" | — | Pending | Cloud launch story |
| YouTube: "Team dashboard walkthrough" | — | Pending | Feature demo |

**Milestone:** Cloud beta live with 20 users. Product Hunt launch. Collecting feedback.

---

## Phase 3: GA & Monetization (Weeks 15–22) — IN PROGRESS

**Goal:** Turn on billing, ship enterprise features, reach $7,890 MRR by month 6.

### Week 15–16: Billing — COMPLETED

| Task | Epic | Status | Deliverable |
|------|------|--------|-------------|
| Stripe integration (Team plan $49/mo) | 9 | **Done** | Self-serve upgrade via Stripe Checkout |
| Billing API endpoints | 9 | **Done** | GET /billing, POST /checkout, POST /portal |
| Stripe webhook handler | 9 | **Done** | Automatic plan activation on payment |
| Plan upgrade/downgrade flow | 9 | **Done** | Immediate feature access change |
| Enterprise contact form | 9 | Pending | "Contact us" → Slack notification |
| Compliance PDF export (Team+) | 5 | Pending | Branded PDF download |

**Milestone:** Revenue! Stripe billing active.

### Week 17–18: Enterprise Features

| Task | Epic | Deliverable |
|------|------|-------------|
| SSO / SAML integration | 8 | Okta, Azure AD support |
| Audit log API | 8 | Queryable compliance trail |
| Signed compliance reports (Ed25519) | 8 | Tamper-proof reports |
| SLA monitoring setup | — | 99.9% uptime tracking |

**Milestone:** Enterprise tier feature-complete. Ready for regulated companies.

### Week 19–20: Growth

| Task | Epic | Deliverable |
|------|------|-------------|
| Documentation site (docs.kindlm.com) | — | Full docs with search |
| "AI Agent Testing Guide" (SEO content) | — | Organic traffic driver |
| Conference talk (local Prague/Berlin) | — | In-person credibility |
| Plugin system for custom assertions | — | Community extensibility |
| GitHub Actions marketplace action | 3 | One-click CI setup |
| VS Code extension (YAML autocomplete) | — | DX improvement |

**Milestone:** Organic growth flywheel active. Community contributing.

### Week 21–22: Optimization — PARTIALLY COMPLETED

| Task | Epic | Status | Deliverable |
|------|------|--------|-------------|
| Performance optimization (parallel test execution) | — | Pending | Faster runs |
| Additional providers (Google Gemini, Mistral, Cohere) | 2 | **Done** | 6 total providers |
| Webhook integrations (Teams, Discord, PagerDuty) | 7 | Pending | Beyond Slack |
| Annual pricing option | 9 | Pending | Discount for commitment |
| Customer interviews (10 paying users) | — | Pending | Roadmap input |

**Milestone:** Stable product, growing revenue, clear roadmap for H2.

---

## 30-Day Launch Plan (March 2026)

Positioning: "We built a CLI for catching agent regressions that don't show up in final-output checks — wrong tool calls, wrong args, schema drift."

### Days 1–7: Adoption path

| Task | Status | Deliverable |
|------|--------|-------------|
| "Adopt KindLM in 30 Minutes" guide | **Done** | `/docs/adopt` — strict install → test → CI funnel |
| KindLM vs Promptfoo vs Custom Scripts | **Done** | `/docs/comparison` — honest positioning |
| Refund agent tutorial | **Done** | `/docs/tutorial` — real-world tool-call testing |
| CI guide: GitHub Actions in 5 minutes | **Done** | `/docs/ci-guide` — copy-paste workflow |
| Sync README with new docs | Pending | Links to adopt guide, comparison, tutorial |

**Goal:** Someone who finds KindLM can go from zero to CI in one sitting.

### Days 8–14: Credibility

| Task | Status | Deliverable |
|------|--------|-------------|
| Examples gallery (7 polished configs) | **Done** | `/docs/examples` — support, RAG, codegen, multi-model, compliance, brand, Ollama |
| "How to model my system" decision tree | **Done** | `/docs/modeling` — picks the right assertion combo by system type |
| "Why did my test fail?" troubleshooting | **Done** | `/docs/troubleshooting` — every error code with fix |
| README sync with new docs | **Done** | Links to all guides, real config format |
| Changelog page | **Done** | `/docs/changelog` |
| GitHub issue templates | **Done** | Bug report, feature request, question |
| Prepare HN answer bank | Pending | Draft responses to expected questions |

**Goal:** Docs answer every question before it's asked. No "how do I…" without a page for it.

### Days 15–21: Signal

| Task | Status | Deliverable |
|------|--------|-------------|
| 10 targeted outreaches | Pending | DMs to agent builders using Promptfoo, LangSmith, custom scripts |
| 2 community posts | Pending | r/MachineLearning, AI Discord, or relevant Slack |
| Collect objections | Pending | Track what people push back on → convert to docs/FAQ |
| Terminal GIF for README + landing page | Pending | 15-second demo of `kindlm test` |

**Goal:** Get 10 people to try it. Learn what's confusing.

### Days 22–30: Launch

| Task | Status | Deliverable |
|------|--------|-------------|
| Show HN post | Pending | "Show HN: KindLM — regression tests for AI agents" |
| Answer every HN comment | Pending | Same day, thoughtful responses |
| Convert questions to docs | Pending | Every repeated question becomes a doc section |
| FAQ page | Pending | From real questions collected days 15–30 |
| Migration guide (from custom scripts) | Pending | Step-by-step script → YAML conversion |

**Goal:** Public launch. Lead with the bug, not the framework.

### Traction signals — add when real

- **50+ GitHub stars** → add star count to landing page and README
- **100+ weekly npm downloads** → add download badge

Do not add these before hitting the thresholds.

---

## Docs Roadmap

### Tier 1 — done (days 1–7)

1. [Adopt KindLM in 30 Minutes](/docs/adopt)
2. [KindLM vs Promptfoo vs Custom Scripts](/docs/comparison)
3. [Tutorial: Refund Agent](/docs/tutorial)
4. [CI: GitHub Actions in 5 Minutes](/docs/ci-guide)

### Tier 2 — done (days 8–14)

5. [Examples Gallery](/docs/examples) — 7 configs: support, RAG, codegen, multi-model, compliance, brand safety, Ollama
6. [How to Model My System](/docs/modeling) — decision tree by system type + assertion layering guide
7. [Troubleshooting](/docs/troubleshooting) — every error code, cause, and fix

### Tier 3 — days 15+

8. Terminal GIF for README and landing page
9. FAQ (from real questions)
10. Migration guide (custom scripts → YAML)

---

## Positioning vs Promptfoo

```
Promptfoo helps evaluate prompts.
KindLM helps catch behavior regressions before deploy.
```

Many teams use both: Promptfoo for broader eval + security, KindLM for stable regression checks in agent workflows. This is the framing for comparison page, HN, and all outreach.

---

## Key Milestones Summary

| Week | Milestone | Success Metric | Status |
|------|-----------|---------------|--------|
| 2 | First test runs | `kindlm test` works end-to-end | Done |
| 4 | All assertions | 11 assertion types passing | Done |
| 7 | MVP complete | Full CLI, all features, tested | Done |
| 8 | **Public launch** | 200+ GitHub stars first week | Done |
| 10 | Cloud API live | Upload + retrieve working | Done |
| 12 | Dashboard live | Beta testers using it | Pending |
| 14 | **Cloud beta launch** | Product Hunt, 50 Cloud signups | Pending |
| 16 | **First revenue** | Stripe billing active | Done (API ready) |
| 18 | Enterprise GA | SSO, audit log, signed reports | Pending |
| 22 | **Month 6 target** | $7,890 MRR | Pending |
| 30d | **Show HN launch** | Adoption funnel live, docs complete | Pending |

---

## Dependencies & Blockers

| Dependency | Blocks | Mitigation |
|-----------|--------|------------|
| Cloudflare D1 GA stability | Cloud launch | Monitor D1 status; Turso as fallback |
| GitHub OAuth App approval | Cloud auth | Apply early, use personal OAuth app for dev |
| Stripe account activation | Billing | Apply during Phase 2 |
| EU AI Act final technical standards | Compliance spec accuracy | Track EASA/CEN publications, update mapping |
| Domain registration (kindlm.com) | Landing page launch | Register in Week 1 |

---

## What's NOT on this roadmap (Backlog for H2 2026+)

- Visual test builder (GUI for writing tests)
- Real-time monitoring / observability mode
- Prompt optimization suggestions from test results
- Multi-language SDK (Python, Go)
- Self-hosted Cloud option (Docker image)
- Marketplace for community assertion plugins
- SOC 2 certification for Cloud
- Mobile app for test monitoring
