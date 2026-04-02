# KindLM — AI Agent Testing Framework

## What This Is

KindLM is an open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** (tool calls, decisions, structured output) — not just what they **say** (text quality). It also generates EU AI Act Annex IV compliance documentation.

**Business model:** Open-core. The CLI is MIT-licensed and free forever. Revenue comes from KindLM Cloud — a paid SaaS dashboard for team collaboration, test history, compliance report storage, and enterprise features.

## Architecture Overview

This is a TypeScript monorepo with five packages:

```
packages/
├── core/       → @kindlm/core       — All business logic. Zero I/O dependencies.
├── cli/        → @kindlm/cli        — CLI entry point. Thin wrapper around core.
├── cloud/      → @kindlm/cloud      — Cloudflare Workers API + D1 database.
├── dashboard/  → Next.js app        — Cloud dashboard UI (Tailwind + shadcn/ui).
└── vscode/     → VS Code extension  — YAML intellisense for kindlm.yaml.
```

### Dependency Rules (STRICT)
- `core` NEVER imports from `cli`, `cloud`, `dashboard`, or `vscode`
- `cli` depends on `core` for all logic
- `cloud` imports only **types** from `core` (Workers runtime ≠ Node.js)
- `dashboard` is standalone Next.js — calls Cloud API over HTTP
- `vscode` is standalone — reads `core`'s Zod schema for intellisense
- All provider API calls go through injected interfaces in `core`

### Tech Stack
- **Runtime:** Node.js 20+ (CLI/core), Cloudflare Workers (cloud)
- **Language:** TypeScript 5.4+, strict mode, ESM-first
- **Build:** Turborepo orchestration, tsup for bundling
- **Test:** Vitest for unit/integration tests
- **Lint:** ESLint 9 flat config + Prettier
- **Versioning:** Changesets
- **Cloud infra:** Cloudflare Workers + D1 (SQLite) + Hono router
- **Auth:** GitHub OAuth → JWT tokens stored in D1

## Core Concepts

### Config File (kindlm.yaml)
Users define test suites in YAML. This is the primary interface:

```yaml
kindlm: 1
project: my-project

suite:
  name: my-agent-tests
  description: Behavioral tests for my AI agent

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
      maxTokens: 1024

prompts:
  greeting:
    system: You are a helpful assistant.
    user: "{{message}}"

tests:
  - name: basic-greeting
    prompt: greeting
    vars:
      message: Hello, how are you?
    expect:
      output:
        contains:
          - hello
      guardrails:
        pii:
          enabled: true

gates:
  passRateMin: 0.95

defaults:
  repeat: 1
  concurrency: 4
  timeoutMs: 60000
```

**Top-level fields:** `kindlm` (version, must be `1`), `project`, `suite` (single object with `name` + `description`), `providers`, `models`, `prompts`, `tests`, `gates`, `compliance` (optional), `trace` (optional), `upload` (optional), `defaults`.

### Expect Sub-Schemas (the core differentiator)
Assertions are defined under `expect:` in each test case:

1. **`expect.toolCalls[]`** — Tool call assertions: `tool` (name), `argsMatch` (partial arg match), `shouldNotCall` (boolean), `order` (0-indexed position), `argsSchema` (path to JSON Schema)
2. **`expect.output.format`** — `"text"` or `"json"`. When `"json"`, requires `schemaFile` (JSON Schema validation via AJV)
3. **`expect.output.contains`** / **`notContains`** — Required/forbidden substrings in output
4. **`expect.output.maxLength`** — Maximum character length
5. **`expect.judge[]`** — LLM-as-judge: `criteria` (natural language), `minScore` (0-1, default 0.7), optional `model` override, optional `rubric`
6. **`expect.guardrails.pii`** — PII detection: `enabled`, `denyPatterns` (regex array, defaults include SSN/CC/email), `customPatterns`
7. **`expect.guardrails.keywords`** — `deny` (forbidden words) / `allow` (required words)
8. **`expect.baseline.drift`** — Baseline comparison: `maxScore` (0-1), `method` (`"judge"` | `"embedding"` | `"field-diff"`), `fields`
9. **`expect.latency.maxMs`** — Response time threshold
10. **`expect.cost.maxUsd`** — Token cost budget

### Providers
Adapter pattern. Each provider implements `ProviderAdapter` interface. Six providers supported:
- `openai` — OpenAI API (GPT-4o, GPT-4o-mini, etc.)
- `anthropic` — Anthropic API (Claude Sonnet 4.5, Claude Haiku 4.5, etc.)
- `ollama` — Local models via Ollama
- `gemini` — Google Gemini API
- `mistral` — Mistral API
- `cohere` — Cohere API

Config format uses separate `providers:` and `models:` sections:
```yaml
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params: { temperature: 0, maxTokens: 1024 }
```

### Compliance Reports
`kindlm test --compliance` generates EU AI Act Annex IV documentation:
- Maps test results to specific regulatory articles
- SHA-256 hash for tamper evidence
- Markdown output locally (free), PDF + stored history in Cloud (paid)

## Package Details

### @kindlm/core (`packages/core/`)
```
src/
├── config/
│   ├── schema.ts          # Zod schema for kindlm.yaml validation
│   ├── parser.ts          # YAML parse → validate → resolve file refs
│   ├── interpolation.ts   # Template variable expansion ({{variable}})
│   └── index.ts
├── providers/
│   ├── interface.ts       # Re-exports from types/provider.ts
│   ├── openai.ts          # OpenAI implementation
│   ├── anthropic.ts       # Anthropic implementation
│   ├── ollama.ts          # Ollama local implementation
│   ├── gemini.ts          # Google Gemini implementation
│   ├── mistral.ts         # Mistral implementation
│   ├── cohere.ts          # Cohere implementation
│   ├── conversation.ts    # Multi-turn conversation runner (tool-call loops)
│   ├── pricing.ts         # Per-model cost estimation tables
│   ├── retry.ts           # Retry logic with exponential backoff
│   ├── registry.ts        # Provider factory by name string
│   └── index.ts
├── assertions/
│   ├── interface.ts       # Assertion interface + AssertionResult + AssertionContext
│   ├── tool-calls.ts      # toolCalls assertions (called, not called, args, order)
│   ├── schema.ts          # JSON Schema validation via AJV
│   ├── pii.ts             # PII regex patterns (SSN, CC, email, phone)
│   ├── keywords.ts        # keywords deny/allow + output contains/notContains
│   ├── judge.ts           # LLM-as-judge (uses provider to score)
│   ├── drift.ts           # Baseline comparison (judge, embedding, field-diff)
│   ├── classification.ts  # Output classification assertions
│   ├── shared-score.ts    # Shared scoring utilities
│   ├── latency.ts         # Response time assertions
│   ├── cost.ts            # Token cost assertions
│   ├── registry.ts        # Expect → Assertion[] factory (createAssertionsFromExpect)
│   └── index.ts
├── engine/
│   ├── runner.ts          # Test execution engine (concurrency, retries, timeout)
│   ├── aggregator.ts      # Multi-run result aggregation (mean, p50, p95)
│   ├── command.ts         # Shell command test execution + output parsing
│   ├── gate.ts            # Pass/fail evaluation per test + suite
│   └── index.ts
├── reporters/
│   ├── interface.ts       # Reporter interface + Colorize
│   ├── pretty.ts          # Terminal colored output (chalk)
│   ├── json.ts            # JSON report file
│   ├── junit.ts           # JUnit XML for CI systems
│   ├── compliance.ts      # EU AI Act Annex IV markdown report
│   └── index.ts
├── baseline/
│   ├── store.ts           # Read/write .kindlm/baselines/*.json
│   ├── builder.ts         # Build baseline data from aggregated results
│   ├── compare.ts         # Baseline diff logic
│   └── index.ts
├── trace/
│   ├── types.ts           # TraceConfig Zod schema + OTLP wire types
│   ├── parser.ts          # OTLP JSON → ParsedSpan normalization
│   ├── mapper.ts          # Span → ProviderResponse mapping
│   └── index.ts
├── types/
│   ├── config.ts          # Re-exports inferred types from config/schema.ts
│   ├── result.ts          # Result<T,E>, KindlmError, ErrorCode, ok(), err()
│   ├── provider.ts        # ProviderAdapter, ProviderRequest, ProviderResponse, ToolCall
│   └── index.ts
└── index.ts               # Public barrel export
```

**Key interfaces:**

```typescript
// Provider adapter — all providers implement this
interface ProviderAdapter {
  readonly name: string;
  initialize(config: ProviderAdapterConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  estimateCost(model: string, usage: ProviderResponse["usage"]): number | null;
  supportsTools(model: string): boolean;
  embed?(text: string, model?: string): Promise<number[]>;
}

interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  params: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    stopSequences?: string[];
    seed?: number;
  };
  tools?: ProviderToolDefinition[];
  toolChoice?: "auto" | "required" | "none";
}

interface ProviderResponse {
  text: string;
  toolCalls: ProviderToolCall[];
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  latencyMs: number;
  modelId: string;
  finishReason: "stop" | "max_tokens" | "tool_calls" | "error" | "unknown";
  raw: unknown;
}

// Assertion — all assertion types implement this
interface Assertion {
  readonly type: string;
  evaluate(context: AssertionContext): Promise<AssertionResult[]>;
}

interface AssertionResult {
  assertionType: string;
  label: string;
  passed: boolean;
  score: number;          // 0.0-1.0
  failureCode?: FailureCode;
  failureMessage?: string;
  metadata?: Record<string, unknown>;
}
```

### @kindlm/cli (`packages/cli/`)
```
src/
├── bin/
│   └── kindlm.ts          # CLI entry point (shebang)
├── commands/
│   ├── init.ts            # `kindlm init` — scaffold kindlm.yaml
│   ├── validate.ts        # `kindlm validate` — check config without running
│   ├── test.ts            # `kindlm test` — run test suites
│   ├── trace.ts           # `kindlm trace` — ingest OTLP traces + assert
│   ├── baseline.ts        # `kindlm baseline set|compare|list`
│   ├── login.ts           # `kindlm login` — token paste auth for Cloud
│   └── upload.ts          # `kindlm upload` — push last run to Cloud
├── utils/
│   ├── git.ts             # Extract commit SHA, branch, dirty state
│   ├── last-run.ts        # Cache last test run for upload (.kindlm/last-run.json)
│   ├── env.ts             # Detect CI environment (GitHub Actions, GitLab CI)
│   ├── spinner.ts         # Terminal progress indicator (ora)
│   ├── http.ts            # Node.js fetch-based HttpClient
│   ├── file-reader.ts     # Node.js fs-based FileReader for core
│   ├── baseline-io.ts     # File-based baseline I/O adapter
│   ├── command-executor.ts # Shell command execution for command tests
│   ├── run-tests.ts       # Shared test runner orchestration
│   ├── select-reporter.ts # Reporter factory from CLI --reporter flag
│   ├── pdf-renderer.ts    # Compliance report PDF export
│   └── trace-server.ts    # Embedded OTLP HTTP server for trace command
├── cloud/
│   ├── client.ts          # HTTP client for Cloud API
│   ├── auth.ts            # Token storage in ~/.kindlm/credentials
│   └── upload.ts          # Format + upload results
└── index.ts               # Commander program setup
```

**CLI Commands:**

| Command | Description | Exit Code |
|---------|-------------|-----------|
| `kindlm init` | Create kindlm.yaml template | 0 |
| `kindlm init --force` | Overwrite existing kindlm.yaml | 0 |
| `kindlm validate` | Validate config, list suites | 0/1 |
| `kindlm test` | Run all tests | 0 (pass) / 1 (fail) |
| `kindlm test -s <suite>` | Run specific suite | 0/1 |
| `kindlm test --compliance` | Run + generate compliance report | 0/1 |
| `kindlm test --pdf <path>` | Export compliance as PDF (requires --compliance) | 0/1 |
| `kindlm test --reporter json` | Output JSON instead of pretty | 0/1 |
| `kindlm test --reporter junit` | Output JUnit XML for CI | 0/1 |
| `kindlm test --runs <count>` | Override repeat count | 0/1 |
| `kindlm test --gate <percent>` | Fail if pass rate below threshold | 0/1 |
| `kindlm trace` | Ingest OTLP traces + run assertions | 0/1 |
| `kindlm trace --port <port>` | OTLP HTTP port (default: 4318) | 0/1 |
| `kindlm trace --command <cmd>` | Spawn command and collect its traces | 0/1 |
| `kindlm trace --timeout <ms>` | Trace collection timeout (default: 30000) | 0/1 |
| `kindlm baseline set` | Save current results as baseline | 0 |
| `kindlm baseline set --force` | Save baseline even if all tests failed | 0 |
| `kindlm baseline compare` | Compare latest against baseline | 0/1 |
| `kindlm baseline list` | List saved baselines | 0 |
| `kindlm login` | Authenticate with KindLM Cloud (token paste) | 0 |
| `kindlm login -t <token>` | Authenticate with token (non-interactive) | 0 |
| `kindlm login --status` | Show current auth state | 0 |
| `kindlm login --logout` | Remove stored credentials | 0 |
| `kindlm upload` | Push last run to Cloud | 0/1 |
| `kindlm upload -p <name>` | Upload with explicit project name | 0/1 |

### @kindlm/cloud (`packages/cloud/`)
```
src/
├── routes/
│   ├── auth.ts            # POST/GET/DELETE /v1/auth/tokens — API token management
│   ├── oauth.ts           # GitHub OAuth flow
│   ├── sso.ts             # SAML SSO login callback
│   ├── projects.ts        # CRUD /v1/projects
│   ├── suites.ts          # CRUD /v1/projects/:id/suites
│   ├── runs.ts            # GET /v1/projects/:id/runs, POST upload
│   ├── results.ts         # GET /v1/runs/:id/results
│   ├── baselines.ts       # CRUD /v1/suites/:id/baselines
│   ├── compare.ts         # GET /v1/runs/:id/compare
│   ├── compliance.ts      # Compliance report endpoints
│   ├── members.ts         # Organization member management
│   ├── billing.ts         # Stripe billing integration
│   ├── audit.ts           # Audit log API (enterprise)
│   ├── audit-helper.ts    # Audit log helpers
│   └── webhooks.ts        # Webhook management endpoints
├── middleware/
│   ├── auth.ts            # Bearer token validation + org scoping
│   ├── rate-limit.ts      # Per-org rate limiting
│   └── plan-gate.ts       # Feature gating by plan (free/team/enterprise)
├── crypto/
│   └── envelope.ts        # Encryption envelope for compliance reports
├── webhooks/
│   ├── dispatch.ts        # Webhook event dispatch
│   └── slack-format.ts    # Slack-formatted webhook payloads
├── db/
│   └── queries.ts         # Type-safe prepared statement helpers
├── types.ts
├── validation.ts          # Zod schemas for API request validation
└── index.ts               # Hono router + Worker entry
```

**D1 Schema (key tables):**

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free | team | enterprise
  github_org TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  email TEXT,
  org_id TEXT REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  git_commit TEXT,
  git_branch TEXT,
  ci_provider TEXT,          -- github_actions | gitlab_ci | local
  total_tests INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  pass_rate REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  compliance_report TEXT,    -- NULL or markdown content
  compliance_hash TEXT,      -- SHA-256 of report
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE test_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES test_runs(id),
  suite_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  pass BOOLEAN NOT NULL,
  assertions_json TEXT NOT NULL,  -- JSON array of assertion results
  response_text TEXT,
  tool_calls_json TEXT,           -- JSON array of tool calls
  latency_ms INTEGER,
  cost_usd REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Plan Feature Gates:**

| Feature | Free | Team ($49/mo) | Enterprise ($299/mo) |
|---------|------|---------------|---------------------|
| CLI (all features) | ✓ | ✓ | ✓ |
| Cloud dashboard | — | ✓ | ✓ |
| Test history | 7 days | 90 days | Unlimited |
| Team members | 1 | 10 | Unlimited |
| Projects | 1 | 5 | Unlimited |
| Compliance PDF export | — | ✓ | ✓ |
| Signed compliance reports | — | — | ✓ |
| SSO/SAML | — | — | ✓ |
| Audit log API | — | — | ✓ |
| Slack/webhook notifications | — | ✓ | ✓ |
| SLA | — | — | 99.9% |
| Support | GitHub Issues | Email | Dedicated |

### @kindlm/dashboard (`packages/dashboard/`)
Next.js app for KindLM Cloud. Uses App Router, Tailwind CSS, and shadcn/ui components.
```
app/           # Next.js App Router pages
components/    # React components (shadcn/ui based)
lib/           # API client, auth helpers, utilities
```

### VS Code Extension (`packages/vscode/`)
Provides YAML intellisense (completions + hover docs) for `kindlm.yaml` files.
```
src/
├── extension.ts    # Extension activation entry point
├── completions.ts  # Completion provider for kindlm.yaml fields
└── hover.ts        # Hover documentation provider
```

## Development Workflow

### Getting Started
```bash
git clone https://github.com/kindlm/kindlm.git
cd kindlm
npm install          # Installs all workspace dependencies
npm run build        # Builds core → cli → cloud
npm run test         # Runs all Vitest suites
npm run dev:cli      # Watch mode for CLI development
npm run dev:cloud    # Wrangler dev server for Cloud
```

### Building a Feature
1. Write types in `core/src/types/`
2. Implement logic in `core/src/` (with unit tests)
3. Wire up CLI command in `cli/src/commands/`
4. Add API route in `cloud/src/routes/` if needed
5. Run `npm run typecheck && npm run test && npm run lint`

### Testing
- Unit tests: `packages/*/src/**/*.test.ts`
- Integration tests: `packages/cli/tests/integration/`
- Use `vitest` with `vi.mock()` for provider mocking
- CI: GitHub Actions runs lint + typecheck + test on every PR

### Environment Variables
```bash
# Provider API keys (user's own keys)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Cloud development
CLOUDFLARE_API_TOKEN=...
KINDLM_CLOUD_URL=http://localhost:8787   # Local dev
KINDLM_API_TOKEN=...                      # For upload command

# CI environment (auto-detected)
GITHUB_SHA=...
GITHUB_REF=...
CI=true
```

## Code Style & Conventions

- **No classes.** Use plain functions and factory patterns.
- **Zod for validation.** All external input (YAML config, API requests) validated with Zod.
- **Result types over exceptions.** Functions return `{ success: true, data } | { success: false, error }` — not throw.
- **No `any`.** Use `unknown` + type narrowing.
- **Descriptive names.** `evaluateToolCallAssertion()` not `checkTC()`.
- **One file per concern.** Don't put multiple assertion types in one file.
- **Barrel exports.** Each directory has `index.ts` that re-exports public API.
- **Pure functions in core.** Side effects (file I/O, HTTP, console) only in CLI and Cloud.
- **Comments:** Only for "why", never for "what".

## Important Constraints

- **Core must have zero I/O.** No `fs`, no `fetch`, no `console.log`. All I/O is injected.
- **Cloud must be Workers-compatible.** No Node.js built-ins (path, fs, crypto → use Web APIs).
- **YAML is the config format.** Not JSON, not TOML. Users write YAML.
- **Exit code 0 = all tests pass, 1 = any test fails.** This is critical for CI integration.
- **Provider API keys are the user's.** KindLM never stores or proxies API keys.
- **No telemetry without opt-in.** Respect privacy. Optional anonymous usage stats only.
- **MIT license.** Core and CLI are MIT. Cloud source is available but AGPL (open-core boundary).

## File Organization for New Features

When adding a new assertion type (e.g., `regex_match`):
1. `core/src/assertions/regex.ts` — Implementation
2. `core/src/assertions/regex.test.ts` — Unit tests
3. Update `core/src/assertions/registry.ts` — Register new type
4. Update `core/src/config/schema.ts` — Add to Zod union
5. Update `docs/assertions.md` — Document usage
6. Update `templates/kindlm.yaml` — Add example if useful

## Current State

**v2.1.0 shipped 2026-04-02.** Everything in the MVP list is complete and live.

- CLI on npm, Cloud at api.kindlm.com, VS Code extension published, Stripe in test mode
- Active tech debt: `runArtifacts` flag is a no-op; 48 integration test failures; Stripe live-mode needs `sk_live_` key

**For authoritative current state, always read `.planning/PROJECT.md`** — it is updated after every phase and milestone. Do not rely on this file or memory entries for project status; they can be stale.
