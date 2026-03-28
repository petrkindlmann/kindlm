---
id: "04-01"
title: "Version Bump + Release Workflow"
status: complete
completed_at: "2026-03-28"
---

# 04-01 Summary: Version Bump + Release Workflow

## What Was Done

Three file changes committed atomically as `chore: add v1.0.0 changeset and enable npm provenance`:

1. **Created `.changeset/stable-release.md`** — Major bump changeset for both `@kindlm/core` and `@kindlm/cli`. When `changeset version` runs (triggered by merging the Version Packages PR), both packages will advance from their current 0.x versions to 1.0.0.

2. **Added `id-token: write` to `.github/workflows/release.yml` permissions block** — Required for npm provenance OIDC token acquisition during publish.

3. **Added `NPM_CONFIG_PROVENANCE: "true"` to the publish step env block** — Enables npm attestation so the published packages show provenance on npmjs.com.

## Files Changed

- `.changeset/stable-release.md` (created)
- `.github/workflows/release.yml` (modified — permissions + env)

## Next Steps (Manual)

- Task 5 is manual: once the CI-created "Version Packages" PR appears on GitHub, review that both packages show `1.0.0` in the diff, then merge it. After merge, `changesets/action` runs again and publishes to npm.
- Before merging: verify `NPM_TOKEN` secret is set in GitHub repo Settings → Secrets → Actions with publish permissions for the `@kindlm` npm org scope.

## Verification Commands

```bash
ls .changeset/stable-release.md
grep -n "id-token" .github/workflows/release.yml
grep -n "NPM_CONFIG_PROVENANCE" .github/workflows/release.yml
```
