# KindLM Technical Debt & Codebase Concerns

Last Updated: 2026-03-27
Scope: Monorepo packages (core, cli, cloud, dashboard, vscode)

---

## 1. Code Size & Complexity Concerns

### Critical Files (>500 LOC)

| File | Lines | Category | Risk |
|------|-------|----------|------|
| `packages/cloud/src/db/queries.ts` | 1529 | Database | **HIGH** — Monolithic query file, fragile to schema changes |
| `packages/cli/tests/integration/scenarios.test.ts` | 1995 | Test | **MEDIUM** — Large test suite, slow CI feedback |
| `packages/core/src/engine/runner.ts` | 685 | Core | **MEDIUM** — High cyclomatic complexity in run loop |
| `packages/core/src/config/schema.ts` | 626 | Core | **MEDIUM** — Zod schema is not separated by concern |
| `packages/cloud/src/routes/sso.ts` | 596 | Cloud | **HIGH** — SAML/XML parsing logic mixed with route handlers |

### Issues

- **`queries.ts` (1529 LOC)**: Single-file repository of all D1 queries. Updates to schema require careful synchronization across 50+ query functions. No ORM — raw string SQL is error-prone. Row mapping helpers are repetitive (mapOrg, mapProject, mapSuite, etc.).
  - Recommendation: Extract query groups into modules (auth queries, run queries, baseline queries) and add compile-time SQL type checking (e.g., Drizzle ORM or sql.js).

- **`runner.ts` (685 LOC)**: Contains entire test execution engine (setup, run loop, aggregation, gates). The `run()` function has high cognitive complexity — multiple nested loops and error handling paths.
  - Recommendation: Break into `executor.ts`, `aggregator.ts`, `gater.ts` (already done partially, further decomposition needed).

- **`schema.ts` (626 LOC)**: All Zod schemas defined in one file. Adding new config sections (e.g., webhook auth, rate-limit rules) will increase size further.
  - Recommendation: Split by concern: `schema/provider.ts`, `schema/model.ts`, `schema/test.ts`, `schema/gates.ts`.

---

## 2. Security Concerns

### API Key & Credential Handling

| Issue | Location | Severity | Mitigation |
|-------|----------|----------|-----------|
| **API keys accepted via env var only** | `packages/core/src/config/schema.ts:33-35` | ✅ GOOD | Enforced by schema: `apiKeyEnv` is required, never raw keys |
| **Token hashing** | `packages/cloud/src/routes/auth.ts` | ✅ GOOD | Tokens hashed with SHA-256 before storage |
| **SAML XML parsing** | `packages/cloud/src/routes/sso.ts:16-61` | ⚠️ MEDIUM | Lightweight string-based regex parsing (not a full XML parser) |
| **Token format validation** | `packages/cloud/src/middleware/auth.ts` | ✅ GOOD | Bearer tokens must have `klm_` prefix |
| **Signing key rotation** | `packages/cloud/src/db/schema.sql` | ❓ MISSING | No automatic rotation policy; manual process only |

### SAML/XML Concerns

- **String-based XML extraction** (`sso.ts:19-61`): Uses regex to extract NameID, Attributes, Issuer from SAML assertions. This works for well-formed responses but is brittle:
  - Namespace variations (`saml:`, `saml2:`, none) handled, but custom prefixes not supported
  - No XML schema validation
  - Vulnerable to edge cases: CDATA sections, entity references, malformed nesting

- **Signature verification missing**: Code validates timing conditions but does NOT verify XML Signature (Assertion[@ID] signature). This is documented in `sso.test.ts:21-24` but remains unimplemented.
  - Recommendation: Add XML Signature verification using `xmldsigjs` or move to standard SAML library (e.g., `passport-saml`).

### Token Storage & Expiration

- **No automatic token rotation**: Tokens can live indefinitely (expiresAt is nullable). Organizations must manually revoke or implement rotation in their app.
- **No rate limiting on token usage**: Tokens are checked for validity but no per-token rate limits (only org-level in middleware).

---

## 3. Performance Concerns

### Concurrency & Timeouts

| Setting | Value | Location | Concern |
|---------|-------|----------|---------|
| Default concurrency | 4 | `packages/core/src/config/schema.ts` | Hard-coded; no adaptive scaling |
| Test timeout | 60,000ms | `packages/core/src/config/schema.ts:200` | Long default may mask slow agents |
| Max retry delay | 30,000ms | `packages/core/src/providers/retry.ts` | Exponential backoff may be excessive |
| D1 query timeout | Implicit (Wrangler default) | `packages/cloud/src/index.ts` | No explicit timeout set |

### Database Performance

- **No query indices**: `packages/cloud/src/db/schema.sql` defines tables but may lack indices on frequently filtered columns (e.g., `org_id`, `project_id`, `created_at`).
  - Recommendation: Audit schema for index coverage on WHERE/JOIN/ORDER BY columns.

- **N+1 query risks**: Row mapping in `queries.ts` uses discrete queries for org → projects → suites. No batch loading or JOIN optimization visible.

- **Large result sets**: `getRunsByOrgId()` and similar may return hundreds of rows with no pagination visible in route handlers.
  - Recommendation: Implement cursor-based pagination in Cloud API routes.

### Memory Concerns

- **Baseline comparison**: `packages/core/src/baseline/store.ts` loads entire baselines into memory for comparison. For projects with 1000s of tests, this could exceed Worker memory limits (128MB).

---

## 4. Missing Features & Incomplete Implementations

### SAML/SSO

- ✅ Assertion parsing, timing validation, user creation
- ❌ **XML Signature verification** — tokens accepted without cryptographic validation
- ❌ **Metadata endpoint** — no `/saml/metadata` for IdP registration
- ❌ **Single Logout (SLO)** — no logout assertion handling
- ❌ **Attribute mapping UI** — fixed to email extraction only

### Compliance Reporting

- ✅ EU AI Act Annex IV markdown generation
- ❌ **PDF export** — gated to Team+ plan but no visible PDF generation code
- ❌ **Report signing** — gated to Enterprise but no signature implementation in code
- ❌ **Audit trail export** — no API to retrieve compliance audit logs

### Webhooks

- ✅ Data model in schema (webhook, webhook_event tables)
- ❌ **Route implementation** — no webhook routes in Cloud (routes/webhooks.ts missing)
- ❌ **Retry logic** — not implemented
- ❌ **Signature verification** — not implemented

### VSCode Extension

- ✅ Syntax highlighting, completions, hover
- ❌ **Run tests inline** — no integrated test runner
- ❌ **Configuration UI** — no visual config editor
- ❌ **Live schema validation** — shows errors but no real-time feedback

---

## 5. Test Coverage Gaps

| Package | Test Files | Source Files | Coverage |
|---------|-----------|--------------|----------|
| @kindlm/core | 35+ | 45+ | **~78%** (gaps in edge cases) |
| @kindlm/cli | 12+ | 15+ | **~85%** (integration tests comprehensive) |
| @kindlm/cloud | 20+ | 30+ | **~70%** (routes underutilized) |
| @kindlm/dashboard | 0 | 15+ | **0%** (no tests) |
| @kindlm/vscode | 0 | 3+ | **0%** (no tests) |

### Missing Test Areas

1. **Dashboard** (`packages/dashboard/src/`): No unit or E2E tests. Frontend is untested.
   - Impacts: Regression risk on UI changes, missing accessibility audits

2. **VSCode Extension** (`packages/vscode/src/`): No tests for completions or hover logic.
   - Impacts: Extension may break on config schema changes

3. **Provider Resilience**: Individual provider tests exist but no cross-provider chaos tests (e.g., "what if rate limits hit across all providers?").

4. **Database Migrations**: No tests for schema migrations; migrations are manual scripts (`packages/cloud/src/db/migrations/`).

5. **SAML Edge Cases**: `sso.test.ts` covers happy path but not:
   - Malformed XML (unclosed tags, nested assertions)
   - Empty attributes
   - Very large responses (>1MB)
   - Concurrent SSO requests (race conditions in auth code generation)

---

## 6. Error Handling & Resilience

### Known Gaps

| Scenario | Handling | Risk |
|----------|----------|------|
| Provider API down | Retry with exponential backoff | GOOD |
| D1 transaction rollback | None visible in code | **MEDIUM** — no rollback logic for partial updates |
| Invalid token in middleware | 401 Unauthorized | GOOD |
| SAML signature mismatch | Silently rejected (no error message) | **HIGH** — hard to debug |
| Concurrent test runs on same suite | No locking; last-write-wins | **HIGH** — baseline corruption risk |
| Disk full during log export | No handling visible | **MEDIUM** — crash likely |

### Recommendations

- Add transaction rollback handlers in `packages/cloud/src/db/queries.ts`
- Implement suite-level locking for concurrent run protection
- Add explicit error logging for SAML verification failures

---

## 7. Fragile Areas (Likely to Break)

### 1. Config Schema Evolution

**File**: `packages/core/src/config/schema.ts` (626 LOC)

**Risk**: Adding new test assertion types or model parameters requires changes in:
- Schema definition
- Registry mapping
- CLI command handler
- Test fixtures in 5+ test files

**Example**: Adding `llm-distance` assertion would touch 7 files. No shared schema update tool.

**Mitigation**: Create schema migration helpers or use OpenAPI-style versioning.

---

### 2. Provider Adapter Interface Changes

**File**: `packages/core/src/providers/interface.ts`

**Risk**: `ProviderAdapter` interface has `complete()` method with many parameters. Changing signature breaks all 7 provider implementations and all test mocks.

**Current signature**:
```typescript
complete(request: ProviderRequest): Promise<ProviderResponse>
```

**If modified** (e.g., adding timeout param), requires updates to:
- `packages/core/src/providers/*.ts` (7 implementations)
- `packages/core/src/providers/*.test.ts` (7 test files)
- `packages/cli/tests/integration/scenarios.test.ts` (mock setup)

**Mitigation**: Use options objects for all parameters (already done — good).

---

### 3. D1 Schema Changes

**File**: `packages/cloud/src/db/schema.sql`

**Risk**: Schema changes require:
- Migration file creation (manual)
- `queries.ts` updates (sync 50+ functions)
- No ORM to auto-generate query types
- No migration tests

**Example**: Renaming `test_results.response_text` → `response_content` would require:
1. Migration SQL
2. 5+ query functions in `queries.ts`
3. Type definitions in `types.ts`
4. Updated test mocks in `test-helpers.ts`

**Mitigation**: Add database migration tests and consider Drizzle ORM.

---

### 4. Baseline Format Changes

**File**: `packages/core/src/baseline/store.ts`

**Risk**: Baseline JSON schema is not versioned. If assertion structure changes, old baselines break without migration.

**Current**: Stores raw `AssertionResult[]` to JSON

**If modified**: All saved baselines in users' `.kindlm/baselines/` directories become invalid.

**Mitigation**: Add version field to baseline JSON and implement migration logic.

---

## 8. Documentation Gaps

| Area | Status | Impact |
|------|--------|--------|
| Cloud API spec | ❌ Missing | Developers must read route handlers to understand endpoints |
| Provider adapter guide | ⚠️ Partial | Adding new provider requires reading openai.ts as template |
| SAML setup guide | ❌ Missing | Customers can't self-serve SAML setup |
| Database schema diagram | ❌ Missing | New developers struggle to understand relationships |
| Assertion type guide | ⚠️ Outdated | Drift & judge assertions underdocumented |

---

## 9. Deployment Gaps

### CI/CD Issues

| Check | Status | Location |
|-------|--------|----------|
| Type checking (core, cli) | ✅ Yes | `.github/workflows/ci.yml:34,70` |
| Type checking (cloud) | ✅ Yes | `.github/workflows/ci.yml:70` |
| Type checking (dashboard) | ❌ No | Dashboard not typechecked in CI |
| Linting | ✅ Yes (core, cli, cloud) | `.github/workflows/ci.yml:36,72` |
| Dashboard linting | ❌ No | Not checked |
| Security scanning | ❌ No | No SAST, supply chain, or dependency scanning |
| Test coverage reporting | ❌ No | No coverage thresholds enforced |

### Production Issues

- **No staging environment**: Direct main → production deployments (via `deploy-cloud.yml`).
  - Recommendation: Add staging Cloudflare Worker for smoke tests.

- **No feature flags**: All features live from deployment. Risky for large releases.
  - Recommendation: Add feature flag system (simple KV-based flags sufficient).

- **No health checks**: Cloud Worker has no `/health` endpoint for monitoring.
  - Recommendation: Add minimal `/health` returning git commit + uptime.

---

## 10. Infrastructure & Monitoring

### Missing Observability

- ❌ No error tracking (Sentry, Rollbar, etc.)
- ❌ No custom metrics (request latency, token usage distribution)
- ❌ No log aggregation (logs go only to Cloudflare Workers runtime)
- ❌ No alerting on D1 slow queries

### Known Limits

| Resource | Limit | Impact |
|----------|-------|--------|
| Cloudflare Workers memory | 128 MB | Baseline comparison may fail for large projects |
| D1 database size | 5 GB (Hobby) | Org with 1000+ runs/day may hit limit in 2-3 months |
| Workers KV namespaces | 1 (Hobby) | Session data sharing requires single KV namespace |
| Request timeout | 30s | Long-running migrations or bulk uploads may timeout |

---

## 11. Known Production Risks (Priority Fixes)

### P0 - Ship blockers

1. **SAML signature verification** — Currently disabled. Attackers could forge assertions.
   - File: `packages/cloud/src/routes/sso.ts`
   - Effort: 1-2 days (integrate xmldsigjs or use passport-saml)

2. **Concurrent test run corruption** — Two simultaneous runs on same suite corrupt baseline.
   - File: `packages/cloud/src/db/queries.ts` (run creation) + middleware
   - Effort: 1 day (add suite-level advisory lock)

3. **Dashboard untested** — Zero unit tests; visual regressions undetected.
   - File: `packages/dashboard/src/`
   - Effort: 3-5 days (add Vitest + testing-library)

### P1 - Important

4. **D1 query indices missing** — Performance degrades at scale.
   - File: `packages/cloud/src/db/schema.sql`
   - Effort: 2 hours (add indices + migration)

5. **VSCode extension untested** — May break on config schema changes.
   - File: `packages/vscode/src/`
   - Effort: 2-3 days (add Vitest)

6. **Webhook routes not implemented** — Feature incomplete (data model exists, routes missing).
   - File: `packages/cloud/src/routes/webhooks.ts` (missing)
   - Effort: 2-3 days (implement CRUD + signature + retry logic)

### P2 - Improve

7. **Large files** — Code complexity increases with each feature.
   - Effort: 2-3 days (refactor schema.ts, queries.ts, sso.ts)

8. **Test coverage** — Dashboard and VSCode at 0%; cloud at 70%.
   - Effort: Ongoing (target 85% across all packages)

9. **Monitoring gaps** — No error tracking or metrics.
   - Effort: 1-2 days (integrate basic error reporting)

---

## Summary Table

| Category | Count | Severity | Effort |
|----------|-------|----------|--------|
| Files over 500 LOC | 4 | Medium | 3-5 days |
| Security issues | 3 | High | 2-3 days |
| Missing features | 6 | Medium | 10-15 days |
| Test coverage gaps | 5 | Medium | 5-7 days |
| Performance issues | 4 | Low-Medium | 1-2 days |
| Fragile code areas | 4 | Medium | 2-3 days |
| Documentation gaps | 5 | Low | 2-3 days |

**Total P0+P1 effort**: ~8-10 days
**Total all**: ~18-25 days (assumes parallel work)

---

## Recommendations (Priority Order)

1. ✅ **Implement SAML signature verification** (1-2 days) — Security blocker
2. ✅ **Add suite-level locking** (1 day) — Data integrity
3. ✅ **Add dashboard tests** (3-5 days) — Regression prevention
4. ✅ **Implement webhook routes** (2-3 days) — Feature completeness
5. Add D1 indices + optimize queries (1-2 days)
6. Add VSCode extension tests (2-3 days)
7. Refactor large files (schema.ts, queries.ts, sso.ts) (3-5 days)
8. Add error tracking (Sentry or similar) (1-2 days)
9. Improve test coverage (cloud, core) to 85% (ongoing)
10. Add API documentation (OpenAPI/Swagger) (2-3 days)
