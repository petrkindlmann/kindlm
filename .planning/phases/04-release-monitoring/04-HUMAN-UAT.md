---
status: partial
phase: 04-release-monitoring
source: [04-VERIFICATION.md]
started: 2026-03-28T07:00:00Z
updated: 2026-03-28T07:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. REL-01: Merge Version Packages PR to trigger npm publish
expected: `npx @kindlm/cli@latest --version` returns `1.0.0`; `@kindlm/core` also at `1.0.0`; both published with provenance attestation visible on npmjs.com
result: [pending]

Steps:
1. Push main to remote: `git push origin main`
2. GitHub Actions `release.yml` runs — changesets/action opens a "Version Packages" PR bumping both packages to 1.0.0
3. Review the PR — confirm both packages show `1.0.0` in the diff
4. Verify `NPM_TOKEN` secret is set in GitHub Settings → Secrets → Actions with @kindlm publish scope
5. Merge the PR
6. `release.yml` runs again — publishes @kindlm/core@1.0.0 and @kindlm/cli@1.0.0 with npm provenance
7. Verify: `npm view @kindlm/core version` and `npm view @kindlm/cli version` both return `1.0.0`

### 2. REL-02/REL-03: Confirm npm provenance + GitHub Release
expected: npm provenance badge visible on npmjs.com; GitHub Release exists with changelog
result: [pending]

Steps:
1. Visit https://www.npmjs.com/package/@kindlm/core — check for provenance attestation
2. Visit https://github.com/petrkindlmann/kindlm/releases — confirm release tagged at `@kindlm/core@1.0.0` with changelog

### 3. MON-02: Configure UptimeRobot monitoring
expected: api.kindlm.com/health monitored every 5 minutes with email alerts
result: [pending]

Steps (see monitoring-setup.md for full details):
1. Go to https://uptimerobot.com and sign up or log in
2. Add New Monitor → HTTP(s), URL: `https://api.kindlm.com/health`, interval: 5 min
3. Enable keyword monitoring for `"status":"ok"`
4. Add email alert contact
5. Confirm green status badge appears within 5 minutes

### 4. E2E: Full CLI flow with published 1.0.0
expected: init/test/upload flow works end-to-end with published CLI
result: [pending]

Steps:
1. `npm install -g @kindlm/cli@1.0.0`
2. `kindlm --version` → should show `1.0.0`
3. `kindlm init` → creates kindlm.yaml
4. `kindlm test` → runs tests
5. `kindlm upload` → uploads results to Cloud
6. Navigate to dashboard → confirm results visible

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
