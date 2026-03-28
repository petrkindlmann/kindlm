# KindLM External Integrations

## AI Provider APIs

All providers implemented via injected `HttpClient` interface. Zero hardcoded API keys in core.

### Supported Providers

#### OpenAI
- **File:** `packages/core/src/providers/openai.ts`
- **Adapter:** `createOpenAIAdapter(httpClient)`
- **Models:** GPT-4o, GPT-4o-mini, GPT-4 Turbo, etc.
- **API Base:** `https://api.openai.com/v1`
- **Authentication:** Bearer token via `Authorization: Bearer sk-...` header
- **Environment Variable:** `OPENAI_API_KEY`
- **Features:** Tool calling, function definitions, streaming support
- **Endpoints Used:**
  - `POST /v1/chat/completions` — Main inference
  - `POST /v1/models` (implied) — Model validation during config parse

#### Anthropic
- **File:** `packages/core/src/providers/anthropic.ts`
- **Adapter:** `createAnthropicAdapter(httpClient)`
- **Models:** Claude Sonnet 4.5, Claude Haiku 4.5, etc.
- **API Base:** `https://api.anthropic.com/v1`
- **Authentication:** Bearer token via `x-api-key: sk-ant-...` header
- **Environment Variable:** `ANTHROPIC_API_KEY`
- **Features:** Tool use, batch processing, vision (planned)
- **Endpoints Used:**
  - `POST /v1/messages` — Inference with tool definitions

#### Google Gemini
- **File:** `packages/core/src/providers/gemini.ts`
- **Adapter:** `createGeminiAdapter(httpClient)`
- **Models:** Gemini 2.0 Flash, Gemini 1.5 Pro, etc.
- **API Base:** `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Authentication:** API key via `Authorization: Bearer ...` header
- **Environment Variable:** `GOOGLE_API_KEY`
- **Features:** Tool use, batch inference
- **Note:** Uses OpenAI-compatible endpoint for reduced refactoring

#### Mistral AI
- **File:** `packages/core/src/providers/mistral.ts`
- **Adapter:** `createMistralAdapter(httpClient)`
- **Models:** Mistral Large, Mistral Medium, etc.
- **API Base:** `https://api.mistral.ai/v1`
- **Authentication:** Bearer token via `Authorization: Bearer ...` header
- **Environment Variable:** `MISTRAL_API_KEY`
- **Features:** Tool calling, batch processing

#### Cohere
- **File:** `packages/core/src/providers/cohere.ts`
- **Adapter:** `createCohereAdapter(httpClient)`
- **Models:** Command R+, Command R, etc.
- **API Base:** `https://api.cohere.com/v1`
- **Authentication:** Bearer token via `Authorization: Bearer ...` header
- **Environment Variable:** `COHERE_API_KEY`
- **Features:** Tool use, streaming

#### Ollama (Local/Self-Hosted)
- **File:** `packages/core/src/providers/ollama.ts`
- **Adapter:** `createOllamaAdapter(httpClient)`
- **Models:** Any model runnable in Ollama (Llama, Mistral, etc.)
- **API Base:** `http://localhost:11434/api` (default, configurable)
- **Authentication:** None (local)
- **Features:** Tool calling (if model supports), no rate limiting
- **Use Case:** Local testing, air-gapped environments

### Provider Interface (Core Abstraction)

**File:** `packages/core/src/providers/interface.ts`

```typescript
interface ProviderAdapter {
  readonly name: string;
  initialize(config: ProviderAdapterConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  estimateCost(model: string, request: ProviderRequest): ModelPricing;
}

interface ProviderResponse {
  text: string;
  toolCalls: ProviderToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  modelId: string;
  latencyMs: number;
  finishReason: "stop" | "max_tokens" | "tool_calls" | "error" | "unknown";
}

interface HttpClient {
  fetch(url: string, init: HttpRequestInit): Promise<HttpResponse>;
}
```

### Provider Factory & Registry

**File:** `packages/core/src/providers/registry.ts`

Maps config string format to adapters:
- `"openai:gpt-4o"` → OpenAI GPT-4o
- `"anthropic:claude-sonnet-4-5-20250929"` → Anthropic Claude
- `"ollama:llama2"` → Local Ollama model
- Format: `provider:model-id`

### Pricing & Cost Estimation

**File:** `packages/core/src/providers/pricing.ts`

Maintains pricing lookup tables for all supported models. Used by:
- Cost assertion (`type: cost` in tests)
- Dashboard cost tracking
- Budget alerts

## Cloudflare Cloud Infrastructure

### Cloudflare Workers (API Server)

**File:** `packages/cloud/wrangler.toml`

```toml
name = "kindlm-api"
main = "src/index.ts"
compatibility_date = "2026-02-01"

routes = [
  { pattern = "api.kindlm.com/*", zone_name = "kindlm.com" }
]

[[d1_databases]]
binding = "DB"
database_name = "kindlm-prod"
database_id = "7fcb217f-d830-4199-955b-a6341bc79fff"

[env.staging]
name = "kindlm-api-staging"
[[env.staging.d1_databases]]
binding = "DB"
database_name = "kindlm-staging"
database_id = "8f1a40fe-1d79-400c-91c5-5b28fb60638d"
```

**Features:**
- Custom domain: `api.kindlm.com` (production) + staging environment
- D1 SQLite bindings (prod + staging databases)
- Cron triggers: Daily cleanup at 02:00 UTC
- Secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Phase 3)

**Framework:** Hono 4.6.0 (lightweight HTTP router)

### Cloudflare D1 (SQLite Database)

**Database IDs:**
- **Production:** `7fcb217f-d830-4199-955b-a6341bc79fff` (kindlm-prod)
- **Staging:** `8f1a40fe-1d79-400c-91c5-5b28fb60638d` (kindlm-staging)

**Schema File:** `packages/cloud/src/db/schema.sql`

**Key Tables:**
- `orgs` — Organizations (free/team/enterprise plans)
- `users` — GitHub-authenticated users
- `org_members` — Organization membership + roles (owner/admin/member)
- `projects` — Test projects per organization
- `suites` — Test suites per project
- `test_runs` — Individual test executions (with commit sha, branch, CI provider)
- `test_results` — Per-test assertion results (pass/fail, tool calls, PII checks)
- `baselines` — Baseline snapshots for drift detection
- `tokens` — API tokens (scoped: full/ci/readonly, project-specific optional)
- `webhooks` — Org webhooks (test event triggers)
- `billing` — Stripe integration (Phase 3)
- `audit_log` — Compliance audit trail
- `signing_keys` — Ed25519 keys for signed compliance reports
- `saml_configs` — SAML SSO configuration (Enterprise)
- `saml_assertions` — SAML assertion replay protection
- `pending_invites` — Team member invitations
- `idempotency_keys` — Request deduplication

**Migrations:** `packages/cloud/src/db/migrations/` (ordered 0001_, 0002_, etc.)

## Authentication & Authorization

### GitHub OAuth

**Files:**
- `packages/cloud/src/routes/oauth.ts` — OAuth flow implementation
- `packages/dashboard/app/login/callback/page.tsx` — OAuth callback handler

**Flow:**
1. User clicks "Sign in with GitHub" on dashboard
2. Redirected to `GET /v1/auth/github` (initiates GitHub OAuth)
3. GitHub redirects to `https://kindlm.com/login/callback?code=...&state=...`
4. Exchanged for access token via `POST https://github.com/login/oauth/access_token`
5. User info fetched from `GET https://api.github.com/user`
6. KindLM JWT token issued + stored in D1

**Environment Variables:**
- `GITHUB_CLIENT_ID` — OAuth app ID
- `GITHUB_CLIENT_SECRET` — OAuth app secret

**JWT Format:**
- Issued by Cloud API
- Stored in `~/.kindlm/credentials` on CLI
- Scoped to org + user roles

### SAML SSO (Enterprise)

**Files:**
- `packages/cloud/src/routes/oauth.ts` — SAML assertion consumer endpoint
- `packages/cloud/src/middleware/auth.ts` — Token validation
- `packages/cloud/src/db/schema.sql` — SAML config + assertion tables

**Features:**
- Assertion signature verification (X.509 certificates)
- Replay protection (assertion ID tracking)
- Just-in-time user provisioning
- Role mapping from SAML attributes

**Configuration:**
- `saml_configs` table stores IdP metadata
- `saml_assertions` tracks used assertion IDs (prevents replay attacks)
- Endpoint: `POST /v1/auth/saml/acs` (Assertion Consumer Service)

## API Token Authentication

**File:** `packages/cloud/src/routes/auth.ts`

**Token Scopes:**
- `full` — All operations
- `ci` — Read-only + test uploads
- `readonly` — Query results only

**Storage:** Hashed in D1 (`tokens.token_hash`)

**CLI Usage:**
```bash
kindlm login --token <API_TOKEN>
kindlm upload -p <project>
```

## Webhooks & Notifications

### Webhook System

**Files:**
- `packages/cloud/src/routes/webhooks.ts` — CRUD webhook config
- `packages/cloud/src/webhooks/dispatch.ts` — Event dispatcher
- `packages/cloud/src/webhooks/slack-format.ts` — Slack message formatter

**Supported Events:**
- `test_run.complete` — Run finished (pass/fail)
- `test_run.regression` — Baseline regression detected
- `team_member.joined` — New org member
- `billing.subscription_changed` — Plan upgrade/downgrade

**Slack Integration:**
- Formats test results as rich Slack messages
- Includes run stats, pass rate, duration
- Links to dashboard run detail page

### Slack Webhook (Outbound)

Orgs can configure custom webhook URLs (stored in `webhooks` table):
- Validates secret via HMAC-SHA256
- POSTs event payload on test completion
- Retries on 5xx with exponential backoff

## Stripe Integration (Phase 3 — Billing)

**Files:**
- `packages/cloud/src/routes/billing.ts` — Billing API
- `packages/cloud/src/db/schema.sql` — `billing` table

**Features (In Development):**
- Subscription management (free → team/enterprise)
- Monthly billing cycles
- Usage metrics (test runs, storage)
- Webhook support for subscription events

**Stripe Secrets:**
- `STRIPE_SECRET_KEY` — API key
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification

## CI/CD Integration

### GitHub Actions Workflows

**Files:**
- `.github/workflows/test.yml` — Lint, type check, test
- `.github/workflows/deploy-cloud.yml` — Deploy Cloud to staging/prod
- `.github/workflows/deploy-dashboard.yml` — Deploy Dashboard
- `.github/workflows/release.yml` — Release to npm

**Environment Detection:**
- Auto-detects CI provider (`GITHUB_ACTIONS=true`)
- Captures git metadata: `GITHUB_SHA`, `GITHUB_REF`, branch
- Stores in test run record for traceability

### Dashboard CI Context

**File:** `packages/cli/src/utils/env.ts`

Detects & extracts:
- GitHub Actions (`GITHUB_ACTIONS`, `GITHUB_SHA`, `GITHUB_REF`)
- GitLab CI (`GITLAB_CI`, `CI_COMMIT_SHA`, `CI_COMMIT_REF_NAME`)
- Generic CI (`CI=true`)

## Data Encryption

**File:** `packages/cloud/src/crypto/envelope.ts`

Uses envelope encryption for sensitive data:
- Private keys encrypted with org-specific key
- SAML certificates stored encrypted
- Supports key rotation

**Algorithm:** ChaCha20-Poly1305 (AEAD cipher)

## API Rate Limiting

**File:** `packages/cloud/src/middleware/rate-limit.ts`

Per-organization rate limits (using Cloudflare KV):
- Free: 100 requests/minute
- Team: 1,000 requests/minute
- Enterprise: No limit

## Plan Feature Gating

**File:** `packages/cloud/src/middleware/plan-gate.ts`

Enforces plan-based access control:
- Free: CLI only, 7-day history
- Team ($49/mo): Dashboard, 90-day history, 5 projects, Slack webhooks
- Enterprise ($299/mo): Unlimited projects, SAML SSO, audit log API, signed compliance reports, SLA

## Summary Table

| System | Purpose | Auth | Cloudflare | Open-Core |
|--------|---------|------|------------|-----------|
| OpenAI API | GPT-4o inference | API key (user) | No | No |
| Anthropic API | Claude inference | API key (user) | No | No |
| Google Gemini | Gemini inference | API key (user) | No | No |
| Mistral API | Mistral inference | API key (user) | No | No |
| Cohere API | Cohere inference | API key (user) | No | No |
| Ollama (local) | Local inference | None | No | Yes |
| GitHub OAuth | Team auth | OAuth app | Cloudflare | Yes |
| SAML SSO | Enterprise auth | X.509 certs | Cloudflare | Yes |
| Cloudflare Workers | API server | JWT | Yes | Yes |
| D1 SQLite | Data persistence | JWT | Yes | Yes |
| Stripe | Billing | Secret key | Cloudflare (Phase 3) | No |
| Slack Webhooks | Test notifications | HMAC-SHA256 | No | Yes |
