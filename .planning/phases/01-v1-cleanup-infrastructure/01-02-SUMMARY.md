# Plan 01-02 Summary: Infrastructure Refactor

## Completed: 2026-03-28

### Task 1: Split queries.ts into 6 domain modules (INFRA-01)

**Before:** Single 1529-LOC `packages/cloud/src/db/queries.ts` containing all database functions.

**After:** 6 focused domain modules in `packages/cloud/src/db/queries/`:
- `orgs.ts` (176 LOC) — org, org_members, pending_invites
- `users.ts` (83 LOC) — user CRUD
- `projects.ts` (100 LOC) — project CRUD
- `testing.ts` (370 LOC) — suites, runs, results, baselines, data retention
- `auth.ts` (186 LOC) — tokens, signing keys, SAML config
- `billing.ts` (260 LOC) — webhooks, billing, audit log, idempotency
- `index.ts` (18 LOC) — barrel that composes all factories into `getQueries()`

**Backward compatibility:** Old `queries.ts` replaced with 4-line re-export file. Zero import changes needed across 27 consumer files.

**Test:** `queries.test.ts` moved to `queries/queries.test.ts` with updated imports.

### Task 2: Split sso.ts (INFRA-02)

**Before:** 596-LOC `packages/cloud/src/routes/sso.ts` mixing XML parsing, crypto, and route handlers.

**After:**
- `packages/cloud/src/saml/helpers.ts` (270 LOC) — all helper functions, constants, interfaces
- `packages/cloud/src/routes/sso.ts` (250 LOC) — route handlers only, imports from helpers

**Backward compatibility:** sso.ts re-exports all helper functions so test imports remain unchanged.

### Task 3: D1 Indexes (INFRA-03)

Created `packages/cloud/migrations/0011_index_audit.sql` with 5 indexes:
1. `idx_billing_stripe_customer` — billing(stripe_customer_id)
2. `idx_audit_action` — audit_log(org_id, action, created_at DESC)
3. `idx_audit_resource` — audit_log(org_id, resource_type, created_at DESC)
4. `idx_webhooks_org_active` — webhooks(org_id, active)
5. `idx_users_email` — users(email)

Updated `packages/cloud/src/db/schema.sql` with matching index documentation.

### Verification

- **Tests:** 255/255 passed (21 test files)
- **Typecheck:** `tsc --noEmit` clean (zero errors)
- **Commits:** 3 atomic commits, one per task
