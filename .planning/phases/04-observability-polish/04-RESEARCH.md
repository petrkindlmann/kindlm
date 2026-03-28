# Phase 4: Observability & Polish — Research

**Date:** 2026-03-28

## INFRA-04: Sentry Error Tracking for Workers

**Cloudflare Workers + Sentry:** Use `@sentry/cloudflare` (official package for Workers). Wraps the Worker export with `Sentry.withSentry()`. Source maps uploaded via `sentry-cli` in CI.

**Setup:**
1. Add `@sentry/cloudflare` to packages/cloud dependencies
2. Wrap the Hono app export in `index.ts` with `Sentry.withSentry()`
3. Add `SENTRY_DSN` as a Worker secret
4. Add source map upload to deploy-cloud.yml workflow

**Key files:** packages/cloud/src/index.ts, packages/cloud/package.json, .github/workflows/deploy-cloud.yml

## v2.0.0 Release

Same changeset flow as v1.0.0:
1. Create `.changeset/v2-release.md` with major bumps
2. NPM_CONFIG_PROVENANCE already enabled in release.yml
3. Push → Version Packages PR → merge → publish
