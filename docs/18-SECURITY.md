# KindLM — Security Model

---

## 1. Threat Model

KindLM handles two categories of sensitive data:

| Data | Where | Risk |
|------|-------|------|
| **Provider API keys** (OpenAI, Anthropic) | CLI user's machine | Key theft → unauthorized API usage, billing impact |
| **Test content** (prompts, responses, tool args) | CLI output + Cloud DB | May contain PII, proprietary prompts, business logic |

### Attack surface:

| Vector | Component | Mitigation |
|--------|-----------|------------|
| API key exposure in logs/reports | CLI | Keys never logged, never in reports |
| API key in config file (committed to git) | CLI | Env var resolution only, warn if literal key detected |
| Man-in-the-middle on provider calls | CLI | HTTPS only, TLS 1.2+ enforced |
| Unauthorized Cloud access | Cloud API | Token auth, org isolation |
| Cross-org data access | Cloud API | All queries scoped to org_id from token |
| Report tampering | Cloud | SHA-256 hashes, Enterprise signed reports |
| Rate limit abuse | Cloud API | Per-org rate limiting |
| Token theft | Cloud | Token rotation, scoped permissions |

---

## 2. API Key Management (CLI)

### Storage

Provider API keys are **never stored by KindLM**. They're resolved at runtime from environment variables.

```yaml
# kindlm.yaml — keys are env var REFERENCES, not values
providers:
  - id: openai
    model: gpt-4o
    api_key: ${OPENAI_API_KEY}  # Resolved at runtime

  - id: anthropic
    model: claude-sonnet-4-5-20250514
    api_key: ${ANTHROPIC_API_KEY}
```

### Resolution order:

1. Environment variable (e.g., `OPENAI_API_KEY`)
2. `.env` file in project root (loaded via `dotenv`, not committed)
3. Config file `${VAR_NAME}` syntax (resolved to env var)

### Protections:

| Protection | Implementation |
|-----------|---------------|
| Literal key detection | Config parser warns if `api_key` value doesn't start with `$` |
| No key in logs | Logger redacts any string matching API key patterns (`sk-*`, `klm_*`) |
| No key in reports | JSON/JUnit/compliance reporters never include provider config |
| No key in baselines | Baseline files contain responses only, not request auth |
| `.env` in `.gitignore` | `kindlm init` adds `.env` to `.gitignore` if not already present |

### Key pattern detection (redaction):

```typescript
const KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,          // OpenAI
  /sk-ant-[a-zA-Z0-9-]{20,}/g,     // Anthropic
  /klm_[a-f0-9]{48}/g,             // KindLM Cloud token
];

function redact(text: string): string {
  let result = text;
  for (const pattern of KEY_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}
```

---

## 3. Cloud Authentication

### Token format

```
klm_ + 48 hex characters
Example: klm_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6
```

Generated server-side using `crypto.getRandomValues()`. Stored hashed (SHA-256) in D1. The raw token is shown once to the user and never stored in plaintext on the server.

### Authentication flow

```
1. User creates API token in KindLM Cloud dashboard (or via POST /v1/auth/tokens)
2. User runs `kindlm login` and pastes the token interactively
   (or passes --token <token>, or sets KINDLM_API_TOKEN env var)
3. CLI validates token format (klm_ prefix) and verifies against Cloud API
4. Token is stored in ~/.kindlm/credentials (file permissions 600, directory 700)
```

### Token lifecycle

| Event | Action |
|-------|--------|
| Login | New token generated, old tokens for this device revoked |
| Logout (`kindlm logout`) | Token revoked server-side, local file deleted |
| 90 days of inactivity | Token expires, user must re-login |
| Suspicious activity | Admin can revoke all org tokens from dashboard |

### Token storage (client-side)

```
~/.kindlm/credentials (chmod 600, directory chmod 700)

{
  "token": "klm_a1b2c3...",
  "savedAt": "2026-02-15T12:00:00Z"
}
```

Token resolution order: `--token` flag → `KINDLM_API_TOKEN` env var → stored credentials file.

---

## 4. Cloud Authorization (RBAC)

### Roles

| Role | Create project | Upload runs | View results | Manage members | Billing |
|------|---------------|-------------|-------------|----------------|---------|
| **Member** | — | ✓ | ✓ | — | — |
| **Admin** | ✓ | ✓ | ✓ | ✓ | — |
| **Owner** | ✓ | ✓ | ✓ | ✓ | ✓ |

- Every org has exactly one Owner (the person who created it)
- Owner can transfer ownership to another Admin
- Admins can promote Members to Admin and demote Admins to Member
- Owner can demote Admins

### Org isolation

**Every database query includes `org_id` in the WHERE clause.** This is enforced at the middleware level, not per-route.

```typescript
// packages/cloud/src/middleware/org-scope.ts
export function orgScope(): MiddlewareHandler {
  return async (c, next) => {
    const orgId = c.get('orgId'); // Set by auth middleware
    
    // Inject org_id into D1 query context
    c.set('db', scopedDb(c.env.DB, orgId));
    
    await next();
  };
}

// Usage in route handler:
app.get('/v1/projects', orgScope(), async (c) => {
  const db = c.get('db');
  // This ALWAYS includes WHERE org_id = ?
  const projects = await db.query('SELECT * FROM projects');
  return c.json({ data: projects });
});
```

### Scoped DB wrapper

```typescript
function scopedDb(db: D1Database, orgId: string) {
  return {
    async query(sql: string, ...params: unknown[]) {
      // Validate that org_id is in the query
      // This is a safety net, not the primary mechanism
      const scopedSql = injectOrgScope(sql, orgId);
      return db.prepare(scopedSql).bind(...params, orgId).all();
    }
  };
}
```

---

## 5. Data Protection

### Data at rest

| Data | Storage | Encryption |
|------|---------|-----------|
| Test results (D1) | Cloudflare D1 | Encrypted at rest by Cloudflare |
| Compliance reports (D1) | Cloudflare D1 | Encrypted at rest by Cloudflare |
| API tokens (D1) | SHA-256 hashed | Not reversible |
| Audit logs (D1) | Cloudflare D1 | Encrypted at rest, immutable |

### Data in transit

All communication over HTTPS (TLS 1.2+). Cloudflare handles TLS termination.

### Data retention

| Plan | Retention | Enforcement |
|------|-----------|-------------|
| Free | 7 days | Cron worker deletes daily |
| Team | 90 days | Cron worker deletes daily |
| Enterprise | Unlimited | No automatic deletion |

Deletion is hard delete (rows removed from D1), not soft delete.

### Data export

Users can export all their data via API:
- `GET /v1/projects` → all projects
- `GET /v1/projects/:id/runs?per_page=100` → all runs with pagination
- Individual run details include full test results

### Data deletion

- Users can delete individual projects (cascades to all runs)
- Org deletion removes all data (Owner only, requires confirmation)
- Account deletion removes user from all orgs, deletes owned orgs

---

## 6. Rate Limiting

### Cloud API rate limits

Implemented via Cloudflare Workers KV with sliding window counter.

```typescript
// packages/cloud/src/middleware/rate-limit.ts
export function rateLimit(limits: PlanLimits): MiddlewareHandler {
  return async (c, next) => {
    const orgId = c.get('orgId');
    const plan = c.get('plan');
    const limit = limits[plan]; // { requests: 1000, window: 3600 }
    
    const key = `rate:${orgId}:${currentHour()}`;
    const kv = c.env.RATE_LIMITS;
    
    const current = parseInt(await kv.get(key) ?? '0');
    
    if (current >= limit.requests) {
      c.header('X-RateLimit-Limit', String(limit.requests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('Retry-After', String(secondsUntilNextHour()));
      return c.json(
        { error: 'rate_limited', message: 'Rate limit exceeded' },
        429
      );
    }
    
    await kv.put(key, String(current + 1), { expirationTtl: 3600 });
    
    c.header('X-RateLimit-Limit', String(limit.requests));
    c.header('X-RateLimit-Remaining', String(limit.requests - current - 1));
    
    await next();
  };
}
```

### CLI-side rate limiting

The CLI does NOT rate-limit provider API calls by default. Users control concurrency via:
- `--concurrency N` (default: 5 parallel test cases)
- Provider-specific rate limits can be configured in YAML

---

## 7. Supply Chain Security

### npm package

- Published from CI only (GitHub Actions with npm provenance)
- `npm publish --provenance` generates sigstore attestation
- `package-lock.json` committed and used in CI (`npm ci`)
- Dependabot enabled for security updates
- `npm audit` runs in CI — build fails on critical vulnerabilities

### Dependencies (minimal)

Core and CLI use minimal dependencies to reduce attack surface:

| Package | Purpose | Audit Status |
|---------|---------|-------------|
| `yaml` | YAML parsing | Widely used, well-maintained |
| `zod` | Schema validation | Widely used, no native code |
| `ajv` | JSON Schema validation | Industry standard |
| `commander` | CLI framework | Most popular Node.js CLI lib |
| `chalk` | Terminal colors | Zero dependencies |

No native modules. No post-install scripts. No `node-gyp`.

---

## 8. Compliance Report Integrity

### Hash chain

Every compliance report includes SHA-256 hashes for tamper detection:

```
config_hash = SHA-256(kindlm.yaml contents)
report_hash = SHA-256(JSON report contents)
compliance_hash = SHA-256(compliance markdown contents)
chain_hash = SHA-256(config_hash + report_hash + compliance_hash)
```

The `chain_hash` is included in the compliance document footer. If any file is modified, the chain breaks.

### Enterprise: Digital signatures

Enterprise plan adds Ed25519 digital signatures:

1. Org generates a signing key pair in the Cloud dashboard
2. Private key stored encrypted in Cloudflare Workers Secrets
3. Public key downloadable for verification
4. Compliance reports signed: `Ed25519-Sign(chain_hash, private_key)`
5. Verification: `GET /v1/reports/:id/verify` checks signature

---

## 9. Incident Response

| Severity | Example | Response Time | Action |
|----------|---------|--------------|--------|
| Critical | API key exposed in public report | < 1 hour | Emergency patch, notify affected users |
| High | Auth bypass in Cloud API | < 4 hours | Patch, security advisory, token rotation |
| Medium | Rate limit bypass | < 24 hours | Patch in next release |
| Low | Information disclosure in error messages | < 1 week | Fix in normal release cycle |

### Responsible disclosure

Security issues reported to `security@kindlm.com`. No public disclosure until fix is available. Credit to reporter in advisory.

---

## 10. Security Checklist for Contributors

Before merging any PR:

- [ ] No API keys, tokens, or secrets in code or tests
- [ ] No `eval()`, `Function()`, or dynamic code execution
- [ ] No `child_process.exec()` with user input (use `execFile` with explicit args)
- [ ] All user input validated via Zod before use
- [ ] All database queries parameterized (no string concatenation)
- [ ] All HTTP responses include security headers (Cloud)
- [ ] No sensitive data in error messages shown to users
- [ ] Dependencies added only if strictly necessary
- [ ] `npm audit` passes with no critical/high vulnerabilities
