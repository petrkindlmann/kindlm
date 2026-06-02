# KindLM Project Structure

## Monorepo Layout

```
kindlm/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint, test, build all packages
│   │   ├── release-cli.yml           # npm publish @kindlm/cli
│   │   ├── release-cloud.yml         # Deploy Workers + D1 migrations
│   │   └── docs-deploy.yml           # Docs site deploy
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── packages/
│   ├── core/                         # @kindlm/core — shared logic
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── schema.ts         # Zod schema for kindlm.yaml
│   │   │   │   ├── parser.ts         # YAML parse + validate + resolve
│   │   │   │   ├── interpolation.ts  # Template variable interpolation
│   │   │   │   └── index.ts
│   │   │   ├── providers/
│   │   │   │   ├── interface.ts      # Provider adapter interface
│   │   │   │   ├── openai.ts         # OpenAI adapter
│   │   │   │   ├── anthropic.ts      # Anthropic adapter
│   │   │   │   ├── registry.ts       # Provider registry + factory
│   │   │   │   └── index.ts
│   │   │   ├── assertions/
│   │   │   │   ├── interface.ts      # Assertion interface + types
│   │   │   │   ├── schema.ts         # JSON schema validation (AJV)
│   │   │   │   ├── pii.ts           # PII regex detection
│   │   │   │   ├── keywords.ts       # Keyword deny/allow lists
│   │   │   │   ├── judge.ts          # LLM-as-judge assertion
│   │   │   │   ├── tool-calls.ts     # Tool call assertions
│   │   │   │   ├── drift.ts          # Baseline drift (LLM-judge + field-level)
│   │   │   │   ├── classification.ts # Assertion category classification (deterministic/probabilistic)
│   │   │   │   ├── registry.ts       # Assertion registry
│   │   │   │   └── index.ts
│   │   │   ├── engine/
│   │   │   │   ├── runner.ts         # Test execution engine
│   │   │   │   ├── aggregator.ts     # Multi-run aggregation logic
│   │   │   │   ├── gate.ts           # Gate evaluation (pass/fail)
│   │   │   │   ├── command.ts        # Command test executor interface + output parser
│   │   │   │   └── index.ts
│   │   │   ├── reporters/
│   │   │   │   ├── interface.ts      # Reporter interface
│   │   │   │   ├── pretty.ts         # Terminal pretty-print reporter
│   │   │   │   ├── json.ts           # JSON report file
│   │   │   │   ├── junit.ts          # JUnit XML for CI
│   │   │   │   ├── compliance.ts     # EU AI Act compliance report
│   │   │   │   └── index.ts
│   │   │   ├── baseline/
│   │   │   │   ├── store.ts          # Local baseline storage (JSON files)
│   │   │   │   ├── compare.ts        # Baseline comparison logic
│   │   │   │   └── index.ts
│   │   │   ├── trace/
│   │   │   │   ├── types.ts          # OTLP wire types, ParsedSpan, TraceConfig
│   │   │   │   ├── parser.ts         # OTLP JSON payload parser
│   │   │   │   ├── mapper.ts         # Span filtering, mapping, context builder
│   │   │   │   └── index.ts
│   │   │   ├── types/
│   │   │   │   ├── config.ts         # Config types (inferred from Zod)
│   │   │   │   ├── result.ts         # Test result types
│   │   │   │   ├── report.ts         # Report output types
│   │   │   │   ├── provider.ts       # Provider request/response types
│   │   │   │   └── index.ts
│   │   │   └── index.ts              # Public API barrel export
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   ├── cli/                          # @kindlm/cli — CLI entry point
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts           # kindlm init
│   │   │   │   ├── validate.ts       # kindlm validate
│   │   │   │   ├── test.ts           # kindlm test
│   │   │   │   ├── login.ts          # kindlm login
│   │   │   │   ├── upload.ts         # kindlm upload
│   │   │   │   ├── baseline.ts       # kindlm baseline set/list/compare
│   │   │   │   └── trace.ts          # kindlm trace (OTel trace ingestion)
│   │   │   ├── utils/
│   │   │   │   ├── git.ts            # Git info (commit, branch)
│   │   │   │   ├── env.ts            # Environment detection
│   │   │   │   ├── spinner.ts        # Terminal spinner/progress
│   │   │   │   ├── command-executor.ts # Node.js command executor (child_process)
│   │   │   │   └── trace-server.ts   # OTLP HTTP server for trace collection
│   │   │   ├── cloud/
│   │   │   │   ├── client.ts         # Cloud API HTTP client
│   │   │   │   ├── auth.ts           # Token storage (~/.kindlm/credentials)
│   │   │   │   └── upload.ts         # Report upload logic
│   │   │   └── index.ts              # Commander program setup
│   │   ├── bin/
│   │   │   └── kindlm.ts             # Executable entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cloud/                        # @kindlm/cloud — Cloudflare Workers API
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts           # POST /auth/token, POST /auth/verify
│       │   │   ├── projects.ts       # CRUD /projects
│       │   │   ├── suites.ts         # CRUD /projects/:id/suites
│       │   │   ├── runs.ts           # CRUD /projects/:id/runs
│       │   │   ├── results.ts        # POST /runs/:id/results
│       │   │   ├── baselines.ts      # CRUD /suites/:id/baselines
│       │   │   └── compare.ts        # GET /runs/:id/compare
│       │   ├── middleware/
│       │   │   ├── auth.ts           # Bearer token validation
│       │   │   ├── rate-limit.ts     # Per-org rate limiting
│       │   │   ├── plan-gate.ts      # Feature gating by plan (free/team/enterprise)
│       │   │   └── idempotency.ts    # Idempotency-Key handling
│       │   ├── db/
│       │   │   ├── schema.sql        # D1 table definitions
│       │   │   ├── migrations/       # Ordered migration files
│       │   │   └── queries.ts        # Prepared statement helpers
│       │   ├── types.ts              # Shared cloud types
│       │   └── index.ts              # Worker entry (Hono router)
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
│
├── templates/                        # kindlm init templates
│   ├── kindlm.yaml                   # Default config template
│   ├── schemas/
│   │   └── example.schema.json       # Example JSON schema
│   └── tests/
│       ├── support-agent.yaml        # E-commerce support agent suite
│       ├── fintech-agent.yaml        # Fintech compliance suite
│       └── hr-screening.yaml         # HR/recruitment suite
│
├── docs/                             # Project documentation
│   ├── 00-README.md
│   ├── 01-PROJECT_STRUCTURE.md
│   ├── 02-CONFIG_SCHEMA.md
│   ├── 03-PROVIDER_INTERFACE.md
│   ├── 04-ASSERTION_ENGINE.md
│   ├── 05-CLOUD_API.md
│   ├── 06-COMPLIANCE_SPEC.md
│   ├── 07-CONTRIBUTING.md
│   ├── 08-CLI_REFERENCE.md
│   ├── 09-DEEP_RESEARCH.md
│   ├── 11-PRICING.md
│   ├── 12-PRD.md
│   ├── 13-EPICS.md
│   ├── 14-ADR.md
│   ├── 15-OPENAPI.md
│   ├── 16-TESTING_STRATEGY.md
│   ├── 17-ERROR_HANDLING.md
│   ├── 18-SECURITY.md
│   ├── 19-DEPLOYMENT.md
│   ├── 20-ROADMAP.md
│   └── archive/                      # Legacy/marketing materials
│       ├── architecture-legacy.md
│       └── PRD_Gemini_V2.md
│
├── examples/                         # Real-world example projects
│   ├── basic-prompt-test/
│   ├── agent-with-tools/
│   ├── multi-model-comparison/
│   └── eu-ai-act-compliance/
│
├── turbo.json                        # Turborepo pipeline config
├── package.json                      # Root workspace config
├── tsconfig.base.json                # Shared TS config
├── eslint.config.js                  # Shared lint config (ESLint 9 flat config)
├── .prettierrc                       # Shared formatting
├── LICENSE                           # MIT
├── README.md
├── CONTRIBUTING.md
└── CHANGELOG.md
```

## Package Boundaries

### `@kindlm/core`
- **Purpose:** All business logic. Zero CLI or HTTP dependencies.
- **Depends on:** `zod`, `ajv`, `yaml`, `uuid`
- **Used by:** `@kindlm/cli`, `@kindlm/cloud`, and potentially third-party integrations
- **Design rule:** Must be testable without any I/O. All external calls (provider APIs, file system) go through injected interfaces.

### `@kindlm/cli`
- **Purpose:** CLI entry point. Reads files, calls core, writes output.
- **Depends on:** `@kindlm/core`, `commander`, `chalk`, `ora`
- **Design rule:** Thin wrapper. All logic lives in core. CLI handles I/O, arguments, and display.

### `@kindlm/cloud`
- **Purpose:** Cloudflare Workers API. HTTP endpoints, D1 storage, auth, plan gating.
- **Depends on:** `hono` (HTTP router), `@kindlm/core` (shared types only)
- **Design rule:** Workers-compatible. No Node.js APIs. All async. D1 for storage.
- **License:** AGPL-3.0 (open-core boundary — CLI/core remain MIT)
- **Plans:** Free (1 project, 7d history) → Team $49/mo → Enterprise $299/mo

## Dependency Rules

```
@kindlm/cli  ───depends-on───▶  @kindlm/core
@kindlm/cloud ──depends-on───▶  @kindlm/core (types only)

@kindlm/core  ───depends-on───▶  (nothing internal)
```

- `core` NEVER imports from `cli` or `cloud`
- `cli` NEVER imports from `cloud`
- `cloud` imports only types from `core`, not runtime logic (Workers has different runtime constraints)

## Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| Turborepo | Monorepo build orchestration | `turbo.json` |
| TypeScript 5.4+ | Strict mode, project references | `tsconfig.base.json` |
| Vitest | Unit + integration tests | Per-package `vitest.config.ts` |
| ESLint | Linting (flat config) | `eslint.config.js` |
| Prettier | Formatting | `.prettierrc` |
| Changesets | Versioning + changelog | `.changeset/` |
| tsup | Bundle CLI + core for npm | Per-package `tsup.config.ts` |

## Build Pipeline (turbo.json)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Root package.json

```json
{
  "name": "kindlm",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev:cli": "cd packages/cli && npm run dev",
    "dev:cloud": "cd packages/cloud && npx wrangler dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "@changesets/cli": "^2.27.0",
    "tsup": "^8.0.0"
  }
}
```

## Node / Runtime Requirements

- **CLI + Core:** Node.js 20+ (LTS)
- **Cloud:** Cloudflare Workers runtime (no Node.js APIs — use `node_compat` only where needed)
- **npm:** Published as ESM + CJS dual format via tsup
