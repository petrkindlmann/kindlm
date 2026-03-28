# KindLM Architecture

## Monorepo Overview

KindLM is a TypeScript monorepo with 5 packages orchestrated by Turbo v2.8+:

```
packages/
├── core/      → Pure business logic (zero I/O, zero provider API calls)
├── cli/       → CLI entry point (Node.js 20+, terminal UI)
├── cloud/     → Cloudflare Workers API (serverless, D1 database)
├── dashboard/ → Next.js SPA (React 19, SSR + static export)
└── vscode/    → VS Code extension (TypeScript, esbuild-bundled)
```

## Package Dependency Graph

```
cli → core
cloud (imports types only from core)
dashboard (no internal dependencies, calls cloud API)
vscode (no internal dependencies)
```

**Strict Dependency Rules:**
- `core` never imports from `cli`, `cloud`, `dashboard`, or `vscode`
- `cli` depends on `core` for all business logic
- `cloud` uses Zod for validation; never imports runtime code from `core`
- `dashboard` and `vscode` are standalone consumers of cloud API
- All provider API keys are user-owned (never proxied through cloud)

## Architectural Layers

### Layer 1: Core (`@kindlm/core`)

Pure, testable, I/O-free business logic. Implements the test runner engine and all assertions.

**Internal modules:**

- **config/** — YAML parsing, Zod validation, variable interpolation
  - `schema.ts` — Zod schema for kindlm.yaml
  - `parser.ts` — YAML load + validate + file reference resolution
  - `interpolation.ts` — Template var expansion: `{{env.VAR}}`

- **types/** — All type definitions and interfaces
  - `config.ts` — `KindLMConfig`, `TestCase`, `Expect`, etc.
  - `provider.ts` — `ProviderAdapter`, `ProviderRequest`, `ProviderResponse`, `ProviderToolCall`
  - `result.ts` — Result<T, E> type for error handling (no throw)

- **providers/** — Multi-provider adapter pattern
  - `interface.ts` — `ProviderAdapter` interface
  - `openai.ts`, `anthropic.ts`, `gemini.ts`, `mistral.ts`, `cohere.ts`, `ollama.ts` — Implementations
  - `registry.ts` — Factory: `"openai:gpt-4o"` → ProviderAdapter instance
  - `pricing.ts` — Token cost calculation per provider/model
  - `retry.ts` — Exponential backoff + resilience
  - `conversation.ts` — Multi-turn conversation runner

- **assertions/** — Test assertion handlers (11 types)
  - `interface.ts` — `Assertion`, `AssertionContext`, `AssertionResult`
  - `tool-calls.ts` — `tool_called`, `tool_not_called`, `tool_order`
  - `schema.ts` — JSON Schema validation (AJV)
  - `pii.ts` — Regex-based PII detection (SSN, CC, email, phone, IBAN, custom)
  - `keywords.ts` — `keywords_present`, `keywords_absent`
  - `judge.ts` — LLM-as-judge scoring (0.0–1.0)
  - `drift.ts` — Cosine similarity + field-level baseline comparison
  - `latency.ts`, `cost.ts`, `classification.ts` — Performance assertions
  - `registry.ts` — Assertion type → handler mapping

- **engine/** — Test execution orchestration
  - `runner.ts` — Core test runner: parse config, invoke providers, evaluate assertions
  - `aggregator.ts` — Multi-run stats (mean, p50, p95, std dev)
  - `gate.ts` — Pass/fail threshold evaluation per test + suite
  - `command.ts` — Shell command execution + output parsing
  - `trace.ts` — OpenTelemetry span capture and mapping

- **reporters/** — Output formatters (4 types)
  - `interface.ts` — `Reporter`, `ReporterOutput`
  - `pretty.ts` — Terminal colored output (chalk)
  - `json.ts` — JSON report for CI systems
  - `junit.ts` — JUnit XML for Jenkins/GitHub Actions
  - `compliance.ts` — EU AI Act Annex IV markdown report + SHA-256 hash

- **baseline/** — Saved test result comparison
  - `store.ts` — Read/write `.kindlm/baselines/*.json`
  - `compare.ts` — Baseline diff logic (semantic + field level)
  - `builder.ts` — Construct baseline from run results

- **trace/** — Observability and span mapping
  - `types.ts` — Span, trace, span mapping schemas
  - `parser.ts` — OpenTelemetry JSON trace parsing
  - `mapper.ts` — Map spans to test assertions

**Key Interfaces:**

```typescript
interface ProviderAdapter {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

interface Assertion {
  readonly type: string;
  evaluate(context: AssertionContext): Promise<AssertionResult[]>;
}

interface Reporter {
  readonly name: string;
  generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput>;
}
```

### Layer 2: CLI (`@kindlm/cli`)

Thin wrapper around core. Handles user I/O, file reading, terminal UI, and Cloud authentication.

**Modules:**

- **commands/** — 7 user-facing commands
  - `init.ts` — Scaffold kindlm.yaml template
  - `validate.ts` — Check config without running tests
  - `test.ts` — Run test suites (main command)
  - `baseline.ts` — Baseline management (set, compare, list)
  - `login.ts` — OAuth token paste for Cloud auth
  - `upload.ts` — Push last run to Cloud
  - `trace.ts` — Trace server for observability

- **utils/** — Support functions
  - `run-tests.ts` — Orchestrate test execution with reporters
  - `git.ts` — Extract commit SHA, branch, dirty state
  - `env.ts` — Detect CI environment (GitHub Actions, GitLab CI)
  - `file-reader.ts` — Async file I/O (injected into core)
  - `command-executor.ts` — Shell command execution (injected into core)
  - `spinner.ts` — Terminal progress indicator (ora)
  - `pdf-renderer.ts` — Compliance report PDF generation
  - `baseline-io.ts` — Read/write baseline JSON files
  - `last-run.ts` — Cache last test run (`.kindlm/last-run.json`)
  - `http.ts` — HTTP client for Cloud API

- **cloud/** — Cloud integration
  - `client.ts` — Authenticated HTTP client (Bearer token)
  - `auth.ts` — Token storage in `~/.kindlm/credentials`
  - `upload.ts` — Format + upload results to Cloud

**Entry Point:**
- `bin/kindlm.ts` — Commander CLI program setup

**Exit Codes:**
- `0` — All tests passed
- `1` — Any test failed or error occurred

### Layer 3: Cloud (`@kindlm/cloud`)

Cloudflare Workers serverless API + D1 SQLite database. Handles team collaboration, test history, and compliance reports.

**Modules:**

- **routes/** — 12 REST API endpoints (Hono framework)
  - `auth.ts` — POST/GET/DELETE `/v1/auth/tokens` (API token management)
  - `oauth.ts` — GitHub OAuth flow (sign-in, callback, logout)
  - `sso.ts` — SAML SSO for enterprises
  - `projects.ts` — CRUD `/v1/projects`
  - `suites.ts` — CRUD `/v1/projects/:id/suites`
  - `runs.ts` — GET `/v1/projects/:id/runs`, POST upload
  - `results.ts` — GET `/v1/runs/:id/results`
  - `baselines.ts` — CRUD `/v1/suites/:id/baselines`
  - `compare.ts` — GET `/v1/runs/:id/compare` (run-to-run diff)
  - `members.ts` — Team member CRUD
  - `billing.ts` — Stripe integration, plan management
  - `compliance.ts` — Generate/retrieve compliance reports
  - `webhooks.ts` — Slack/webhook notifications
  - `audit.ts` — Audit log query

- **middleware/** — Security & rate limiting
  - `auth.ts` — Bearer token validation + org scoping
  - `rate-limit.ts` — Per-org rate limiting (Cloudflare DurableObject)
  - `plan-gate.ts` — Feature gating by plan (free/team/enterprise)

- **db/** — D1 database layer
  - `queries.ts` — Type-safe prepared statement helpers
  - Schema: organizations, users, projects, test_runs, test_results, baselines, etc.

- **crypto/** — Data encryption
  - `envelope.ts` — AES-256-GCM encryption for compliance reports

- **webhooks/** — Outbound notifications
  - `dispatch.ts` — Send Slack/webhook notifications
  - `slack-format.ts` — Slack message formatting

**D1 Tables:**

```sql
organizations (plan: free|team|enterprise)
users (github_id, email, org_id, role: owner|admin|member)
projects (org_id, name)
test_runs (project_id, git_commit, pass_rate, compliance_hash)
test_results (run_id, suite_name, assertions_json, tool_calls_json)
baselines (suite_id, baseline_text, baseline_json)
api_tokens (user_id, token_hash, scopes, last_used)
audit_logs (user_id, action, resource_id, changes)
```

**Plan Feature Gates:**

| Feature | Free | Team ($49/mo) | Enterprise ($299/mo) |
|---------|------|---------------|---------------------|
| CLI (all) | ✓ | ✓ | ✓ |
| Dashboard | — | ✓ | ✓ |
| History | 7 days | 90 days | Unlimited |
| Team size | 1 | 10 | Unlimited |
| Projects | 1 | 5 | Unlimited |
| PDF export | — | ✓ | ✓ |
| Signed reports | — | — | ✓ |
| SSO/SAML | — | — | ✓ |
| Slack webhooks | — | ✓ | ✓ |

### Layer 4: Dashboard (`@kindlm/dashboard`)

Next.js SPA for test history, team collaboration, and compliance reports.

**Structure:**
- `app/` — Next.js App Router pages
- `components/` — React components
- Styling: Tailwind CSS
- Data fetching: SWR (Stale-While-Revalidate)
- Auth: GitHub OAuth → JWT stored in Cloud

**Pages:**
- `/` — Dashboard home (runs list)
- `/projects` — Project list + CRUD
- `/settings` — Team, billing, integration settings
- `/login` — OAuth flow
- `/compliance` — Compliance report viewer

### Layer 5: VS Code Extension (`@kindlm/vscode`)

Lightweight TypeScript extension for kindlm.yaml editing.

**Features:**
- JSON schema validation + IntelliSense
- Hover documentation
- Completions for provider/assertion types

**Structure:**
- `extension.ts` — Extension activation
- `completions.ts` — Completion provider
- `hover.ts` — Hover documentation
- `schemas/kindlm.schema.json` — JSON schema

## Data Flow: Config → Execution → Report

```
1. User writes kindlm.yaml
   ↓
2. CLI: kindlm test
   ↓
3. Parser validates YAML via Zod schema
   ↓
4. Runner iterates over test suites
   ↓
5. For each test:
   a. Provider adapter invokes LLM (OpenAI, Anthropic, etc.)
   b. ProviderResponse captures output + tool calls + latency + cost
   c. Assertion handlers evaluate response
   d. Results aggregated across N runs
   e. Gate evaluation (pass/fail threshold)
   ↓
6. Reporter formats output (pretty, JSON, JUnit, compliance)
   ↓
7. CLI: exit(0) if all pass, exit(1) if any fail
   ↓
8. Optional: kindlm upload → POST to Cloud API
   ↓
9. Cloud stores run in D1, notifies Slack/webhooks
   ↓
10. Dashboard displays test history + compliance reports
```

## Dependency Injection Pattern

Core receives all dependencies as arguments, never does I/O itself:

```typescript
const runner = createTestRunner({
  adapters: Map<string, ProviderAdapter>,      // Provider instances
  configDir: string,                           // For relative file paths
  fileReader: (path) => Promise<string>,       // I/O injected
  commandExecutor?: (cmd) => Promise<string>, // Optional, for sh assertions
  baselineData?: BaselineData,                 // Previous results
  onProgress?: (event) => void,                // Progress callback
});
```

CLI wires everything together:
1. Load system environment variables
2. Instantiate provider adapters (OpenAI, Anthropic, etc.)
3. Create file reader + command executor functions
4. Load baseline data if exists
5. Invoke runner
6. Select reporter (pretty, JSON, JUnit, compliance)
7. Write output to stdout/file
8. Optionally upload to Cloud

## Error Handling

Core uses Result<T, E> type instead of throw:

```typescript
type Result<T, E = KindlmError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

All public functions return Result. CLI unwraps and handles errors before exit.

## Testing Strategy

- **Unit tests:** `*.test.ts` files colocated with source
- **Integration tests:** Full config → runner → assertions pipeline
- **Resilience tests:** Provider timeout/retry scenarios
- **Fuzz tests:** Config parser with malformed input
- **Test framework:** Vitest with vi.mock() for provider mocking

## Build & Release

**Turbo tasks:**
- `npm run build` → compile all packages (TypeScript → ESM)
- `npm run test` → run all test suites
- `npm run lint` → ESLint 9 flat config
- `npm run typecheck` → tsc --noEmit

**Versioning:** Changesets (`npm run changeset`)

**Deployment:**
- CLI: npm publish to npmjs.com
- Cloud: `npm run build && npx wrangler deploy` to Cloudflare Workers
- Dashboard: `npm run build && npx wrangler pages deploy ./out`

## Key Design Decisions

1. **No throw statements in core** — Result types for error handling (testable, composable)
2. **Zod for all validation** — Config, API requests, database queries
3. **Adapter pattern for providers** — Easy to add new LLM providers (Grok, Claude, etc.)
4. **Assertion plugin system** — Registry maps type names to handlers; new assertions don't require core changes
5. **No classes** — Factories and plain functions (easier testing, composability)
6. **ESM-first** — `.js` extensions in all imports, `verbatimModuleSyntax: true`
7. **YAML config format** — User-friendly, standardized in CI/CD
8. **Compliance first** — EU AI Act Annex IV reports built-in, not bolted-on
9. **User-owned API keys** — Never proxied; only stored client-side in env vars
10. **Open-core business model** — MIT CLI forever free, Cloud adds team features

## Production Readiness Checklist

- ✓ Config validation (Zod schema, all edge cases tested)
- ✓ Provider adapters (OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama)
- ✓ All 11+ assertion types (tool calls, schema, PII, judge, drift, etc.)
- ✓ Reporters (pretty, JSON, JUnit, compliance + PDF)
- ✓ Baseline comparison + drift detection
- ✓ Resilience: timeouts, retries, rate-limit handling
- ✓ Cloud API: auth, runs, baselines, webhooks, billing
- ✓ Dashboard: test history, team collaboration, compliance viewer
- ✓ VS Code extension: YAML editing support
- ✓ CI/CD: GitHub Actions, GitLab CI detection
- ✓ Compliance reports: SHA-256 tamper evidence
- ✓ Security: Bearer tokens, rate limiting, plan gating
