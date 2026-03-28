# Phase 1: v1 Cleanup & Infrastructure — Research Findings

**Date:** 2026-03-28  
**Research Scope:** Infrastructure refactoring, billing integration, VS Code extension publishing, D1 schema optimization

---

## 1. VS Code Extension Publishing (CLEAN-01)

### Current State
- **Publisher ID:** `kindlm` (configured in `/packages/vscode/package.json`)
- **Version:** `0.1.0`
- **Extension Name:** KindLM
- **Main Entry:** `./dist/extension.js`

### Publish Configuration
```json
{
  "scripts": {
    "build": "esbuild --bundle --platform=node --outdir=dist --external:vscode src/extension.ts",
    "package": "npx vsce package --no-dependencies --allow-package-secrets slack"
  }
}
```

### Key Finding
- **ISSUE:** The publish script includes `slack` flag: `npx vsce package --no-dependencies --allow-package-secrets slack`
- The `slack` argument appears to be a target/publisher override (non-standard VSCE syntax)
- Standard publish command should be: `npx vsce publish` (requires VSCE_PAT token in env)

### Requirements for CLEAN-01
1. Publisher account registration on Visual Studio Marketplace
2. Personal Access Token (PAT) created and stored as `VSCE_PAT` env var
3. Fix publish script to use standard VSCE commands
4. Verify VSIX builds successfully before marketplace submission

### Files
- `/packages/vscode/package.json` (1.3 KB)
- `/packages/vscode/src/extension.ts` (223 lines)
- `/packages/vscode/src/hover.ts` (293 lines)
- `/packages/vscode/src/completions.ts` (470 lines)

---

## 2. Stripe Billing Integration (CLEAN-02)

### Current Configuration
**Environment Variables Required:**
- `STRIPE_SECRET_KEY` — Secret key for API calls
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification
- `STRIPE_TEAM_PRICE_ID` — Team plan price ID (env var key)
- `STRIPE_ENTERPRISE_PRICE_ID` — Enterprise plan price ID (env var key)

### Plan Configuration
```javascript
const PLAN_KEYS = {
  team: { plan: "team", name: "KindLM Team", envKey: "STRIPE_TEAM_PRICE_ID" },
  enterprise: { plan: "enterprise", name: "KindLM Enterprise", envKey: "STRIPE_ENTERPRISE_PRICE_ID" }
};
```

### Current Integration Points
**Endpoints:**
- `GET /billing` — Fetch org billing info
- `POST /checkout` — Create Stripe checkout session (creates customer if needed)
- `POST /portal` — Create customer portal session
- `POST /webhook` — Stripe webhook handler (no auth required)

**Webhook Events Handled:**
- `checkout.session.completed` — Record subscription + update org plan
- `customer.subscription.updated` — Sync subscription changes
- `customer.subscription.deleted` — Revert to free plan

### Database Schema
**Table:** `billing`
```sql
CREATE TABLE billing (
  org_id TEXT PRIMARY KEY,
  plan TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  period_end TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### Current State Assessment
- Integration is **partially implemented** but **not production-ready**
- No actual Stripe products/prices exist yet in production dashboard
- Webhook signature verification is simplified (not using official Stripe libraries)
- Missing: Rate limiting on webhook endpoint

### Requirements for CLEAN-02
1. Create Stripe products: "KindLM Team" and "KindLM Enterprise"
2. Create price IDs for each product
3. Set `STRIPE_TEAM_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` in Worker secrets
4. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Worker secrets
5. Update webhook implementation to use official Stripe libraries
6. Test webhook delivery + signature verification in staging

### Files
- `/packages/cloud/src/routes/billing.ts` (310 lines)
- `/packages/cloud/src/db/queries.ts` — Billing functions (4 functions)

---

## 3. Database Query Refactoring (INFRA-01)

### Current State
**File:** `/packages/cloud/src/db/queries.ts`  
**Size:** 1,529 lines  
**Status:** Monolithic module with all database operations

### Function Inventory by Domain
Total: 77 functions across 10 domains

#### Org Management (9 functions)
- `mapOrg`, `getOrg`, `createOrg`
- `mapOrgMember`, `getOrgMember`, `addOrgMember`, `removeOrgMember`, `updateOrgMemberRole`, `countOrgMembers`
- `listOrgMembers` 
- `getPendingInvitesByOrg`

#### User Management (7 functions)
- `mapUser`, `getUser`, `getUserByGithubId`, `getUserByEmail`
- `createUser`, `updateUser`
- `getUserOrgs`

#### Project Management (7 functions)
- `mapProject`, `getProject`, `createProject`, `listProjects`
- `deleteProject`, `countProjects`, `updateProject`

#### Tokens/API Keys (6 functions)
- `mapToken`, `getTokenByHash`, `createToken`
- `listTokens`, `revokeToken`, `updateTokenLastUsed`

#### Testing/Runs/Results (18 functions)
- Suite ops: `mapSuite`, `getSuite`, `createSuite`, `listSuites`, `getOrCreateSuite`, `deleteSuite`, `updateSuite`
- Run ops: `mapRun`, `getRun`, `createRun`, `updateRun`, `listRuns`
- Result ops: `mapTestResult`, `createResults`, `listResults`
- Cleanup: `deleteBaselinesForOldRuns`, `deleteOldRuns`

#### Baselines (7 functions)
- `mapBaseline`, `getBaseline`, `createBaseline`, `listBaselines`
- `activateBaseline`, `deleteBaseline`, `getActiveBaseline`

#### Billing (4 functions)
- `mapBilling`, `getBilling`, `getBillingByCustomerId`, `upsertBilling`

#### SAML/SSO (4 functions)
- `mapSamlConfig`, `getSamlConfig`, `getEnabledSamlConfigs`, `upsertSamlConfig`

#### Security/Signing Keys (3 functions)
- `mapSigningKey`, `getSigningKey`, `createSigningKey`

#### Members/Invites (4 functions)
- `mapPendingInvite`, `createPendingInvite`, `getPendingInviteByEmail`, `deletePendingInvite`

#### Audit Logging (3 functions)
- `mapAuditEntry`, `logAudit`, `listAuditLog`

#### Webhooks & Other (9 functions)
- `mapWebhook`, `createWebhook`, `listWebhooks`, `deleteWebhook`, `listWebhooksByEvent`, `getWebhook`, `updateWebhook`
- `safeParseJson`
- `cleanupExpiredIdempotencyKeys`

### Recommended Module Split
**6 Domain Modules:**
1. `/packages/cloud/src/db/queries/orgs.ts` — Org + members (9 + 4 invite functions)
2. `/packages/cloud/src/db/queries/users.ts` — Users (7 functions)
3. `/packages/cloud/src/db/queries/projects.ts` — Projects (7 functions)
4. `/packages/cloud/src/db/queries/testing.ts` — Suites, Runs, Results, Baselines (32 functions)
5. `/packages/cloud/src/db/queries/auth.ts` — Tokens, SAML, Keys (13 functions)
6. `/packages/cloud/src/db/queries/billing.ts` — Billing, webhooks, audit (13 functions)

**Index File:**
`/packages/cloud/src/db/queries/index.ts` — Re-exports all functions

### Natural Split Points (High Cohesion)
- **Org & Members**: Both manage org hierarchy (no cross-domain calls)
- **Testing**: Suite→Run→Result→Baseline (sequential lifecycle)
- **Auth**: Tokens, SAML config, signing keys (all auth-related)
- **Billing**: Stripe integration, webhooks, audit (business logic)

---

## 4. SSO Route Refactoring (INFRA-02)

### Current State
**File:** `/packages/cloud/src/routes/sso.ts`  
**Size:** 596 lines  
**Test Coverage:** `/packages/cloud/src/routes/sso.test.ts` (747 lines)

### Code Breakdown by Responsibility

#### SAML Helper Functions (~280 lines) — Domain Logic
**XML Parsing (string-based):**
- `extractNameID()` — Extract NameID from assertion
- `extractAttribute()` — Extract attribute by name
- `extractIssuer()` — Extract IDP entity ID
- `extractAssertionId()` — Extract assertion ID for replay protection

**Security & Validation:**
- `ssoGithubId()` — Derive pseudo-GitHub ID from email
- `escapeRegex()` — Escape regex special chars
- `escapeHtml()` — HTML escape for error messages
- `checkConditions()` — Validate NotBefore/NotOnOrAfter timing
- `verifySamlSignature()` — Verify XML signature (external via crypto)

**Utility:**
- `getAllowedOrigins()` — Determine allowed redirect origins based on env
- Constants: `SP_ENTITY_ID`, `ACS_URL`, `AUTH_CODE_TTL_SECONDS`

#### Route Handlers (~200 lines) — HTTP Layer
**Public Routes (no auth):**
- `GET /metadata` — Return SAML SP metadata XML
- `POST /callback` — Process SAML response from IDP

**Protected Routes:**
- `POST /auth-code` — Generate auth code for SSO session
- `POST /config` — Configure SAML for org

**Middleware/Gate:**
- `requirePlan` — Enforce SSO on enterprise+ plans only

### Natural Split Points

**Suggested refactor:**
1. `/packages/cloud/src/saml/parsers.ts` — XML parsing helpers
2. `/packages/cloud/src/saml/validation.ts` — Signature verification, conditions check
3. `/packages/cloud/src/saml/user-provisioning.ts` — ssoGithubId, user/org creation flow
4. `/packages/cloud/src/routes/sso.ts` — Thin route handlers calling domain logic

### Key Separation Challenges
- **Embedded queries calls** — SAML logic calls `queries.getUserByEmail()`, `queries.addOrgMember()` etc
  - Acceptable but should document as domain→data layer
- **Async throughout** — Can't easily extract without Promise handling
- **Heavy crypto dependency** — verifySamlSignature needs base64, crypto APIs

---

## 5. D1 Schema & Index Audit (INFRA-03)

### Database Tables (16 total)

**Core Tables:**
1. `orgs` — Organizations
2. `users` — User accounts
3. `org_members` — Org membership + roles
4. `tokens` — API tokens
5. `projects` — Test projects
6. `suites` — Test suites
7. `runs` — Test runs (execution instances)
8. `results` — Test results (per run per test case)
9. `artifacts` — Test artifacts (attachments)
10. `baselines` — Baseline snapshots for comparison
11. `idempotency_keys` — Deduplication cache
12. `webhooks` — Integration webhooks

**Auth/Security Tables:**
13. `audit_log` — Audit trail
14. `signing_keys` — Ed25519 signing keys
15. `saml_configs` — SAML IDP configurations
16. `auth_codes` — Temporary auth codes for SSO
17. `saml_assertions` — Replay protection cache
18. `pending_invites` — Org invite tokens
19. `rate_limits` — Rate limiting state
20. `billing` — Stripe billing records
21. `compliance_reports` — Compliance audit reports

### Current Indexes (26 total)

**By Table:**
- `users(github_id)` — GitHub lookup
- `org_members(user_id)` — User's orgs
- `org_members(org_id)` — Org's members  
- `tokens(org_id)` — Org's tokens
- `tokens(token_hash)` — Token validation (AUTH CRITICAL)
- `projects(org_id)` — Org's projects
- `suites(project_id)` — Project's suites
- `runs(project_id)` — Project's runs
- `runs(suite_id)` — Suite's runs
- `runs(status)` — Filter by status
- `runs(created_at DESC)` — Latest runs
- `runs(project_id, created_at DESC)` — Combined lookup (HARDENING)
- `results(run_id)` — Run's results
- `results(test_case_name)` — Result lookup by test case
- `artifacts(result_id)` — Result's artifacts
- `baselines(suite_id)` — Suite's baselines
- `baselines(suite_id, is_active)` — Active baseline lookup
- `baselines(suite_id, created_at DESC)` — Ordered lookup (HARDENING)
- `idempotency_keys(expires_at)` — Cleanup by expiry
- `webhooks(org_id)` — Org's webhooks
- `audit_log(org_id, created_at DESC)` — Org audit history (HARDENING)
- `auth_codes(expires_at)` — Cleanup expired codes
- `pending_invites(org_id)` — Org's pending invites
- `pending_invites(email)` — Email lookup for redemption
- `saml_configs(org_id)` — (implied, likely unique)
- `billing(org_id)` — (implied, likely primary key)

### Missing Indexes (Identified from queries.ts usage)

**High Priority (Auth/Lookup):**
- `saml_configs(enabled)` — `getEnabledSamlConfigs()` SELECT * WHERE enabled=1 (full table scan)
- `tokens(org_id, revoked_at)` — `listTokens()` filters by revoked_at IS NULL
- `runs(suite_id, created_at DESC)` — `listRuns(suiteId)` with ordering

**Medium Priority (Analysis/Reporting):**
- `results(run_id, test_case_name)` — `listResults(runId)` with ordering
- `audit_log(resource_type, resource_id)` — `listAuditLog()` with filtering

**Potential N+1 in code:**
- `getUserOrgs()` — Likely joins users → org_members → orgs (needs verification)
- `listOrgMembers()` — org_members + user detail fetch (separate query per row?)

### Performance Recommendations
1. **Add composite index** on `saml_configs(enabled, org_id)` for fast lookup
2. **Add composite index** on `tokens(org_id, revoked_at)` for token filtering
3. **Audit N+1 patterns** in `listOrgMembers()` — may need JOIN or batch loading
4. **Consider partial index** on `runs(project_id, status)` for "pending" runs

---

## Summary Table

| Requirement | Status | Key File(s) | Action Items |
|---|---|---|---|
| **CLEAN-01** | Ready for pub | `/packages/vscode/package.json` | Fix publish script, obtain PAT, register publisher account |
| **CLEAN-02** | Partial impl. | `/packages/cloud/src/routes/billing.ts` | Create Stripe products, set env vars, test webhooks |
| **INFRA-01** | Needed | `/packages/cloud/src/db/queries.ts` (1529 LOC) | Split into 6 domain modules, create index file |
| **INFRA-02** | Feasible | `/packages/cloud/src/routes/sso.ts` (596 LOC) | Extract SAML logic to 3 helper modules, thin route layer |
| **INFRA-03** | Audit complete | Schema: 10 migrations | Add 4-5 missing indexes, audit N+1 patterns |

