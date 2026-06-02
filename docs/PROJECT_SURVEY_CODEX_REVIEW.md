# Codex Independent Survey Review

## Verdict

The survey is directionally strong on product shape and correctly refuses to assume users, revenue, analytics, or paid conversion, but it is not import-ready. The repo evidence supports a substantial implemented product: CLI package/bin, Cloudflare Worker routes, subscription-mode Stripe billing, GitHub Action, VS Code extension source, and deploy/release automation are all present. It does not prove npm downloads, Marketplace installs, current production uptime, tenants, or payments. The §21 payload needs two high-priority fixes before dashboard import: split old blended revenue into migration-008 cash fields, and lower the `decision_band` because current gates will demote `focused-validation` when users, revenue, and analytics are all false. I also verified the repo is healthier than the survey says: `npm test`, `npm run typecheck`, `npm run build`, and `npm run lint` all pass locally, with build/lint warnings only.

## Findings

### HIGH - `decision_band` contradicts current dashboard gates

The payload sets `decision_band: "focused-validation"` in `docs/PROJECT_SURVEY.md:534`, while the same payload sets `users_proven: false`, `revenue_proven: false`, `analytics_present: false`, and `pricing_status: "provisional"` in `docs/PROJECT_SURVEY.md:527-530`. The dashboard derives `focused-validation` from a score >= 7.0, but then caps no-proof projects at `validate-cheaply` in `/Users/petr/projects/my-projects/src/lib/portfolio.ts:171-176` and `/Users/petr/projects/my-projects/src/lib/portfolio.ts:205-208`; it also caps provisional pricing with low revenue confidence at `validate-cheaply` in `/Users/petr/projects/my-projects/src/lib/portfolio.ts:209-216`. Recommendation: change §21 to `decision_band: "validate-cheaply"` unless the survey also adds a high `manual_sales_fit` field and intentionally selects `sell-manually-first` as the weaker manual-sales band. Do not leave `focused-validation`; it will be silently demoted.

### HIGH - Migration 008 revenue split is missing and blended revenue leaks service cash into the MRR lens

The survey's revenue section explicitly blends SaaS and service cash: base case is "~$1,100 SaaS + ~$700/mo amortized service" and optimistic case is "~$3,200 SaaS + ~$1,500/mo service" in `docs/PROJECT_SURVEY.md:254-256`; the payload then stores only legacy `solo_12mo_mrr_low/high` and blended text in `docs/PROJECT_SURVEY.md:521-526`. Current schema requires durable subscription MRR in `recurring_mrr_*`, lumpy/service monthly cash in `monthly_cash_*`, one-time audit/setup/lifetime per-deal cash in `one_time_service_cash`, and ad/affiliate cash in `passive_ad_affiliate_*` (`/Users/petr/projects/my-projects/docs/IMPORT_FORMAT.md:102-106`, `/Users/petr/projects/my-projects/docs/IMPORT_FORMAT.md:133-145`). Repo evidence supports a subscription model, not proven revenue: Stripe Checkout uses `mode: "subscription"` in `packages/cloud/src/routes/billing.ts:113-130`, docs list Team $49/mo and Enterprise $299/mo in `docs/11-PRICING.md:20-38`, and checkout returns 501 if Stripe secrets or price IDs are missing in `packages/cloud/src/routes/billing.ts:66-78` and `packages/cloud/src/routes/billing.ts:104-110`. Recommendation: keep `proven_mrr: 0`; add `recurring_mrr_low/high` for SaaS-only 12-month MRR, `monthly_cash_low/high` for amortized setup/compliance cash, `one_time_service_cash` for the $500-2,500 per-deal offer, and `passive_ad_affiliate_low/high: 0`.

### MEDIUM - Shipped/live/published claims need a tighter proof boundary

The survey says the maturity is a "Deployed product" with a shipped npm CLI, live Worker, published VS Code extension, and GitHub Action in `docs/PROJECT_SURVEY.md:14`. The repo supports implementation and configured distribution paths: the CLI package is named `@kindlm/cli` with a `kindlm` bin in `packages/cli/package.json:1-29`; the release workflow can publish via Changesets with `NPM_TOKEN` in `.github/workflows/release.yml:34-44`; the Worker targets `api.kindlm.com/*` and prod D1 in `packages/cloud/wrangler.toml:1-17`; production deploy is configured in `.github/workflows/deploy-cloud.yml:66-86`; the VS Code extension has package/publish scripts in `packages/vscode/package.json:45-49`; and the root GitHub Action runs `npx @kindlm/cli@latest` in `action.yml:35-46`. None of that proves current live status, package downloads, Marketplace installs, active Cloud tenants, or successful production secrets. Recommendation: keep the maturity high but phrase it as "repo claims shipped and contains publish/deploy configuration; current live usage/status is not proven from repo evidence."

### MEDIUM - `next_7_day_action` is a checklist, not one action

The final verdict says to cold-email 25 teams, post a Show HN, and book 3 calls in `docs/PROJECT_SURVEY.md:430`; the payload repeats the multi-step version in `docs/PROJECT_SURVEY.md:508`. The dashboard expects one concrete this-week instruction (`/Users/petr/projects/my-projects/docs/IMPORT_FORMAT.md:98-100`). Recommendation: choose one action, for example: "Cold-email 25 EU AI product teams with the compliance/setup offer and track reply/call outcomes." Keep Show HN as a later action or a separate note, not in `next_7_day_action`.

### LOW - Test status is stale and should be upgraded, not penalized

The survey repeatedly says there are 5 known `scenarios.test.ts` failures (`docs/PROJECT_SURVEY.md:35`, `docs/PROJECT_SURVEY.md:138`, `docs/PROJECT_SURVEY.md:330`, `docs/PROJECT_SURVEY.md:353`, `docs/PROJECT_SURVEY.md:395`). I ran `npm test` and it passed, including the CLI scenarios suite; `npm run typecheck`, `npm run build`, and `npm run lint` also passed. The remaining evidence is warning-level: the CLI build warns about `import.meta` in CJS output, the dashboard build warns about Next's ESLint plugin, and lint reports one unused eslint-disable warning. Recommendation: update the survey from "5 failing tests" to "green local suite as of review; warning cleanup remains."

### LOW - Reliability and trajectory features are no longer "documented only"

The feature table says reliability metrics and trajectory metrics are documented/planned only in `docs/PROJECT_SURVEY.md:91-92`, and the finishability section still lists "ship a clean v2.4 reliability slice" as unfinished in `docs/PROJECT_SURVEY.md:338-339`. The repo now has statistical primitives for `pass^k`, `pass@k`, percentiles, and bootstrap confidence intervals in `packages/core/src/engine/stats.ts:1-7`, `packages/core/src/engine/stats.ts:17-34`, and `packages/core/src/engine/stats.ts:94-125`; aggregate results include pass-rate CI, passK/passAtK, latency p50/p95/p99, and efficiency stats in `packages/core/src/engine/aggregator.ts:61-67`, `packages/core/src/engine/aggregator.ts:156-165`, and `packages/core/src/engine/aggregator.ts:169-183`; trajectory precision/recall/exact-match assertions are implemented in `packages/core/src/assertions/trajectory.ts:72-148`. Recommendation: revise those rows to "implemented, newly landed" and reserve missing-piece language for remaining UX/docs/compliance hardening.

### LOW - Analytics absence is correct and should stay separated from Sentry

The payload correctly has `analytics_present: false` in `docs/PROJECT_SURVEY.md:530`. Sentry is wired, but product analytics/activation are intentionally absent: ADR-010 says "No telemetry by default" and no data is collected unless the user opts in later (`docs/14-ADR.md:244-253`). Recommendation: keep `analytics_present: false`; do not treat Sentry dependency or error monitoring as demand proof.

## §21 Payload Checks

| Check | Result | Notes |
|---|---|---|
| JSON parses | PASS | Extracted §21 parses as a single JSON object, not an array wrapper. |
| No trailing prose | PASS | The JSON fence is the final non-empty content of the survey. |
| Migration 008 revenue split | CAVEAT | `recurring_mrr_*`, `monthly_cash_*`, `one_time_service_cash`, and `passive_ad_affiliate_*` are absent; blended SaaS+service cash remains in legacy fields. |
| Revenue proof | PASS | `users_proven=false`, `revenue_proven=false`, and `proven_mrr=0` match the repo evidence. |
| Revenue type separation | CAVEAT | The narrative models one-time/setup/compliance service cash beside SaaS but §21 does not split it into the current fields. |
| Gate awareness | CAVEAT | `focused-validation` conflicts with no-proof/provisional-pricing gates and will be demoted to `validate-cheaply` unless intentionally weakened further. |
| Internal consistency | CAVEAT | Narrative recommends service-first/manual validation, but payload band is `focused-validation`; test and reliability status are also stale versus current repo verification. |
| `next_7_day_action` | CAVEAT | It is a combined cold outreach + Show HN + booking target checklist, not one action. |
| Enum validity | PASS | `decision_band`, `cash_potential`, `focus_category`, `pricing_status`, and confidence fields use allowed values from `/Users/petr/projects/my-projects/docs/IMPORT_FORMAT.md:148-155`; the issue is gate consistency, not enum spelling. |

## Requested Checklist

1. **Claims grounded in repo evidence?** Mostly: implementation claims are well supported, but shipped/live/published wording must be bounded because repo config does not prove uptime, installs, tenants, or successful deployments.
2. **Repo facts vs market inference separated?** Mostly yes: the buyer/market section is explicitly marked as inference in `docs/PROJECT_SURVEY.md:199-213`; keep that separation in the payload/action language too.
3. **No user/revenue/traction assumed?** Yes: §21 correctly sets `users_proven=false`, `revenue_proven=false`, `analytics_present=false`, and `proven_mrr=0`.
4. **Scores fair, not optimistic?** Scores are defensible for repo quality, but the stored band is optimistic relative to dashboard gates; distribution/revenue proof should keep it at `validate-cheaply` or a manual-sales band.
5. **Missing pieces flagged?** Yes, especially users, paying customers, analytics, activation, retention, security/legal review, and customer interviews in `docs/PROJECT_SURVEY.md:364-381`; update stale missing-piece rows for tests and reliability metrics.
