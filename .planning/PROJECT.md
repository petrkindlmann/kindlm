# KindLM v1.0

## What This Is

KindLM is an open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** (tool calls, decisions, structured output) — not just what they say. The paid Cloud tier adds team dashboards, test history, compliance PDF export, and billing. Target: solo developers building AI agents who need CI-friendly behavioral testing.

## Core Value

The CLI must reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## Requirements

### Validated

- ✓ YAML config parser with Zod validation — existing
- ✓ 6 LLM provider adapters (OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama) — existing
- ✓ 11 assertion types (toolCalls, schema, judge, PII, keywords, drift, latency, cost, classification, output, baseline) — existing
- ✓ Test runner with concurrency, retries, timeout, cost budgets — existing
- ✓ 4 reporters (pretty terminal, JSON, JUnit XML, compliance Markdown) — existing
- ✓ CLI commands: init, validate, test, baseline, login, upload, trace — existing
- ✓ Cloud API with Hono on Cloudflare Workers — existing
- ✓ D1 database with 10 migrations — existing
- ✓ GitHub OAuth + SAML SSO — existing
- ✓ Stripe billing integration — existing
- ✓ Next.js dashboard with 18 pages — existing
- ✓ VS Code extension with YAML intellisense — existing
- ✓ Marketing site with docs + blog — existing
- ✓ npm published (@kindlm/core v1.0.0, @kindlm/cli v1.0.0) — Phase 4
- ✓ CI/CD: GitHub Actions for lint/test/typecheck + deploy workflows — existing
- ✓ CONTRIBUTING.md, README with npx quick start — existing (just added)

### Validated in Phase 3

- ✓ Marketing site deployed to kindlm-site.pages.dev; DNS ready for kindlm.com — Phase 3
- ✓ Stripe billing refactored: Price IDs from env vars, no inline price_data; 255/255 tests pass — Phase 3
- ✓ VS Code extension: CHANGELOG.md, icon.png, @vscode/vsce; clean 17.24 KB VSIX built — Phase 3

### Validated in Phase 4

- ✓ @kindlm/core v1.0.0 and @kindlm/cli v1.0.0 published to npm with provenance — Phase 4
- ✓ GitHub Releases auto-created via changesets/action (3 releases) — Phase 4
- ✓ Health check endpoint verified: GET /health → {"status":"ok"} — Phase 4
- ✓ UptimeRobot monitoring active: api.kindlm.com/health, 5-min interval, keyword check — Phase 4
- ✓ E2E verified: kindlm init → kindlm validate → kindlm --version 1.0.0 — Phase 4

### Active

- [ ] VS Code extension published to marketplace (REL-04 — needs publisher account + PAT)
- [ ] kindlm.com custom domain activated in CF Pages (SITE-01 — DNS ready)
- [ ] Stripe Products/Prices + Worker secrets set (BILL-01 — dashboard setup needed)

### Out of Scope

- GitHub org transfer (petrkindlmann → kindlm) — nice-to-have, not blocking launch
- Enterprise sales features (signed compliance reports, audit log API) — v2
- Additional providers (Bedrock, Azure) — no demand signal yet
- Mobile app or native clients — web-only for v1
- Self-hosted Cloud deployment docs — v2

## Context

- **Codebase state:** v1.0.0 released. All 4 phases complete. 255+ tests pass. @kindlm/core and @kindlm/cli published to npm with provenance attestation.
- **Cloud API:** Deployed at api.kindlm.com. Health endpoint monitored by UptimeRobot (5-min interval). GitHub OAuth login works.
- **Security concern:** SAML XML signature verification is regex-based and incomplete per CONCERNS.md. Needs proper implementation before enterprise customers (v2).
- **Technical debt:** queries.ts (1529 LOC) and sso.ts (596 LOC) are monolithic. Not blocking but fragile (v2 INFRA-01/02).
- **Target user for v1:** Solo developer who runs `npx @kindlm/cli init`, writes kindlm.yaml, runs `kindlm test` in CI.

## Constraints

- **Infra:** Cloudflare ecosystem (Workers, D1, Pages) — already committed, not changing
- **Budget:** Stripe test mode first, real keys when billing flow is verified
- **Auth:** GitHub OAuth is the only login method for v1 (SAML is enterprise-only)
- **npm:** Already published under @kindlm scope — must maintain semver compatibility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Static export for dashboard | CF Pages can't run SSR Next.js; dashboard is client-side SPA anyway | ✓ Good — builds clean, 12 static pages |
| Remove marketing site middleware | Middleware incompatible with static export; docs subdomain rewrite can use CF routing | — Pending |
| Solo devs first, teams later | Lower bar to ship; validates core CLI value before adding team complexity | — Pending |
| Fix Cloud API before cutting 1.0 | Users expect `kindlm upload` to work even on free tier | ✓ Done — API deployed, health monitored |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after Phase 4 completion — v1.0.0 shipped*
