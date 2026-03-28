# KindLM v2

## What This Is

KindLM is an open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** (tool calls, decisions, structured output) — not just what they say. The paid Cloud tier adds team dashboards, test history, compliance PDF export, and billing. v1.0.0 is shipped and live. v2 focuses on developer experience (CLI enhancements), enterprise readiness, and infrastructure quality.

## Core Value

The CLI must reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## Requirements

### Validated (v1.0)

- ✓ YAML config parser with Zod validation
- ✓ 6 LLM provider adapters (OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama)
- ✓ 11 assertion types (toolCalls, schema, judge, PII, keywords, drift, latency, cost, classification, output, baseline)
- ✓ Test runner with concurrency, retries, timeout, cost budgets
- ✓ 4 reporters (pretty terminal, JSON, JUnit XML, compliance Markdown)
- ✓ CLI commands: init, validate, test, baseline, login, upload, trace
- ✓ Cloud API with Hono on Cloudflare Workers (api.kindlm.com)
- ✓ GitHub OAuth + D1 database
- ✓ Stripe billing integration (test mode)
- ✓ Next.js dashboard on CF Pages
- ✓ VS Code extension with YAML intellisense (VSIX built, not yet on marketplace)
- ✓ Marketing site on CF Pages (kindlm.com)
- ✓ @kindlm/core@1.0.0 + @kindlm/cli@1.0.0 on npm with provenance
- ✓ UptimeRobot monitoring on api.kindlm.com/health
- ✓ CI/CD: GitHub Actions for lint/test/typecheck + deploy + release workflows

### Active

#### v1 Cleanup
- [ ] VS Code extension published to marketplace (needs publisher account + PAT)
- [ ] Stripe Products/Prices created in production (not test mode)

#### CLI Enhancements
- [ ] `--dry-run` mode: validate config, print test plan without API calls
- [ ] `--watch` mode: re-run tests on kindlm.yaml change
- [ ] Result caching to avoid duplicate LLM calls during iteration
- [ ] GitHub Action that posts test results as PR comment
- [ ] Generic HTTP provider adapter for custom APIs

#### Enterprise
- [ ] SAML signature verification with proper XML parser (not regex)
- [ ] Signed compliance PDF reports
- [ ] Audit log API
- [ ] Automatic token rotation

#### Infrastructure
- [ ] Refactor queries.ts (1529 LOC) into domain modules
- [ ] Refactor sso.ts (596 LOC) — separate SAML logic from route handlers
- [ ] D1 index audit for query performance
- [ ] Sentry error tracking for Workers

### Out of Scope

- GitHub org transfer (petrkindlmann → kindlm) — nice-to-have, not blocking
- Additional providers (Bedrock, Azure) — no demand signal yet
- Mobile app or native clients — web-only
- Self-hosted Cloud deployment docs — no enterprise demand yet

## Context

- **Codebase state:** v1.0.0 released and live. 255+ tests pass. All packages published.
- **Cloud API:** Deployed at api.kindlm.com, monitored by UptimeRobot.
- **Security concern:** SAML XML signature verification is regex-based — critical to fix for enterprise (ENT-01).
- **Technical debt:** queries.ts (1529 LOC) and sso.ts (596 LOC) are monolithic and fragile.
- **Marketing site:** kindlm.com on CF Pages. Dashboard at cloud.kindlm.com.

## Constraints

- **Infra:** Cloudflare ecosystem (Workers, D1, Pages) — committed
- **npm:** @kindlm scope, semver, provenance — maintain compatibility with 1.0.0
- **Auth:** GitHub OAuth for v2 (SAML enterprise-only after ENT-01)
- **Budget:** Stripe test mode until production prices created

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| All-CF stack (Workers, D1, Pages) | Single vendor, already committed | ✓ Good |
| Static export for dashboard | CF Pages can't run SSR Next.js | ✓ Good |
| kindlm.com on CF Pages (not Vercel) | Keep everything on CF, simpler | ✓ Good |
| YOLO mode for v2 | Ship fast, user trusts the workflow | — Pending |

---
*Last updated: 2026-03-28 after v2 project initialization*
