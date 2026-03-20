# Deployment

This document covers secrets, infrastructure, and deployment configuration for KindLM.

## GitHub Actions Secrets

The following secrets must be configured in the GitHub repository settings under **Settings > Secrets and variables > Actions**.

| Secret | Used by | Description |
|--------|---------|-------------|
| `CF_API_TOKEN` | `deploy-cloud.yml`, `deploy-dashboard.yml`, `deploy-site.yml` | Cloudflare API token with Workers and Pages deploy permissions |
| `NPM_TOKEN` | `release.yml` | npm publish token for `@kindlm/core` and `@kindlm/cli` packages |

## Cloudflare Workers Secrets

These secrets are set on the Workers runtime via `npx wrangler secret put <NAME>` and are available as environment bindings at runtime in `packages/cloud/`.

| Secret | Description |
|--------|-------------|
| `GITHUB_CLIENT_ID` | OAuth App client ID for GitHub login flow |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret for GitHub login flow |
| `SIGNING_KEY_SECRET` | HMAC key used to sign JWT auth tokens and compliance report hashes |
| `STRIPE_SECRET_KEY` | Stripe API secret key for billing (team/enterprise plans) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret for verifying incoming webhook events |

## D1 Databases

KindLM Cloud uses Cloudflare D1 (SQLite) for persistent storage.

| Environment | Database Name | Database ID |
|-------------|--------------|-------------|
| Production | `kindlm-prod` | Set after `npx wrangler d1 create kindlm-prod` |
| Staging | `kindlm-staging` | Set after `npx wrangler d1 create kindlm-staging` |

**Note:** After creating each database, copy the `database_id` from the output into the corresponding `wrangler.jsonc` configuration under `d1_databases`.

## Deployment Targets

### Cloud API (`packages/cloud/`)

Deployed as a Cloudflare Worker via `deploy-cloud.yml` on pushes to `main` that touch `packages/cloud/**`.

```bash
# Manual deploy
cd packages/cloud && npx wrangler deploy
```

### Dashboard (`packages/dashboard/`)

Deployed to Cloudflare Pages via `deploy-dashboard.yml` on pushes to `main` that touch `packages/dashboard/**`.

```bash
# Manual deploy
npx turbo run build --filter=@kindlm/dashboard
npx wrangler pages deploy packages/dashboard/.next --project-name=kindlm-dashboard
```

### Marketing Site (`site/`)

Deployed to Cloudflare Pages via `deploy-site.yml` on pushes to `main` that touch `site/**`.

```bash
# Manual deploy
cd site && npm run build
npx wrangler pages deploy .next --project-name=kindlm-site
```

### npm Packages (`@kindlm/core`, `@kindlm/cli`)

Published via `release.yml` using Changesets. Requires `NPM_TOKEN`.
