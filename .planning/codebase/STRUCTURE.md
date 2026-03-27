# KindLM Directory Structure & File Organization

## Root Layout

```
/Users/petr/projects/kindlm/
├── package.json                    # Workspace root (npm workspaces)
├── turbo.json                      # Turbo v2.8+ config
├── tsconfig.json                   # Root TypeScript config
├── eslint.config.js                # ESLint 9 flat config
├── prettier.config.js              # Code formatting
├── vitest.config.ts                # Vitest setup
├── .github/workflows/              # CI/CD (GitHub Actions)
├── .planning/
│   └── codebase/                   # Architecture docs (this directory)
├── .kindlm/                        # Local test cache
│   ├── baselines/                  # Saved baseline JSON files
│   └── last-run.json               # Most recent test run
├── docs/                           # User documentation
│   ├── api.md                      # Cloud API reference
│   ├── assertions.md               # Assertion types + examples
│   ├── compliance.md               # EU AI Act Annex IV guide
│   └── providers.md                # Provider setup guides
├── examples/                       # Example kindlm.yaml configs
├── templates/                      # Scaffold templates
│   └── kindlm.yaml                 # Default init template
├── site/                           # Marketing website (Next.js)
└── packages/                       # Monorepo packages (below)
```

## Package Structure

### Core Package (`packages/core/`)

Pure business logic, zero I/O, all exportable from `src/index.ts`.

```
packages/core/
├── package.json                    # @kindlm/core, 0 I/O dependencies
├── tsconfig.json                   # extends root, references: none
├── vitest.config.ts                # passWithNoTests: true
├── src/
│   ├── index.ts                    # Barrel export: types, assertions, providers, engine, reporters
│   │
│   ├── types/
│   │   ├── index.ts                # Barrel: export * from each below
│   │   ├── config.ts               # KindLMConfig, TestCase, Expect, ModelConfig (inferred from Zod)
│   │   ├── provider.ts             # ProviderAdapter, ProviderRequest, ProviderResponse, ProviderToolCall
│   │   └── result.ts               # Result<T, E>, ok(), err() (error handling)
│   │
│   ├── config/
│   │   ├── index.ts                # Barrel: parseConfig, interpolate, schema
│   │   ├── schema.ts               # Zod schema: KindlmConfigSchema + nested validators
│   │   ├── schema.test.ts          # Unit tests for schema validation
│   │   ├── parser.ts               # parseConfig(yaml): Result<KindLMConfig, KindlmError>
│   │   ├── parser.test.ts          # Integration tests (file loading, refs, env)
│   │   ├── parser.fuzz.test.ts     # Fuzz testing with malformed YAML
│   │   ├── interpolation.ts        # interpolate(text, vars): string ({{env.VAR}})
│   │   └── interpolation.test.ts   # Var expansion tests
│   │
│   ├── providers/
│   │   ├── index.ts                # Barrel: registry, ProviderError, ProviderAdapter
│   │   ├── interface.ts            # ProviderAdapter, ProviderRequest, ProviderResponse, ProviderToolCall
│   │   ├── registry.ts             # createAdapter("openai:gpt-4o"): ProviderAdapter
│   │   ├── registry.test.ts        # Registry lookup tests
│   │   ├── openai.ts               # OpenAI API adapter
│   │   ├── openai.test.ts          # OpenAI specific tests
│   │   ├── openai.resilience.test.ts # Timeout, retry scenarios
│   │   ├── anthropic.ts            # Anthropic API adapter
│   │   ├── gemini.ts               # Google Gemini adapter
│   │   ├── mistral.ts              # Mistral API adapter
│   │   ├── cohere.ts               # Cohere API adapter
│   │   ├── ollama.ts               # Local Ollama adapter
│   │   ├── ollama.resilience.test.ts
│   │   ├── gemini.resilience.test.ts
│   │   ├── conversation.ts         # Multi-turn conversation runner
│   │   ├── pricing.ts              # Token cost calculator ($/1k tokens per provider)
│   │   ├── retry.ts                # Exponential backoff wrapper
│   │   └── retry.test.ts
│   │
│   ├── assertions/
│   │   ├── index.ts                # Barrel: all assertion types + factories
│   │   ├── interface.ts            # Assertion, AssertionResult, AssertionContext, FailureCode enum
│   │   ├── registry.ts             # createAssertionsFromExpect(): Assertion[]
│   │   ├── registry.test.ts        # Unit tests for assertion creation
│   │   │
│   │   ├── tool-calls.ts           # tool_called, tool_not_called, tool_order
│   │   ├── tool-calls.test.ts
│   │   ├── schema.ts               # JSON Schema validation (AJV)
│   │   ├── schema.test.ts
│   │   ├── pii.ts                  # no_pii (regex for SSN, CC, email, phone, IBAN)
│   │   ├── pii.test.ts
│   │   ├── pii.fuzz.test.ts        # Fuzz PII patterns
│   │   ├── keywords.ts             # keywords_present, keywords_absent
│   │   ├── keywords.test.ts
│   │   ├── judge.ts                # judge (LLM-as-judge scoring)
│   │   ├── judge.test.ts
│   │   ├── drift.ts                # drift (baseline comparison: cosine + field-level)
│   │   ├── drift.test.ts
│   │   ├── latency.ts              # latency (response time < threshold)
│   │   ├── latency.test.ts
│   │   ├── cost.ts                 # cost (token cost < budget)
│   │   ├── cost.test.ts
│   │   ├── classification.ts       # classification (category check)
│   │   ├── classification.test.ts
│   │   └── shared-score.ts         # Score normalization utility
│   │
│   ├── engine/
│   │   ├── index.ts                # Barrel: runner, aggregator, gate
│   │   ├── runner.ts               # createTestRunner(): Promise<RunResult>
│   │   │                           # Main orchestrator: parse config → invoke providers → evaluate assertions
│   │   ├── runner.test.ts          # Integration tests
│   │   ├── aggregator.ts           # aggregateRuns(): mean, p50, p95, std dev
│   │   ├── aggregator.test.ts
│   │   ├── gate.ts                 # evaluateGate(): boolean (pass rate threshold)
│   │   ├── gate.test.ts
│   │   ├── command.ts              # parseCommandOutput() for shell assertions
│   │   ├── command.test.ts
│   │   └── trace.ts                # OpenTelemetry span capture + mapping
│   │
│   ├── reporters/
│   │   ├── index.ts                # Barrel: pretty, json, junit, compliance factories
│   │   ├── interface.ts            # Reporter, ReporterOutput, Colorize
│   │   ├── pretty.ts               # Terminal output (chalk colors)
│   │   ├── pretty.test.ts
│   │   ├── json.ts                 # JSON report format
│   │   ├── json.test.ts
│   │   ├── junit.ts                # JUnit XML format (Jenkins, GitHub Actions)
│   │   ├── junit.test.ts
│   │   ├── compliance.ts           # EU AI Act Annex IV markdown + SHA-256 hash
│   │   └── compliance.test.ts
│   │
│   ├── baseline/
│   │   ├── index.ts                # Barrel: store, compare, builder
│   │   ├── store.ts                # readBaseline(), writeBaseline() (JSON files)
│   │   ├── store.test.ts
│   │   ├── compare.ts              # compareBaseline(): field-level + semantic diff
│   │   ├── compare.test.ts
│   │   ├── builder.ts              # buildBaseline(): create from RunResult
│   │   └── builder.test.ts
│   │
│   └── trace/
│       ├── index.ts                # Barrel: parser, mapper
│       ├── types.ts                # Span, Trace, SpanMapping schemas (Zod)
│       ├── parser.ts               # OpenTelemetry JSON trace parsing
│       ├── parser.test.ts
│       ├── mapper.ts               # Map spans to assertions
│       └── mapper.test.ts
│
├── dist/                           # Compiled ESM output (tsup)
└── README.md                       # Package documentation
```

**Key Export Pattern:**
Every subdirectory (`types/`, `config/`, etc.) has `index.ts` that re-exports public API. The root `src/index.ts` barrels everything:

```typescript
export * from "./types/index.js";
export * from "./config/index.js";
export * from "./providers/index.js";
export * from "./assertions/index.js";
export * from "./engine/index.js";
export * from "./reporters/index.js";
export * from "./baseline/index.js";
export * from "./trace/index.js";
```

---

### CLI Package (`packages/cli/`)

Terminal interface + user I/O. Depends on `@kindlm/core`.

```
packages/cli/
├── package.json                    # @kindlm/cli, depends: @kindlm/core, commander, chalk, ora, pdfkit
├── tsconfig.json                   # references: ../core (workspace linking)
├── vitest.config.ts
├── src/
│   ├── index.ts                    # createProgram(): Commander program
│   │
│   ├── bin/
│   │   └── kindlm.ts               # #!/usr/bin/env node entry point
│   │
│   ├── commands/
│   │   ├── init.ts                 # kind/lm init (scaffold kindlm.yaml)
│   │   ├── init.test.ts
│   │   ├── validate.ts             # kindlm validate (check config, list suites)
│   │   ├── validate.test.ts
│   │   ├── test.ts                 # kindlm test (run suites, select reporter)
│   │   ├── test.test.ts
│   │   ├── baseline.ts             # kindlm baseline set|compare|list
│   │   ├── baseline.test.ts
│   │   ├── login.ts                # kindlm login (OAuth token paste)
│   │   ├── login.test.ts
│   │   ├── upload.ts               # kindlm upload (push to Cloud)
│   │   ├── upload.test.ts
│   │   ├── trace.ts                # kindlm trace (observability server)
│   │   └── trace.test.ts
│   │
│   ├── utils/
│   │   ├── run-tests.ts            # orchestrate test execution
│   │   ├── spinner.ts              # ora progress indicator
│   │   ├── env.ts                  # detectCiEnvironment()
│   │   ├── env.test.ts
│   │   ├── git.ts                  # extractGitInfo(): commit, branch, dirty
│   │   ├── git.test.ts
│   │   ├── file-reader.ts          # readFile() function (injected into core)
│   │   ├── command-executor.ts     # executeCommand() function (injected into core)
│   │   ├── command-executor.test.ts
│   │   ├── last-run.ts             # getLastRun(), saveLastRun() (.kindlm/last-run.json)
│   │   ├── last-run.test.ts
│   │   ├── baseline-io.ts          # readBaselines(), writeBaselines()
│   │   ├── baseline-io.test.ts
│   │   ├── select-reporter.ts      # Choose reporter based on CLI flags
│   │   ├── http.ts                 # HTTP client for Cloud API calls
│   │   ├── http.test.ts
│   │   ├── pdf-renderer.ts         # Render compliance report to PDF
│   │   ├── pdf-renderer.test.ts
│   │   └── trace-server.ts         # OTEL collector server
│   │
│   └── cloud/
│       ├── client.ts               # CloudApiClient (Bearer auth)
│       ├── client.test.ts
│       ├── auth.ts                 # saveToken(), getToken(), isLoggedIn()
│       ├── auth.test.ts
│       ├── upload.ts               # formatAndUpload(): POST /v1/runs
│       └── upload.test.ts
│
├── dist/                           # Compiled ESM
├── bin/kindlm                      # Symlink: ./dist/bin/kindlm.js (npm postinstall)
└── README.md
```

**Command Files:**
Each command file exports a single Command instance:

```typescript
// commands/test.ts
export const testCommand = createCommand(...)
  .action(async (options) => {
    // Wire together: fileReader → runner → reporter → output
    // Exit with process.exit(passed ? 0 : 1)
  });
```

**Patterns:**
- All I/O (file read, HTTP, spinner) lives here
- Core logic always in `core/` and injected as dependencies
- Tests mock I/O functions; verify correct calls to core

---

### Cloud Package (`packages/cloud/`)

Cloudflare Workers API + D1 database. No Node.js built-ins.

```
packages/cloud/
├── package.json                    # @kindlm/cloud, depends: hono, zod, @cloudflare/workers-types
├── tsconfig.json
├── vitest.config.ts
├── wrangler.jsonc                  # Cloudflare Workers config
├── src/
│   ├── index.ts                    # export default worker (Hono app)
│   │
│   ├── types.ts                    # Cloud-specific types (Organization, User, Project, TestRun, etc.)
│   │
│   ├── routes/
│   │   ├── index.ts                # Barrel: register all routes in Hono app
│   │   ├── auth.ts                 # POST /v1/auth/tokens, GET /v1/auth/tokens, DELETE
│   │   ├── auth.test.ts
│   │   ├── oauth.ts                # GET /auth/login, /auth/callback, /auth/logout
│   │   ├── oauth.test.ts
│   │   ├── sso.ts                  # SAML SSO endpoints (enterprise)
│   │   ├── sso.test.ts
│   │   ├── projects.ts             # CRUD /v1/projects
│   │   ├── projects.test.ts
│   │   ├── suites.ts               # CRUD /v1/projects/:id/suites
│   │   ├── suites.test.ts
│   │   ├── runs.ts                 # GET /v1/projects/:id/runs, POST /v1/runs/upload
│   │   ├── runs.test.ts
│   │   ├── results.ts              # GET /v1/runs/:id/results
│   │   ├── results.test.ts
│   │   ├── baselines.ts            # CRUD /v1/suites/:id/baselines
│   │   ├── baselines.test.ts
│   │   ├── compare.ts              # GET /v1/runs/:id/compare (diff logic)
│   │   ├── compare.test.ts
│   │   ├── compliance.ts           # GET /v1/runs/:id/compliance (PDF generation)
│   │   ├── compliance.test.ts
│   │   ├── members.ts              # Team member CRUD
│   │   ├── members.test.ts
│   │   ├── billing.ts              # Stripe integration + plan management
│   │   ├── billing.test.ts
│   │   ├── webhooks.ts             # Slack/custom webhooks
│   │   ├── webhooks.test.ts
│   │   ├── audit.ts                # Audit log queries (enterprise)
│   │   ├── audit.test.ts
│   │   └── audit-helper.ts         # Audit log utility functions
│   │
│   ├── middleware/
│   │   ├── auth.ts                 # Bearer token validation → org scoping
│   │   ├── auth.test.ts
│   │   ├── rate-limit.ts           # Per-org rate limiting (DurableObject)
│   │   ├── rate-limit.test.ts
│   │   └── plan-gate.ts            # Feature gating (free/team/enterprise)
│   │
│   ├── db/
│   │   ├── queries.ts              # Type-safe prepared statement helpers
│   │   ├── queries.test.ts
│   │   ├── schema.sql              # D1 table definitions (organizations, users, projects, runs, results, baselines, audit_logs, api_tokens)
│   │   └── migrations/             # Ordered migration scripts
│   │       ├── 001-initial.sql     # Create all tables
│   │       ├── 002-add-audit.sql   # Add audit_logs table
│   │       └── ...
│   │
│   ├── crypto/
│   │   ├── envelope.ts             # AES-256-GCM encryption for compliance reports
│   │   └── envelope.test.ts
│   │
│   ├── webhooks/
│   │   ├── dispatch.ts             # Send Slack/custom webhooks
│   │   ├── dispatch.test.ts
│   │   ├── slack-format.ts         # Slack message formatting
│   │   └── slack-format.test.ts
│   │
│   ├── validation.ts               # Zod schemas for API request bodies
│   ├── test-helpers.ts             # Test utilities (mock D1, etc.)
│   │
│   └── types.ts                    # Hono request/response types
│
├── dist/                           # Compiled (tsc --noEmit only; Wrangler bundles)
└── README.md
```

**D1 Schema:**

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free|team|enterprise
  github_org TEXT,
  stripe_customer_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  email TEXT,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member',  -- owner|admin|member
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  git_commit TEXT,
  git_branch TEXT,
  ci_provider TEXT,  -- github_actions|gitlab_ci|local
  total_tests INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  pass_rate REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  compliance_report TEXT,      -- Markdown or encrypted
  compliance_hash TEXT,        -- SHA-256 for verification
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES test_runs(id),
  suite_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  pass BOOLEAN NOT NULL,
  assertions_json TEXT NOT NULL,    -- JSON array
  response_text TEXT,
  tool_calls_json TEXT,             -- JSON array
  latency_ms INTEGER,
  cost_usd REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE baselines (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  baseline_text TEXT,
  baseline_json TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT,  -- space-separated: read:runs write:baselines
  last_used TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,  -- created_run, updated_baseline, etc.
  resource_type TEXT,    -- run, baseline, project
  resource_id TEXT,
  changes TEXT,          -- JSON diff
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Hono Route Pattern:**

```typescript
// routes/runs.ts
export function createRunsRoute(app: Hono<CloudEnv>) {
  app.get("/v1/projects/:projectId/runs", auth, rateLimit, planGate, async (c) => {
    // Fetch runs from D1
    // Return JSON
  });
  app.post("/v1/runs/upload", auth, rateLimit, validateBody, async (c) => {
    // Insert test_runs + test_results
    // Trigger webhooks
    // Return 201
  });
}
```

---

### Dashboard Package (`packages/dashboard/`)

Next.js SPA for test history and compliance reports.

```
packages/dashboard/
├── package.json                    # next, react, react-dom, swr, tailwindcss
├── tsconfig.json
├── next.config.mjs                 # Output static export or serverless
├── tailwind.config.ts              # Tailwind configuration
├── postcss.config.mjs              # PostCSS setup
├── src/
│   └── app/                        # App Router (Next.js 13+)
│       ├── layout.tsx              # Root layout, auth redirect
│       ├── page.tsx                # / (dashboard home)
│       ├── globals.css             # Global styles
│       ├── (auth)/
│       │   ├── login/page.tsx       # /login (OAuth flow)
│       │   └── logout/page.tsx
│       ├── projects/
│       │   ├── page.tsx            # /projects (project list + CRUD)
│       │   ├── [id]/page.tsx       # /projects/:id (project detail)
│       │   └── [id]/settings/page.tsx
│       ├── runs/
│       │   ├── page.tsx            # /runs (test run history)
│       │   └── [id]/page.tsx       # /runs/:id (run detail + assertions)
│       ├── compliance/
│       │   ├── page.tsx            # /compliance (compliance report list)
│       │   └── [id]/page.tsx       # /compliance/:id (report viewer)
│       └── settings/
│           ├── page.tsx            # /settings (team, billing, integrations)
│           ├── team/page.tsx
│           ├── billing/page.tsx
│           └── integrations/page.tsx
│
│   ├── components/
│   │   ├── auth/
│   │   │   ├── OAuthButton.tsx
│   │   │   └── RequireAuth.tsx
│   │   ├── dashboard/
│   │   │   ├── RunsList.tsx
│   │   │   ├── RunDetail.tsx
│   │   │   ├── AssertionTable.tsx
│   │   │   └── ComplianceViewer.tsx
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectDelete.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Modal.tsx
│   │   └── common/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                  # SWR hooks for Cloud API calls
│   │   ├── auth.ts                 # Auth context + useAuth() hook
│   │   └── utils.ts                # Format dates, numbers, etc.
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── og-image.png
│
├── out/                            # Static export output
├── .vercel/                        # Vercel deployment config (or .netlify/)
└── README.md
```

**Data Fetching Pattern (SWR):**

```typescript
// lib/api.ts
export function useRuns(projectId?: string) {
  return useSWR(
    projectId ? `/api/projects/${projectId}/runs` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
}

export function useRun(runId: string) {
  return useSWR(`/api/runs/${runId}`, fetcher);
}
```

**Auth Flow:**
1. User clicks "Login with GitHub"
2. Redirected to Cloud OAuth endpoint
3. OAuth callback returns JWT + refresh token
4. Store in `localStorage`
5. All API requests include `Authorization: Bearer <token>`
6. RequireAuth wrapper protects pages

---

### VS Code Extension Package (`packages/vscode/`)

Lightweight extension for kindlm.yaml editing.

```
packages/vscode/
├── package.json                    # vscode extension config
├── tsconfig.json
├── esbuild.config.mjs              # esbuild bundling config
├── src/
│   ├── extension.ts                # Extension activation
│   ├── completions.ts              # Completion provider
│   ├── hover.ts                    # Hover documentation
│   └── index.ts                    # Commands registration
│
├── schemas/
│   └── kindlm.schema.json          # JSON schema for kindlm.yaml
│
└── dist/
    └── extension.js                # Bundled output (esbuild)
```

**Features:**
- IntelliSense completions for provider names, assertion types
- Hover docs showing assertion descriptions
- JSON schema validation in editor

---

## Common Coding Patterns

### Adding a New Assertion Type

**1. Core implementation:**
```typescript
// core/src/assertions/my-assertion.ts
import { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export class MyAssertion implements Assertion {
  readonly type = "my_type";

  async evaluate(context: AssertionContext): Promise<AssertionResult[]> {
    // Logic here
    return [{
      assertionType: this.type,
      label: "My assertion label",
      passed: true,
      score: 1.0,
    }];
  }
}

export function createMyAssertion(): Assertion {
  return new MyAssertion();
}
```

**2. Register in registry:**
```typescript
// core/src/assertions/registry.ts
import { createMyAssertion } from "./my-assertion.js";

const assertionFactories: Record<string, () => Assertion> = {
  "my_type": createMyAssertion,
  // ... other types
};
```

**3. Add Zod schema:**
```typescript
// core/src/config/schema.ts
const AssertionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("my_type"), label: z.string() }),
  // ... other types
]);
```

**4. Test it:**
```typescript
// core/src/assertions/my-assertion.test.ts
describe("MyAssertion", () => {
  it("should pass when condition met", async () => {
    const assertion = createMyAssertion();
    const result = await assertion.evaluate(context);
    expect(result[0].passed).toBe(true);
  });
});
```

### Adding a New Provider

**1. Create provider adapter:**
```typescript
// core/src/providers/my-provider.ts
import { ProviderAdapter, ProviderRequest, ProviderResponse } from "./interface.js";

export class MyProviderAdapter implements ProviderAdapter {
  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    // Call API, map response
  }
}

export function createMyProviderAdapter(config: ProviderConfig): ProviderAdapter {
  return new MyProviderAdapter(config);
}
```

**2. Register in registry:**
```typescript
// core/src/providers/registry.ts
import { createMyProviderAdapter } from "./my-provider.js";

const providerFactories = {
  "my-provider": createMyProviderAdapter,
  // ... other providers
};
```

**3. Add pricing:**
```typescript
// core/src/providers/pricing.ts
const PRICING = {
  "my-provider": {
    "model-name": { input: 0.001, output: 0.002 },
  },
};
```

**4. Test resilience:**
```typescript
// core/src/providers/my-provider.resilience.test.ts
describe("MyProvider resilience", () => {
  it("should retry on timeout", async () => {
    // Mock timeout, verify retry
  });
});
```

### Adding a CLI Command

**1. Create command file:**
```typescript
// cli/src/commands/my-command.ts
import { Command } from "commander";

export function createMyCommand(): Command {
  return new Command("my-command")
    .description("Description")
    .action(async (options) => {
      // Implementation
      process.exit(0);
    });
}
```

**2. Register in CLI:**
```typescript
// cli/src/index.ts
import { createMyCommand } from "./commands/my-command.js";

const program = new Command();
program.addCommand(createMyCommand());
```

**3. Test with mocks:**
```typescript
// cli/src/commands/my-command.test.ts
describe("my-command", () => {
  it("should do something", async () => {
    vi.mock("../utils/file-reader.ts", () => ({
      readFile: vi.fn().mockResolvedValue("test"),
    }));
  });
});
```

### Adding a Cloud Route

**1. Create route file:**
```typescript
// cloud/src/routes/my-resource.ts
import { Hono } from "hono";
import type { CloudEnv } from "../types.js";

export function createMyResourceRoute(app: Hono<CloudEnv>) {
  app.get("/v1/my-resource", async (c) => {
    const user = c.get("user");
    const db = c.env.DB;
    // Query + return
  });
}
```

**2. Register in main:**
```typescript
// cloud/src/index.ts
import { createMyResourceRoute } from "./routes/my-resource.js";

const app = new Hono();
createMyResourceRoute(app);
```

**3. Test with test-helpers:**
```typescript
// cloud/src/routes/my-resource.test.ts
import { createMockD1 } from "../test-helpers.js";

describe("GET /v1/my-resource", () => {
  it("should return 200", async () => {
    const db = createMockD1();
    // Test logic
  });
});
```

---

## File Naming Conventions

- **Source files:** `lowercase-with-hyphens.ts` (kebab-case)
- **Barrel exports:** Always `index.ts`
- **Tests:** `filename.test.ts` (colocated with source)
- **Resilience tests:** `filename.resilience.test.ts` (edge cases, timeouts, retries)
- **Fuzz tests:** `filename.fuzz.test.ts` (malformed input)
- **Config files:** camelCase (tsconfig.json, vitest.config.ts)
- **Directories:** lowercase, plural if contains many (providers/, assertions/, etc.)

---

## Import Conventions

All files use ESM with `.js` extensions:

```typescript
// Always .js extension
import { foo } from "../lib/foo.js";
import type { Bar } from "./types.js";

// Never mix default + named imports
import { createAdapter } from "./registry.js";

// Type-only imports use import type
import type { ProviderRequest } from "./interface.js";
```

TSConfig setting: `"verbatimModuleSyntax": true`

---

## Test File Organization

Each test file covers one concern:

```typescript
// assertions/tool-calls.test.ts
describe("Tool call assertions", () => {
  describe("tool_called", () => {
    it("should pass when tool called with exact args", () => { /* ... */ });
    it("should fail when tool not called", () => { /* ... */ });
    it("should match partial args", () => { /* ... */ });
  });

  describe("tool_not_called", () => {
    it("should pass when tool not invoked", () => { /* ... */ });
    it("should fail when tool invoked", () => { /* ... */ });
  });

  describe("tool_order", () => {
    it("should validate tool sequence", () => { /* ... */ });
  });
});
```

---

## Adding a New Dashboard Page

**1. Create page component:**
```typescript
// packages/dashboard/src/app/my-page/page.tsx
"use client";
import { useMyResource } from "@/lib/api";

export default function MyPage() {
  const { data, error } = useMyResource();

  if (error) return <div>Error loading</div>;
  if (!data) return <div>Loading...</div>;

  return <div>{/* Page content */}</div>;
}
```

**2. Add API hook:**
```typescript
// packages/dashboard/src/lib/api.ts
export function useMyResource() {
  return useSWR("/api/my-resource", fetcher);
}
```

**3. Create route in Cloud (if needed):**
```typescript
// cloud/src/routes/my-resource.ts
export function createMyResourceRoute(app: Hono<CloudEnv>) {
  app.get("/v1/my-resource", auth, async (c) => {
    // Return data
  });
}
```

---

## Deployment Checklist

**Before deploying:**
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (all packages)
- [ ] `npm run lint` passes (no errors)
- [ ] Git is clean (no uncommitted changes)
- [ ] Create changeset: `npm run changeset`

**CLI deployment:**
```bash
npm run build
npm publish
```

**Cloud deployment:**
```bash
npm run build
npx wrangler deploy
```

**Dashboard deployment:**
```bash
npm run build
npx wrangler pages deploy ./packages/dashboard/out
```

---

## Where to Add Common Features

| Feature | Location | Files |
|---------|----------|-------|
| New assertion type | core | `src/assertions/my-assertion.ts`, registry update |
| New provider | core | `src/providers/my-provider.ts`, registry update, pricing |
| New CLI command | cli | `src/commands/my-command.ts`, register in index.ts |
| New Cloud route | cloud | `src/routes/my-resource.ts`, register in index.ts |
| New dashboard page | dashboard | `src/app/my-page/page.tsx`, API hook |
| New reporter format | core | `src/reporters/my-reporter.ts`, register in index.ts |
| Configuration option | core | Update `config/schema.ts` |
| Database table | cloud | `src/db/migrations/*.sql`, update `db/queries.ts` |
