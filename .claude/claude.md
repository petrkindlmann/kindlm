# KindLM — AI Agent Testing Framework

## What This Is

KindLM is an open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** (tool calls, decisions, structured output) — not just what they **say** (text quality). It also generates EU AI Act Annex IV compliance documentation.

**Business model:** Open-core. The CLI is MIT-licensed and free forever. Revenue comes from KindLM Cloud — a paid SaaS dashboard for team collaboration, test history, compliance report storage, and enterprise features.

## Architecture Overview

This is a TypeScript monorepo with three packages:

```
packages/
├── core/     → @kindlm/core  — All business logic. Zero I/O dependencies.
├── cli/      → @kindlm/cli   — CLI entry point. Thin wrapper around core.
└── cloud/    → @kindlm/cloud  — Cloudflare Workers API + D1 database.
```

### Dependency Rules (STRICT)
- `core` NEVER imports from `cli` or `cloud`
- `cli` depends on `core` for all logic
- `cloud` imports only **types** from `core` (Workers runtime ≠ Node.js)
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
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 3

suites:
  - name: "refund-agent"
    system_prompt_file: ./prompts/refund.md
    tests:
      - name: "happy-path-refund"
        input: "I want to return order #12345"
        assert:
          - type: tool_called
            value: lookup_order
            args:
              order_id: "12345"
          - type: tool_not_called
            value: process_refund
          - type: no_pii
          - type: judge
            criteria: "Response is empathetic and professional"
            threshold: 0.8
```

### Assertion Types (the core differentiator)
1. **tool_called** — Agent called a specific tool with expected args
2. **tool_not_called** — Agent did NOT call a forbidden tool
3. **tool_order** — Tools called in specific sequence
4. **schema** — Structured output matches JSON Schema (AJV)
5. **judge** — LLM-as-judge scores response against criteria (0.0–1.0)
6. **no_pii** — Regex-based PII detection (SSN, CC, email, phone, custom patterns)
7. **keywords_present** — Required phrases appear in output
8. **keywords_absent** — Forbidden phrases do not appear
9. **drift** — Semantic + field-level comparison against stored baseline
10. **latency** — Response time under threshold
11. **cost** — Token cost under budget

### Providers
Adapter pattern. Each provider implements `ProviderAdapter` interface:
- `openai` — OpenAI API (GPT-4o, GPT-4o-mini, etc.)
- `anthropic` — Anthropic API (Claude Sonnet 4.5, Claude Haiku 4.5, etc.)
- `ollama` — Local models via Ollama
- Config format: `provider: openai:gpt-4o` or `provider: anthropic:claude-sonnet-4-5-20250929`

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
│   ├── interpolation.ts   # Template variable expansion ({{env.VAR}})
│   └── index.ts
├── providers/
│   ├── interface.ts       # ProviderAdapter interface + ProviderResponse type
│   ├── openai.ts          # OpenAI implementation
│   ├── anthropic.ts       # Anthropic implementation
│   ├── ollama.ts          # Ollama local implementation
│   ├── registry.ts        # Provider factory from "openai:gpt-4o" string
│   └── index.ts
├── assertions/
│   ├── interface.ts       # AssertionHandler interface + AssertionResult type
│   ├── tool-calls.ts      # tool_called, tool_not_called, tool_order
│   ├── schema.ts          # JSON Schema validation via AJV
│   ├── pii.ts             # PII regex patterns (SSN, CC, email, phone, IBAN)
│   ├── keywords.ts        # keywords_present, keywords_absent
│   ├── judge.ts           # LLM-as-judge (uses provider to score)
│   ├── drift.ts           # Baseline comparison (cosine similarity + field diff)
│   ├── latency.ts         # Response time assertions
│   ├── cost.ts            # Token cost assertions
│   ├── registry.ts        # Assertion type → handler mapping
│   └── index.ts
├── engine/
│   ├── runner.ts          # Test execution engine (concurrency, retries, timeout)
│   ├── aggregator.ts      # Multi-run result aggregation (mean, p50, p95)
│   ├── gate.ts            # Pass/fail evaluation per test + suite
│   └── index.ts
├── reporters/
│   ├── interface.ts       # Reporter interface
│   ├── pretty.ts          # Terminal colored output (chalk)
│   ├── json.ts            # JSON report file
│   ├── junit.ts           # JUnit XML for CI systems
│   ├── compliance.ts      # EU AI Act Annex IV markdown report
│   └── index.ts
├── baseline/
│   ├── store.ts           # Read/write .kindlm/baselines/*.json
│   ├── compare.ts         # Baseline diff logic
│   └── index.ts
├── types/
│   ├── config.ts          # Inferred from Zod schema (z.infer<>)
│   ├── result.ts          # TestResult, SuiteResult, RunResult
│   ├── report.ts          # ComplianceReport, JUnitReport
│   ├── provider.ts        # ProviderRequest, ProviderResponse, ToolCall
│   └── index.ts
└── index.ts               # Public barrel export
```

**Key interfaces:**

```typescript
// Provider adapter — all providers implement this
interface ProviderAdapter {
  id: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

interface ProviderRequest {
  system_prompt: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
}

interface ProviderResponse {
  text: string;
  tool_calls: ToolCall[];
  usage: { prompt_tokens: number; completion_tokens: number };
  latency_ms: number;
  raw: unknown; // Original API response
}

// Assertion handler — all assertion types implement this
interface AssertionHandler {
  type: string;
  evaluate(response: ProviderResponse, config: AssertionConfig): Promise<AssertionResult>;
}

interface AssertionResult {
  pass: boolean;
  score?: number;        // 0.0-1.0 for scored assertions (judge, drift)
  message: string;       // Human-readable explanation
  details?: unknown;     // Type-specific details (e.g., PII matches found)
}
```

### @kindlm/cli (`packages/cli/`)
```
src/
├── commands/
│   ├── init.ts            # `kindlm init` — scaffold kindlm.yaml
│   ├── validate.ts        # `kindlm validate` — check config without running
│   ├── test.ts            # `kindlm test` — run test suites
│   ├── baseline.ts        # `kindlm baseline set|compare|list`
│   ├── login.ts           # `kindlm login` — token paste auth for Cloud
│   └── upload.ts          # `kindlm upload` — push last run to Cloud
├── utils/
│   ├── git.ts             # Extract commit SHA, branch, dirty state
│   ├── last-run.ts        # Cache last test run for upload (.kindlm/last-run.json)
│   ├── env.ts             # Detect CI environment (GitHub Actions, GitLab CI)
│   └── spinner.ts         # Terminal progress indicator (ora)
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
| `kindlm validate` | Validate config, list suites | 0/1 |
| `kindlm test` | Run all suites | 0 (pass) / 1 (fail) |
| `kindlm test -s <suite>` | Run specific suite | 0/1 |
| `kindlm test --compliance` | Run + generate compliance report | 0/1 |
| `kindlm test --reporter json` | Output JSON instead of pretty | 0/1 |
| `kindlm test --reporter junit` | Output JUnit XML for CI | 0/1 |
| `kindlm test --runs 5` | Override run count | 0/1 |
| `kindlm test --gate 90` | Fail if pass rate < 90% | 0/1 |
| `kindlm baseline set` | Save current results as baseline | 0 |
| `kindlm baseline compare` | Compare latest against baseline | 0/1 |
| `kindlm login` | Authenticate with KindLM Cloud (token paste) | 0 |
| `kindlm login --status` | Show current auth state | 0 |
| `kindlm login --logout` | Remove stored credentials | 0 |
| `kindlm upload` | Push last run to Cloud | 0/1 |
| `kindlm upload -p <name>` | Upload with explicit project name | 0/1 |

### @kindlm/cloud (`packages/cloud/`)
```
src/
├── routes/
│   ├── auth.ts            # POST/GET/DELETE /v1/auth/tokens — API token management
│   ├── projects.ts        # CRUD /v1/projects
│   ├── suites.ts          # CRUD /v1/projects/:id/suites
│   ├── runs.ts            # GET /v1/projects/:id/runs, POST upload
│   ├── results.ts         # GET /v1/runs/:id/results
│   ├── baselines.ts       # CRUD /v1/suites/:id/baselines
│   └── compare.ts         # GET /v1/runs/:id/compare
├── middleware/
│   ├── auth.ts            # Bearer token validation + org scoping
│   ├── rate-limit.ts      # Per-org rate limiting
│   └── plan-gate.ts       # Feature gating by plan (free/team/enterprise)
├── db/
│   ├── schema.sql         # D1 table definitions
│   ├── migrations/        # Ordered migration files
│   └── queries.ts         # Type-safe prepared statement helpers
├── types.ts
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

## Current Priorities (Phase 1 — MVP)

Ship in this order:
1. Config parser + validator (Zod schema, YAML loading)
2. OpenAI + Anthropic provider adapters
3. Core assertion engine (tool_called, schema, judge, no_pii)
4. Pretty terminal reporter
5. `kindlm init` + `kindlm test` commands
6. JUnit reporter for CI
7. Compliance report generator
8. Baseline compare
9. Cloud API + dashboard (Phase 2)
10. Team features + billing (Phase 3)
