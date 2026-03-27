# KindLM Technology Stack

## Language & Runtime

- **Language:** TypeScript 5.7.0 (strict mode, ESM-first)
- **Node.js Runtime:** ≥20.0.0 (enforced in `engines` field)
- **Cloudflare Workers Runtime:** Node.js compat flag enabled (for Cloud package)
- **Package Manager:** npm 11.6.0 (workspace-based monorepo)

## Monorepo Architecture

**Workspaces:** npm workspaces with Turborepo 2.3.0 orchestration

```
packages/
├── core/       @kindlm/core      (v0.2.1, MIT)      — Core business logic
├── cli/        @kindlm/cli       (v0.4.1, MIT)      — CLI entry point
├── cloud/      @kindlm/cloud     (v0.0.0, AGPL)     — Cloudflare Workers API + D1
├── dashboard/  @kindlm/dashboard (v0.0.0, private) — Next.js admin dashboard
└── vscode/     kindlm            (v0.1.0, MIT)      — VS Code extension
```

### Package Manager Configuration
- **Type:** ESM modules (`"type": "module"` in all packages)
- **Workspace exports:** Use `"*"` for workspace dependencies (not `"workspace:*"`)
- **Export order:** `types` condition MUST come before `import`/`require`

## Core Languages & Frameworks

### @kindlm/core (Zero-I/O Business Logic)
- **Purpose:** Provider adapters, assertion handlers, config parsing, result aggregation
- **Key Dependencies:**
  - `zod` 3.24.0 — Configuration validation & schema inference
  - `yaml` 2.6.0 — YAML parsing (kindlm.yaml config files)
  - `ajv` 8.17.0 + `ajv-formats` 3.0.0 — JSON Schema validation for structured outputs
- **I/O:** None. All HTTP, file I/O, and console output are injected via interfaces.
- **Build:** tsup (bundles to `.cjs` + `.js` + `.d.ts`)

### @kindlm/cli (Node.js CLI)
- **Purpose:** Command-line interface, test execution orchestration
- **Key Dependencies:**
  - `@kindlm/core` — All business logic
  - `commander` 13.0.0 — CLI argument parsing & command structure
  - `chalk` 5.4.0 — Colored terminal output (results, errors, progress)
  - `ora` 8.1.0 — Spinner/loading indicators
  - `pdfkit` 0.15.0 — PDF generation for compliance reports
- **Build:** tsup (dual-mode ESM + CommonJS with executable shebang)
- **Entry Point:** `kindlm` binary via `bin` field

### @kindlm/cloud (Cloudflare Workers API)
- **Purpose:** REST API, D1 database, team management, compliance storage
- **Runtime:** Cloudflare Workers (V8 isolate, compat mode enabled)
- **Key Dependencies:**
  - `hono` 4.6.0 — Lightweight HTTP router/framework
  - `zod` 3.24.0 — Request/response validation
- **Build:** TypeScript only (`tsc --noEmit`), no bundler (Wrangler bundles)
- **Database:** Cloudflare D1 (SQLite-compatible)

### @kindlm/dashboard (Next.js Admin Dashboard)
- **Purpose:** Test history, run comparison, team collaboration UI
- **Runtime:** Node.js 20+ (Next.js SSR/static export)
- **Key Dependencies:**
  - `next` 15.2.0 — Full-stack React framework
  - `react` 19.0.0 — UI components
  - `react-dom` 19.0.0 — DOM rendering
  - `swr` 2.2.0 — Data fetching & client-side caching
- **Styling:** Tailwind CSS 3.4.0 + PostCSS 8.4.0 + Autoprefixer 10.4.0
- **Build:** Next.js built-in (generates `.next/` with static + SSR chunks)

### kindlm (VS Code Extension)
- **Purpose:** YAML schema validation, completions, hover docs for `kindlm.yaml`
- **Runtime:** VS Code 1.85.0+
- **Key Dependencies:**
  - `@types/vscode` 1.85.0 — VS Code API types
  - `esbuild` 0.25.0 — Bundling (outputs single `extension.js`)
- **Distribution:** Packaged via `vsce` (VS Code Extension CLI)

## Build Tools

- **Turborepo v2.3.0** — Orchestrates monorepo build, test, lint tasks
- **tsup v8.3.0** — Fast TypeScript bundler (core + cli packages)
- **Wrangler v4.75.0** — Cloudflare Workers deployment, D1 migrations
- **TypeScript v5.7.0** — Strict type checking across all packages
- **esbuild v0.25.0** — VS Code extension bundling

## Development & Testing

- **Test Framework:** Vitest 3.2.4
  - Unit & integration tests: `packages/*/src/**/*.test.ts`
  - Config: Shared `vitest.config.ts` in root, packages must set `passWithNoTests: true`
  - Mocking: `vi.mock()` for provider/HTTP client mocking
- **Linting:** ESLint 9.17.0 (flat config)
  - Parser: typescript-eslint 8.18.0
  - Strict rules: No `any`, consistent type imports, no unused vars
  - Ignores: `dist/`, `site/`, config files, `reference/`
- **Code Formatting:** Prettier 3.4.0
  - Config: Semi colons, double quotes, trailing commas, 100 char width
- **Type Checking:** `tsc --noEmit` (no compilation, types only)

## Versioning & Release

- **Changesets v2.27.0** — Version management across workspace packages
- **Release Flow:** Automated via GitHub Actions on `main` branch
  - Creates release PRs with changelog
  - Publishes to npm (core, cli)
  - Cloud (AGPL) published to npm but source available in repo

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

**Root `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

**Key settings:**
- `verbatimModuleSyntax: true` — Forces `import type` for type-only imports
- `moduleResolution: "bundler"` — Allows workspace path resolution
- `.js` file extensions required in all relative imports (ESM standard)

## Dependency Totals

**Production (core + cli):**
- zod, yaml, ajv, ajv-formats, commander, chalk, ora, pdfkit — ~15 direct deps

**Production (cloud):**
- hono, zod — ~2 direct deps

**Dev (root + all packages):**
- turbo, typescript, vitest, eslint, typescript-eslint, prettier, changesets, tsup, fast-check, @cloudflare/workers-types, wrangler, @types/*, etc. — ~20+ shared dev deps

**Dashboard:**
- next, react, react-dom, swr, tailwindcss, autoprefixer, postcss — ~7 deps

## Architecture Constraints

1. **Core has zero I/O** — All HTTP, file I/O, process access injected via interfaces
2. **Cloud is Workers-compatible** — No Node.js built-ins, only Web APIs + Cloudflare bindings
3. **CLI is thin** — Delegates all business logic to core, handles user I/O only
4. **ESM-first** — All packages use ESM syntax, dual-mode output where needed
5. **No classes except ProviderError** — Use factory functions instead
6. **Workspace dependency rules** — Core never imports cli/cloud, cloud imports only types from core

## GitHub Actions CI/CD

- **Lint:** ESLint on all packages
- **Typecheck:** tsc --noEmit on all packages
- **Test:** Vitest on all packages (fail if coverage gaps detected)
- **Build:** Turbo build orchestration
- **Deploy cloud:** Wrangler deploy to staging + production (on cloud/* changes)
- **Deploy dashboard:** Next.js build + Cloudflare Pages deploy (on dashboard/* changes)
- **Release:** Changesets publish (on main branch, all package versions bumped together)
