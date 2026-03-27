<!-- GSD:project-start source:PROJECT.md -->
## Project

**KindLM v1.0**

KindLM is an open-source CLI tool that runs behavioral regression tests against AI agents. It tests what agents **do** (tool calls, decisions, structured output) — not just what they say. The paid Cloud tier adds team dashboards, test history, compliance PDF export, and billing. Target: solo developers building AI agents who need CI-friendly behavioral testing.

**Core Value:** The CLI must reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

### Constraints

- **Infra:** Cloudflare ecosystem (Workers, D1, Pages) — already committed, not changing
- **Budget:** Stripe test mode first, real keys when billing flow is verified
- **Auth:** GitHub OAuth is the only login method for v1 (SAML is enterprise-only)
- **npm:** Already published under @kindlm scope — must maintain semver compatibility
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Language & Runtime
- **Language:** TypeScript 5.7.0 (strict mode, ESM-first)
- **Node.js Runtime:** ≥20.0.0 (enforced in `engines` field)
- **Cloudflare Workers Runtime:** Node.js compat flag enabled (for Cloud package)
- **Package Manager:** npm 11.6.0 (workspace-based monorepo)
## Monorepo Architecture
### Package Manager Configuration
- **Type:** ESM modules (`"type": "module"` in all packages)
- **Workspace exports:** Use `"*"` for workspace dependencies (not `"workspace:*"`)
- **Export order:** `types` condition MUST come before `import`/`require`
## Core Languages & Frameworks
### @kindlm/core (Zero-I/O Business Logic)
- **Purpose:** Provider adapters, assertion handlers, config parsing, result aggregation
- **Key Dependencies:**
- **I/O:** None. All HTTP, file I/O, and console output are injected via interfaces.
- **Build:** tsup (bundles to `.cjs` + `.js` + `.d.ts`)
### @kindlm/cli (Node.js CLI)
- **Purpose:** Command-line interface, test execution orchestration
- **Key Dependencies:**
- **Build:** tsup (dual-mode ESM + CommonJS with executable shebang)
- **Entry Point:** `kindlm` binary via `bin` field
### @kindlm/cloud (Cloudflare Workers API)
- **Purpose:** REST API, D1 database, team management, compliance storage
- **Runtime:** Cloudflare Workers (V8 isolate, compat mode enabled)
- **Key Dependencies:**
- **Build:** TypeScript only (`tsc --noEmit`), no bundler (Wrangler bundles)
- **Database:** Cloudflare D1 (SQLite-compatible)
### @kindlm/dashboard (Next.js Admin Dashboard)
- **Purpose:** Test history, run comparison, team collaboration UI
- **Runtime:** Node.js 20+ (Next.js SSR/static export)
- **Key Dependencies:**
- **Styling:** Tailwind CSS 3.4.0 + PostCSS 8.4.0 + Autoprefixer 10.4.0
- **Build:** Next.js built-in (generates `.next/` with static + SSR chunks)
### kindlm (VS Code Extension)
- **Purpose:** YAML schema validation, completions, hover docs for `kindlm.yaml`
- **Runtime:** VS Code 1.85.0+
- **Key Dependencies:**
- **Distribution:** Packaged via `vsce` (VS Code Extension CLI)
## Build Tools
- **Turborepo v2.3.0** — Orchestrates monorepo build, test, lint tasks
- **tsup v8.3.0** — Fast TypeScript bundler (core + cli packages)
- **Wrangler v4.75.0** — Cloudflare Workers deployment, D1 migrations
- **TypeScript v5.7.0** — Strict type checking across all packages
- **esbuild v0.25.0** — VS Code extension bundling
## Development & Testing
- **Test Framework:** Vitest 3.2.4
- **Linting:** ESLint 9.17.0 (flat config)
- **Code Formatting:** Prettier 3.4.0
- **Type Checking:** `tsc --noEmit` (no compilation, types only)
## Versioning & Release
- **Changesets v2.27.0** — Version management across workspace packages
- **Release Flow:** Automated via GitHub Actions on `main` branch
## Configuration Files
| File | Package | Purpose |
|------|---------|---------|
| `package.json` | Root | Workspace definition, shared scripts, dev dependencies |
| `turbo.json` | Root | Turborepo task graph (build, test, lint, typecheck) |
| `tsconfig.json` | Root | Shared TypeScript config (target: ESM, module: esnext, strict) |
| `eslint.config.js` | Root | ESLint flat config (all packages) |
| `.prettierrc` | Root | Prettier formatting rules |
| `vitest.config.ts` | Root | Shared Vitest config |
| `wrangler.toml` | cloud | Cloudflare Workers config, D1 binding, routes, cron triggers |
| `next.config.js` | dashboard | Next.js build config (API routes, rewrites, redirects) |
## TypeScript Configuration
- `verbatimModuleSyntax: true` — Forces `import type` for type-only imports
- `moduleResolution: "bundler"` — Allows workspace path resolution
- `.js` file extensions required in all relative imports (ESM standard)
## Dependency Totals
- zod, yaml, ajv, ajv-formats, commander, chalk, ora, pdfkit — ~15 direct deps
- hono, zod — ~2 direct deps
- turbo, typescript, vitest, eslint, typescript-eslint, prettier, changesets, tsup, fast-check, @cloudflare/workers-types, wrangler, @types/*, etc. — ~20+ shared dev deps
- next, react, react-dom, swr, tailwindcss, autoprefixer, postcss — ~7 deps
## Architecture Constraints
## GitHub Actions CI/CD
- **Lint:** ESLint on all packages
- **Typecheck:** tsc --noEmit on all packages
- **Test:** Vitest on all packages (fail if coverage gaps detected)
- **Build:** Turbo build orchestration
- **Deploy cloud:** Wrangler deploy to staging + production (on cloud/* changes)
- **Deploy dashboard:** Next.js build + Cloudflare Pages deploy (on dashboard/* changes)
- **Release:** Changesets publish (on main branch, all package versions bumped together)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Overview
## Code Style
### No Classes
- Never use ES6 `class` syntax, except for error types
- Use plain functions and factory patterns instead
- Error types are exceptions: `export class ProviderError extends Error`
### Factory Functions
- Pattern: `createXxxAdapter()`, `createXxxAssertion()`, `createXxxReporter()`
- Example from `packages/core/src/providers/registry.ts`:
### Pure Functions in Core
- `@kindlm/core` must have **zero I/O dependencies**
- No `fs`, `fetch`, `console.log` in core
- All I/O is **injected as interfaces** (Dependency Injection)
- Example interface pattern from `packages/core/src/providers/interface.ts`:
### Result Types Over Exceptions
- All fallible operations return `Result<T, E>` from `packages/core/src/types/result.ts`
- Pattern: `{ success: true; data: T } | { success: false; error: E }`
- Never throw from core functions (except during config validation with Zod)
- Helper functions:
- Usage in tests:
### One File Per Concern
- Each assertion type gets its own file: `tool-calls.ts`, `schema.ts`, `pii.ts`, `judge.ts`
- Factories, registries, and interfaces are separate
- Co-locate tests with source files (`.test.ts` suffix)
### Descriptive Naming
- Function names describe behavior, not implementation
- Examples: `evaluateToolCallAssertion()`, `createSchemaValidator()`, `withRetry()`
- Avoid abbreviations in exported names
## TypeScript Conventions
### Strict Mode
- All packages compile with `strict: true`
- Root `tsconfig.json` at `/Users/petr/projects/kindlm/tsconfig.json`:
### verbatimModuleSyntax
- **Always** use `import type` for type-only imports
- Enforced by `@typescript-eslint/consistent-type-imports` rule
- Correct:
- Incorrect:
### Module Extensions
- **All relative imports must include `.js` extension** (ESM)
- Correct: `import { ok } from "../types/result.js"`
- Incorrect: `import { ok } from "../types/result"` ❌
- This is required for ESM bundling and Workers compatibility
### No `any`
- Use `unknown` instead of `any`
- Narrow with type guards:
### Type Imports for Distributed Code
- For packages exported to npm, use `import type` for all type-only imports
- Workers compatibility: Cloud package imports only **types** from core (no runtime values)
## Exports & Barrel Files
### Barrel Export Pattern
- Each directory with public API has an `index.ts` that re-exports
- File: `packages/core/src/providers/index.ts`
### Package.json Exports
- TypeScript condition **must come first** in `exports` object
- File: `packages/core/package.json`
## Error Handling
### ErrorCode Union Type
- All KindLM errors use predefined error codes (from `packages/core/src/types/result.ts`)
- Codes are organized by category:
### KindlmError Interface
### Throwing from Core
- Only during **config validation** using Zod
- Zod throws `ZodError` which is caught and converted to `Result<never, KindlmError>`
- Provider API errors are caught and returned as `Result<never, ProviderError>`
## ESLint & Prettier
### Flat Config
- File: `/Users/petr/projects/kindlm/eslint.config.js`
- Enforces:
### Run Linting
## File Organization
### Core Package Structure
### CLI Package Structure
## Comments & Documentation
### When to Comment
- **Always:** Explain "why", not "what"
- Avoid: Comments that just repeat the code
- Good: "Retry with exponential backoff to handle transient API failures"
- Bad: "Add 1 to the counter"
### Type Documentation
- Use JSDoc for exported functions/types:
## Build & Bundling
### Package Build
- Tool: `tsup` (TypeScript bundler)
- Each package defines `tsup.config.ts`
- Outputs:
### CLI Bundling
- Single executable via `@vercel/ncc` or tsup
- Includes `@kindlm/core` as bundled dependency
### Cloud Bundling
- Wrangler + tsup
- No bundling of core (imported as types only at runtime)
- Workers compatibility: no Node.js APIs
## Key Files to Know
- `/Users/petr/projects/kindlm/tsconfig.json` — Root TS config
- `/Users/petr/projects/kindlm/eslint.config.js` — Lint rules
- `/Users/petr/projects/kindlm/packages/core/src/types/result.ts` — Result type
- `/Users/petr/projects/kindlm/packages/core/src/providers/interface.ts` — Provider interface
- `/Users/petr/projects/kindlm/packages/core/src/config/schema.ts` — Zod schema
- `/Users/petr/projects/kindlm/packages/*/package.json` — Workspace deps & exports
## Dependency Rules (STRICT)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Monorepo Overview
```
```
## Package Dependency Graph
```
```
- `core` never imports from `cli`, `cloud`, `dashboard`, or `vscode`
- `cli` depends on `core` for all business logic
- `cloud` uses Zod for validation; never imports runtime code from `core`
- `dashboard` and `vscode` are standalone consumers of cloud API
- All provider API keys are user-owned (never proxied through cloud)
## Architectural Layers
### Layer 1: Core (`@kindlm/core`)
- **config/** — YAML parsing, Zod validation, variable interpolation
- **types/** — All type definitions and interfaces
- **providers/** — Multi-provider adapter pattern
- **assertions/** — Test assertion handlers (11 types)
- **engine/** — Test execution orchestration
- **reporters/** — Output formatters (4 types)
- **baseline/** — Saved test result comparison
- **trace/** — Observability and span mapping
```typescript
```
### Layer 2: CLI (`@kindlm/cli`)
- **commands/** — 7 user-facing commands
- **utils/** — Support functions
- **cloud/** — Cloud integration
- `bin/kindlm.ts` — Commander CLI program setup
- `0` — All tests passed
- `1` — Any test failed or error occurred
### Layer 3: Cloud (`@kindlm/cloud`)
- **routes/** — 12 REST API endpoints (Hono framework)
- **middleware/** — Security & rate limiting
- **db/** — D1 database layer
- **crypto/** — Data encryption
- **webhooks/** — Outbound notifications
```sql
```
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
- `app/` — Next.js App Router pages
- `components/` — React components
- Styling: Tailwind CSS
- Data fetching: SWR (Stale-While-Revalidate)
- Auth: GitHub OAuth → JWT stored in Cloud
- `/` — Dashboard home (runs list)
- `/projects` — Project list + CRUD
- `/settings` — Team, billing, integration settings
- `/login` — OAuth flow
- `/compliance` — Compliance report viewer
### Layer 5: VS Code Extension (`@kindlm/vscode`)
- JSON schema validation + IntelliSense
- Hover documentation
- Completions for provider/assertion types
- `extension.ts` — Extension activation
- `completions.ts` — Completion provider
- `hover.ts` — Hover documentation
- `schemas/kindlm.schema.json` — JSON schema
## Data Flow: Config → Execution → Report
```
```
## Dependency Injection Pattern
```typescript
```
## Error Handling
```typescript
```
## Testing Strategy
- **Unit tests:** `*.test.ts` files colocated with source
- **Integration tests:** Full config → runner → assertions pipeline
- **Resilience tests:** Provider timeout/retry scenarios
- **Fuzz tests:** Config parser with malformed input
- **Test framework:** Vitest with vi.mock() for provider mocking
## Build & Release
- `npm run build` → compile all packages (TypeScript → ESM)
- `npm run test` → run all test suites
- `npm run lint` → ESLint 9 flat config
- `npm run typecheck` → tsc --noEmit
- CLI: npm publish to npmjs.com
- Cloud: `npm run build && npx wrangler deploy` to Cloudflare Workers
- Dashboard: `npm run build && npx wrangler pages deploy ./out`
## Key Design Decisions
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
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
