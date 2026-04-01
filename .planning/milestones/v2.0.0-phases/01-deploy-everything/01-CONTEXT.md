# Phase 1: Deploy Everything - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Deploy all KindLM v2.0.0 changes to production: fix the duplicate migration, push code, run D1 migrations, deploy the Cloud Worker, and publish v2.0.0 to npm.

Three items are manual and require Petr's credentials:
- OPS-06: Set SENTRY_DSN Worker secret (needs Sentry project DSN)
- OPS-07: Publish VS Code extension (needs VS Code PAT)
- OPS-08: Create Stripe production products (needs Stripe dashboard access)

Plans should handle OPS-01 through OPS-05 automatically and produce clear instructions for OPS-06 through OPS-08 as manual steps.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/ops phase. OPS-01 through OPS-05 can be executed automatically. OPS-06, OPS-07, and OPS-08 require manual steps and should be documented as clear instructions for the user.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/vscode/` — VS Code extension with modified files (README, package.json, schema, snippets, completions, hover) ready to package
- `packages/cloud/` — Cloud Worker with migrations in `migrations/` directory
- Wrangler config in `packages/cloud/wrangler.toml`

### Established Patterns
- D1 migrations: `npx wrangler d1 migrations apply kindlm-prod --remote`
- Worker deploy: `npx wrangler deploy`
- npm publish: managed via Changesets (Version Packages PR already open)
- VS Code package: `vsce package && vsce publish`

### Integration Points
- D1 migrations must run AFTER code is deployed (new migration files need to be in the Worker)
- Version Packages PR must be merged to trigger npm publish via GitHub Actions
- SENTRY_DSN must be set as a Worker secret before Sentry monitoring activates

</code_context>

<specifics>
## Specific Ideas

- OPS-01: Migration 0011 was renumbered to 0013 (already fixed per git history commit cd7f3cc)
- OPS-02: 28 commits waiting to be pushed to remote (main branch)
- OPS-05: Merge the Version Packages PR after push — GitHub Actions will publish to npm

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
