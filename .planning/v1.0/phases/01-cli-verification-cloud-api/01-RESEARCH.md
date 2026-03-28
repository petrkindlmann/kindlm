# Phase 1 Research: CLI Verification & Cloud API

**Date:** 2026-03-27
**Scope:** CLI-01 through CLI-05, CLOUD-01, CLOUD-02, CLOUD-04 through CLOUD-07

---

## CLI-01: `npx @kindlm/cli init` works on a clean machine

### What exists and works
- **Shebang:** `tsup.config.ts` (line 22) adds `#!/usr/bin/env node` banner to `src/bin/kindlm.ts` entry. Verified: `dist/kindlm.js` starts with `#!/usr/bin/env node`.
- **Bin field:** `package.json` has `"bin": { "kindlm": "./dist/kindlm.js" }`.
- **Files field:** `"files": ["dist", "README.md"]` -- `dist/` is included in the npm package.
- **Executable permission:** `dist/kindlm.js` has `-rwxr-xr-x` (755). This comes from the build, but npm preserves it.
- **ESM resolution:** `"type": "module"` in package.json, tsup builds ESM entry for bin, CJS+ESM for library exports. `"exports"` field has `types` before `import`/`require` (correct order per MEMORY.md).
- **Init command:** `packages/cli/src/commands/init.ts` writes a valid `kindlm.yaml` template. Handles existing file (rejects unless `--force`), permission errors.

### What's missing or broken
- **No integration test for `npx` flow.** There's no CI step that does `npm pack && npx ./kindlm-cli-*.tgz init`.
- **Version is 0.4.1.** Not blocking for testing, but the `npx @kindlm/cli` install will pull whatever is published on npm. Local testing requires `npm pack`.

### Specific changes needed
1. Add a CI job (or local script) that runs: `npm pack` in `packages/cli/`, then `npx ./kindlm-cli-0.4.1.tgz init` in a temp directory, then validates the output `kindlm.yaml` exists and is valid YAML.
2. Verify the template YAML produced by `init` actually passes `kindlm validate` (it should, but untested E2E).

### Risks
- **Low.** The build setup looks correct. The main risk is an edge case in npm's ESM bin resolution across Node versions. The `npm pack` test would catch this.

---

## CLI-02: `kindlm test` against real OpenAI API passes E2E

### What exists and works
- **Full pipeline:** `commands/test.ts` -> `utils/run-tests.ts` -> `@kindlm/core` runner. The flow is: read YAML -> parse config -> create provider adapters -> create runner -> execute tests -> evaluate assertions -> report -> exit.
- **Provider creation:** `run-tests.ts` iterates `config.providers`, reads API key from env var, calls `createProvider(name, httpClient)`, then `adapter.initialize(...)`.
- **OpenAI adapter:** Exists in `@kindlm/core` (via `createProvider`).
- **Assertion evaluation:** All 11 assertion types implemented and registered.
- **149+ unit tests pass.**

### What's missing or broken
- **No E2E test with a real API key.** All provider tests mock HTTP responses.
- **No sample `kindlm.yaml` validated against a real provider.** The `init` template uses `gpt-4o` but nobody has run it end-to-end.

### Specific changes needed
1. Create a minimal E2E test script: uses the `init` template (or a simplified version), sets `OPENAI_API_KEY` from env, runs `kindlm test`, checks exit code.
2. This should be manual or CI-gated (requires a secret key), not part of `npm test`.

### Risks
- **Medium.** Real API responses may differ from mocked ones. Tool call format, token counting, or cost estimation could be subtly wrong. The E2E test is the only way to catch this.
- **API key cost:** A single `gpt-4o` call with the template prompt costs ~$0.01. Negligible.

---

## CLI-03: Exit code contract

### What exists and works
- **Exit 0 on all pass:** `test.ts` line 117: `process.exit(allPassed ? 0 : 1)` where `allPassed = result.failed === 0 && result.errored === 0 && gateEvaluation.passed`.
- **Exit 1 on any fail:** Same line -- if any test fails, errored, or gate fails, exits 1.
- **Exit 1 on config error:** `run-tests.ts` calls `process.exit(1)` on config file not found (line 78), parse failure (line 101), invalid --runs/--gate (lines 118, 123), missing env var (line 150), provider creation failure (line 164), run failure (line 208).
- **Exit 1 on provider error:** `test.ts` catch block (lines 119-143) catches `ProviderError` (timeout, network, auth, rate limit) and exits 1.
- **Unhandled rejection handler:** `bin/kindlm.ts` lines 3-8 catches unhandled rejections and exits 1 with message to stderr.
- **Uncaught exception handler:** `bin/kindlm.ts` lines 10-13 catches uncaught exceptions and exits 1.
- **SIGINT:** `run-tests.ts` exits 130 on interrupt.

### What's missing or broken
- **No integration tests for exit codes.** The contract is implemented but not verified by tests.
- **`process.exit()` in `run-tests.ts` is a testing problem.** The function calls `process.exit(1)` directly for config errors instead of throwing. This makes it hard to test exit codes without spawning a child process.

### Specific changes needed
1. Add integration tests that spawn `kindlm test` as a child process with various inputs and assert exit codes:
   - Valid config + mocked pass -> exit 0
   - Valid config + mocked fail -> exit 1
   - Invalid YAML -> exit 1
   - Missing config file -> exit 1
   - Missing API key env var -> exit 1
2. Consider refactoring `run-tests.ts` to throw errors instead of calling `process.exit()` directly (lower priority -- the child process tests cover the contract).

### Risks
- **Low.** The exit code logic is straightforward and correctly placed. The risk is edge cases where an error falls through to an unhandled path.

---

## CLI-04: `kindlm validate` catches invalid config without requiring API keys

### What exists and works
- **Validate command:** `commands/validate.ts` reads the YAML file, calls `parseConfig()` from core (Zod validation), and prints errors or success summary. No provider initialization, no API keys needed.
- **Error reporting:** Shows list of validation errors from Zod. Exits 1 on failure, 0 on success.
- **File-not-found handling:** Catches missing config file and exits 1 with message to stderr.

### What's missing or broken
- **Nothing structurally broken.** The command correctly separates validation from execution.
- **No test for the command itself.** There are core tests for `parseConfig()` but no CLI-level test for `kindlm validate`.

### Specific changes needed
1. Add integration test: `kindlm validate -c valid.yaml` exits 0, `kindlm validate -c invalid.yaml` exits 1.
2. Test that no API key env vars are referenced during validation.

### Risks
- **Very low.** This is a thin wrapper around `parseConfig()` which is well-tested.

---

## CLI-05: stderr/stdout separation

### What exists and works
- **Errors go to stderr:** All `console.error()` calls in `test.ts` and `run-tests.ts` write to stderr (chalk-colored errors, validation failures, provider errors).
- **Test output goes to stdout:** `console.log(report.content)` in `test.ts` line 63 writes the test report to stdout.
- **Compliance report routing:** When using machine-readable reporters (json/junit), compliance output goes to stderr (line 89). When using pretty reporter, it goes to stdout (line 87). This is correct -- machine-readable output on stdout shouldn't be mixed with compliance markdown.
- **Validate command:** Success output to stdout (`console.log`), errors to stderr (`console.error`).
- **Init command:** Success output to stdout, errors to stderr.
- **Unhandled errors:** `bin/kindlm.ts` writes to `process.stderr.write()` directly.

### What's missing or broken
- **`run-tests.ts` warning on --gate goes to stderr.** Line 128: `console.error(chalk.yellow(...))` -- this is correct behavior (warnings to stderr).
- **Spinner output:** The ora spinner writes to stderr by default in most configurations. Need to verify this doesn't pollute stdout.

### Specific changes needed
1. Verify spinner output goes to stderr (check ora configuration or createSpinner wrapper).
2. Add a test: run `kindlm test --reporter json` and verify stdout is valid JSON (no spinner text, no error messages mixed in).

### Risks
- **Low.** The separation looks intentionally implemented. The main risk is the spinner leaking to stdout.

---

## CLOUD-01: Cloud API deployed at api.kindlm.com (GET /health returns 200)

### What exists and works
- **Health endpoint:** `packages/cloud/src/index.ts` lines 68-75. `GET /health` queries D1 with `SELECT 1`, returns `{"status":"ok"}` on success, `{"status":"degraded","error":"Database unreachable"}` with 503 on failure.
- **Wrangler config:** `wrangler.toml` has route `api.kindlm.com/*` on zone `kindlm.com`, D1 binding for `kindlm-prod`.
- **Global error handler:** Line 28 catches unhandled errors and returns 500 without leaking stack traces.

### What's missing or broken
- **API is currently broken in production** (per STATE.md: "Cloud API is currently broken in production"). Unknown root cause -- could be missing secrets, D1 schema not applied, or deployment issue.
- **No secret validation at startup.** If `GITHUB_CLIENT_ID` is undefined, the app starts fine but OAuth crashes at runtime.

### Specific changes needed
1. **Diagnose production failure.** Run `curl -sf https://api.kindlm.com/health` to see the current error. Check:
   - Is the Worker deployed? (`npx wrangler deployments list`)
   - Are secrets set? (`npx wrangler secret list`)
   - Is D1 schema applied? (`npx wrangler d1 execute kindlm-prod --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`)
2. **Deploy fresh.** If schema is missing, apply migrations first, then deploy.
3. **Add startup validation** (see CLOUD-05 below).

### Risks
- **High.** This is the top blocker. If D1 schema is corrupted or missing, health will fail until fixed. If secrets are missing, OAuth will crash.

---

## CLOUD-02: GitHub OAuth login flow works E2E

### What exists and works
- **OAuth initiation:** `GET /auth/github` (oauth.ts line 80) redirects to GitHub with `client_id`, `redirect_uri`, `scope`, and HMAC-signed `state` for CSRF protection.
- **OAuth callback:** `GET /auth/github/callback` (line 136) exchanges code for GitHub access token, fetches user info + email, creates/finds user + org, generates `klm_` API token, stores hashed token.
- **Dashboard flow:** If `redirect_uri` was in state, stores an encrypted short-lived auth code (30s TTL) in D1, redirects to dashboard with `?code=...`. Dashboard calls `POST /auth/exchange` to get the real token.
- **CLI flow:** If no redirect_uri, renders an HTML page with the token for copy-paste.
- **State verification:** HMAC-signed with `GITHUB_CLIENT_SECRET`, timing-safe comparison.
- **Auth code encryption:** Token encrypted with `encryptWithSecret()` before storage, decrypted on exchange.
- **Token format:** `klm_` prefix + 16 random bytes hex = 36 chars.

### What's missing or broken
- **Callback URL is dynamically constructed.** Line 82: `const redirectUri = new URL("/auth/github/callback", c.req.url).toString()`. Behind Cloudflare proxy, `c.req.url` may have the wrong host/protocol. This was flagged in PITFALLS.md as a critical issue. The GitHub OAuth app settings must have the exact callback URL registered, and a mismatch will cause GitHub to reject the request.
- **No token expiry on OAuth-generated tokens.** Line 249-257: `createToken()` is called with `null` for `expiresAt` parameter. Login tokens are permanent. Only SSO tokens have 24h expiry (sso.ts line 447).
- **No cleanup of old login tokens.** The scheduled handler (index.ts lines 113-141) cleans up auth_codes and saml_assertions but does NOT clean up expired/old tokens.

### Specific changes needed
1. **Hard-code callback URL** (see CLOUD-06 below).
2. **Set 90-day expiry on OAuth tokens** -- pass `expiresAt` to `createToken()` in oauth.ts.
3. **Add scheduled cleanup for expired tokens** -- add to the scheduled handler.
4. **Test E2E manually:** Create a GitHub OAuth App with `https://api.kindlm.com/auth/github/callback`, set secrets, test the full flow in browser.

### Risks
- **Medium-High.** The dynamic URL construction is the biggest risk. If `c.req.url` returns `http://` instead of `https://`, or includes a Cloudflare internal hostname, the OAuth flow silently breaks for all users.

---

## CLOUD-04: Worker secrets configured

### What exists and works
- **Wrangler.toml documents required secrets** (lines 20-24): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, plus Phase 3 secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Types define bindings:** `types.ts` Bindings interface lists `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SIGNING_KEY_SECRET` as required strings, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as optional.
- **Staging environment defined** in wrangler.toml with separate D1 database.

### What's missing or broken
- **Unknown if secrets are actually set in production.** Need to run `npx wrangler secret list` to verify.
- **`SIGNING_KEY_SECRET`** is in the Bindings type but not mentioned in wrangler.toml comments. This is needed for envelope encryption (used in auth code encryption).

### Specific changes needed
1. Run `npx wrangler secret list` (prod and staging) to audit current state.
2. Set missing secrets:
   ```
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   npx wrangler secret put SIGNING_KEY_SECRET
   ```
3. For staging:
   ```
   npx wrangler secret put GITHUB_CLIENT_ID --env staging
   npx wrangler secret put GITHUB_CLIENT_SECRET --env staging
   npx wrangler secret put SIGNING_KEY_SECRET --env staging
   ```
4. Update wrangler.toml comments to include `SIGNING_KEY_SECRET`.

### Risks
- **Medium.** Secrets are per-environment. Easy to set them in prod but forget staging (or vice versa). The secret validation at startup (CLOUD-05) mitigates this.

---

## CLOUD-05: Worker validates required secrets at startup, fails fast if missing

### What exists and works
- **Nothing.** There is no secret validation at startup. The Worker starts successfully even if all secrets are undefined. Errors only occur when a route actually tries to use a missing secret (e.g., OAuth crashes when `GITHUB_CLIENT_ID` is undefined).

### What's missing or broken
- **No startup validation.** This was explicitly called out in SUMMARY.md item #5: "Add Worker startup secret validation. OAuth crashes if `GITHUB_CLIENT_ID` is undefined."

### Specific changes needed
1. Add a middleware or initialization check that validates required secrets exist before handling any request. In Cloudflare Workers, there is no `module.start()` lifecycle hook, so this must be done as a middleware on every request (with caching after first check) or in a wrapper around `app.fetch`.
2. Recommended approach -- add a middleware early in the chain:
   ```typescript
   app.use("*", (c, next) => {
     const required = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SIGNING_KEY_SECRET"] as const;
     const missing = required.filter((k) => !c.env[k]);
     if (missing.length > 0) {
       console.error(`Missing required secrets: ${missing.join(", ")}`);
       return c.json({ error: "Server misconfigured" }, 500);
     }
     return next();
   });
   ```
3. Exempt `/health` from this check (so monitoring can still detect the issue).

### Risks
- **Low.** Simple middleware addition. The only nuance is ensuring `/health` still works when secrets are missing (for diagnostics).

---

## CLOUD-06: OAuth callback URL hard-coded per environment

### What exists and works
- **Dynamic construction:** oauth.ts line 82: `const redirectUri = new URL("/auth/github/callback", c.req.url).toString()`. This derives the callback URL from the incoming request URL.

### What's missing or broken
- **Behind Cloudflare proxy, `c.req.url` may be wrong.** The `Host` header and protocol can differ from what the user sees. This causes a mismatch with the GitHub OAuth App's registered callback URL, breaking the entire login flow.
- **SUMMARY.md item #6:** "Hard-code OAuth callback URL. Dynamic construction from `c.req.url` breaks behind Cloudflare proxy."

### Specific changes needed
1. Replace dynamic URL construction with environment-based hard-coding:
   ```typescript
   const callbackUrl = c.env.ENVIRONMENT === "production"
     ? "https://api.kindlm.com/auth/github/callback"
     : "https://staging-api.kindlm.com/auth/github/callback";
   ```
2. Alternatively, add an `OAUTH_CALLBACK_URL` var to wrangler.toml per environment.
3. Register the exact callback URL in the GitHub OAuth App settings.

### Risks
- **Critical if not fixed.** This is a one-line fix but causes complete OAuth failure if missed. The current dynamic approach may "work" in some cases (if CF passes the correct Host header) but is fundamentally unreliable.

---

## CLOUD-07: Token expiry set (90 days) with cleanup

### What exists and works
- **Token table supports expiry:** `expires_at TEXT` column exists in the tokens table (schema.sql line 51, migrations/0001_initial.sql line 58).
- **Token query respects expiry:** `getTokenByHash()` (queries.ts line 279) includes `(expires_at IS NULL OR expires_at > datetime('now'))` in the WHERE clause. Expired tokens are automatically rejected.
- **SSO tokens have 24h expiry:** sso.ts line 447 passes `tokenExpiresAt` to `createToken()`.
- **Scheduled cleanup exists** for auth_codes and saml_assertions (index.ts lines 135-137).

### What's missing or broken
- **OAuth login tokens have no expiry.** oauth.ts line 249-257: `createToken()` is called with `null` for `expiresAt`. Every login creates a permanent token.
- **No scheduled cleanup for expired tokens.** The cron handler cleans auth_codes and saml_assertions but not tokens with past `expires_at`.
- **No cap on tokens per user/org.** A user who logs in daily creates a new permanent token each time. No limit, no cleanup.

### Specific changes needed
1. **Set 90-day expiry on OAuth login tokens.** In oauth.ts, compute expiry:
   ```typescript
   const TOKEN_EXPIRY_DAYS = 90;
   const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
   ```
   Pass `expiresAt` to `createToken()` instead of `null`.
2. **Add token cleanup to scheduled handler.** In index.ts `handleScheduled`:
   ```typescript
   await env.DB.prepare("DELETE FROM tokens WHERE expires_at IS NOT NULL AND expires_at < datetime('now')").run();
   ```
3. **Optional:** Add a cap of ~10 active tokens per org. When creating a new login token, delete the oldest if count exceeds threshold.

### Risks
- **Low for the fix.** Setting expiry is a one-line change. The scheduled cleanup is straightforward.
- **Migration concern:** Existing permanent tokens (from previous logins) will remain permanent unless a one-time migration sets their `expires_at`. Consider running:
  ```sql
  UPDATE tokens SET expires_at = datetime(created_at, '+90 days') WHERE expires_at IS NULL AND name LIKE 'login-%';
  ```

---

## Summary: Effort Estimates

| Requirement | Status | Effort | Blockers |
|-------------|--------|--------|----------|
| CLI-01 | Mostly works, needs E2E test | 1h | None |
| CLI-02 | Needs real API E2E test | 1h | OPENAI_API_KEY |
| CLI-03 | Implemented, needs integration tests | 2h | None |
| CLI-04 | Works, needs CLI-level test | 30m | None |
| CLI-05 | Works, verify spinner | 30m | None |
| CLOUD-01 | Broken in prod, needs diagnosis + deploy | 1-3h | Unknown root cause |
| CLOUD-02 | OAuth flow implemented but callback URL broken | 1h | CLOUD-01, CLOUD-04, CLOUD-06 |
| CLOUD-04 | Need to audit + set secrets | 30m | Wrangler access |
| CLOUD-05 | Not implemented | 30m | None |
| CLOUD-06 | Not implemented (dynamic URL) | 15m | None |
| CLOUD-07 | Not implemented (no expiry, no cleanup) | 30m | None |

**Total estimated effort:** 8-10 hours

**Critical path:** CLOUD-01 (diagnose prod) -> CLOUD-04 (set secrets) -> CLOUD-06 (fix callback URL) -> CLOUD-05 (add validation) -> CLOUD-07 (add expiry) -> deploy -> CLOUD-02 (test OAuth E2E)

**CLI items are independent** and can be worked in parallel with Cloud items.
