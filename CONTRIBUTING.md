# Contributing to KindLM

## Getting Started

```bash
git clone https://github.com/petrkindlmann/kindlm.git
cd kindlm
npm install
npm run build
npm run test
```

## Project Structure

```
packages/
├── core/       # @kindlm/core — All business logic. Zero I/O dependencies.
├── cli/        # @kindlm/cli  — CLI entry point. Thin wrapper around core.
├── cloud/      # @kindlm/cloud — Cloudflare Workers API + D1 database.
├── dashboard/  # @kindlm/dashboard — Next.js web UI for KindLM Cloud.
└── vscode/     # @kindlm/vscode — VS Code extension for in-editor test runs.
```

**Dependency rule:** `core` never imports from other packages. `cloud` and `dashboard` import only types from `core`.

## Development

```bash
npm run dev:cli      # Watch mode for CLI
npm run dev:cloud    # Wrangler dev server (port 8787)
npm run typecheck    # tsc --noEmit across all packages
npm run lint         # ESLint 9 flat config
npm run test         # Vitest across all packages
```

## Code Conventions

- **No classes.** Use factory functions: `createXxxAdapter()`, `createXxxReporter()`.
- **Zod for all external input.** YAML config, API request bodies — validate with Zod before use.
- **Result types over exceptions.** Return `{ success: true, data } | { success: false, error }`.
- **No `any`.** Use `unknown` + type narrowing.
- **`import type` for type-only imports.** `verbatimModuleSyntax` is enabled.
- **`.js` extensions** in all relative ESM imports.
- **Core is pure.** No `fs`, `fetch`, or `console` in `packages/core/`. All I/O is injected.

## Pull Requests

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Add or update tests for your change
3. Run the full check suite: `npm run typecheck && npm run lint && npm run test`
4. Open a PR against `main` with a clear description of what and why

For new assertion types, follow the pattern in `packages/core/src/assertions/` and register in `assertions/registry.ts`.

## Questions & Discussion

We use [GitHub Discussions](https://github.com/petrkindlmann/kindlm/discussions) for Q&A, feature ideas, and general conversation. Open a discussion before filing an issue if you're unsure whether something is a bug.

## Reporting Issues

Open a [GitHub Issue](https://github.com/petrkindlmann/kindlm/issues) and include:

- KindLM version (`kindlm --version`)
- Node.js version (`node --version`)
- Minimal reproduction (config file + command run)
- Full error output (include stack trace if present)
