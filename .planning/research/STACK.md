# Stack Research: Shipping KindLM v1.0

> Research date: 2026-03-27
> Scope: Release tooling, CLI distribution, cloud deploy verification, competitor analysis

---

## 1. Release Tooling

### Decision: Keep Changesets (already configured)

**What KindLM already has:** `@changesets/cli ^2.27.0` with `changesets/action@v1` in `.github/workflows/release.yml`. Linked packages (`@kindlm/core` + `@kindlm/cli`), `@kindlm/cloud` excluded from npm publish. This is correct.

**What competitors use:**

| Tool | Used by | Model |
|------|---------|-------|
| **Changesets** | KindLM (current), many monorepos | PR-based version bumps, manual changeset files |
| **release-please** | promptfoo (v0.121.3, 399 releases) | Conventional Commits → auto-PR with changelog |
| **Manual `npm version` + gh pr** | promptfoo (also, dual approach) | `preversion`/`postversion` npm scripts, manual branch + PR |
| **Manual workflow_dispatch** | Braintrust SDK | Manual trigger, environment approval gates, stable/prerelease/canary channels |
| **Fern (auto-generated SDK)** | Humanloop | Generated client code, automated publish |

**Recommendation: Stay with Changesets.** Rationale:
- Already configured and working for your monorepo shape
- `linked` config correctly ties `@kindlm/core` and `@kindlm/cli` versions
- `changesets/action@v1` handles the PR-based flow with zero custom scripts
- Switching to release-please would require migrating to Conventional Commits and rewriting workflow
- Braintrust's manual workflow_dispatch approach is better for large teams but overkill for solo/small team

**What to add for v1.0:**

1. **GitHub Release creation.** Add `createGithubReleases: true` to `.changeset/config.json` (or configure in the action). This creates GitHub Releases with changelogs automatically.
2. **Pre-release channel for testing.** Before cutting 1.0, use `npx changeset pre enter rc` to publish `1.0.0-rc.0`, `1.0.0-rc.1`, etc. Test in real CI pipelines before promoting to stable.
3. **npm provenance.** Add `--provenance` flag to the publish step. This generates SLSA provenance attestations on npmjs.com (builds trust, shows package was published from CI).

```yaml
# In release.yml, update the publish step:
- name: Create Release PR or Publish
  uses: changesets/action@v1
  with:
    publish: npx changeset publish
    title: "Version Packages"
    commit: "chore: version packages"
    createGithubReleases: true  # <-- ADD
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    NPM_CONFIG_PROVENANCE: true  # <-- ADD (requires id-token: write permission)
```

Add to the job permissions:
```yaml
permissions:
  contents: write
  pull-requests: write
  id-token: write  # <-- ADD for npm provenance
```

### What NOT to use

- **semantic-release**: Requires Conventional Commits, auto-bumps versions based on commit messages. Poor fit for monorepos without `semantic-release-monorepo` plugin, which adds complexity. Changesets gives you explicit control over what's a patch vs minor vs major.
- **Lerna publish**: Legacy. Lerna itself recommends Nx now. Don't introduce it.
- **np**: Single-package publisher. Not monorepo-aware.

---

## 2. CLI Distribution

### Current state

- `npx @kindlm/cli` works (bin field: `"kindlm": "./dist/kindlm.js"`)
- `npm install -g @kindlm/cli` works
- No Homebrew formula

### Distribution channels (ordered by priority)

#### Tier 1: npx (already works, primary channel)

```bash
npx @kindlm/cli@latest init
npx @kindlm/cli@latest test
```

This is the correct primary channel. promptfoo, Braintrust, and every modern CLI tool lead with `npx`. Zero-install trial is the killer feature.

**Action item:** Ensure the `kindlm` bin name doesn't collide. Check: `npm info kindlm` -- if the name is available, consider also publishing a `kindlm` package that re-exports `@kindlm/cli` so users can run `npx kindlm` (shorter).

#### Tier 2: Global npm install

```bash
npm install -g @kindlm/cli
kindlm test
```

Already works. This is what power users and CI environments use. Nothing to change.

#### Tier 3: Homebrew (defer to post-v1.0)

**How promptfoo does it:** They're in Homebrew core (`brew install promptfoo`), not a custom tap. This means a Formula PR was submitted to `Homebrew/homebrew-core` and accepted. Their formula depends on `node` and installs via `npm install`.

**Stats:** ~440 installs/month via Homebrew (vs presumably 10-100x that via npm). This is a minority channel.

**Recommendation: Skip Homebrew for v1.0.** Reasons:
- Homebrew core requires meaningful adoption before they'll accept a formula
- Maintaining a custom tap (`homebrew-kindlm`) is busywork for low usage
- `npx` already provides zero-install experience
- Focus engineering time on getting the CLI + Cloud working E2E

**When to add Homebrew:** After v1.0 has >500 weekly npm downloads, submit a formula to Homebrew core. Template:

```ruby
class Kindlm < Formula
  desc "Behavioral regression testing for AI agents"
  homepage "https://kindlm.com"
  url "https://registry.npmjs.org/@kindlm/cli/-/cli-#{version}.tgz"
  license "MIT"
  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/kindlm --version")
  end
end
```

#### What NOT to use for distribution

- **pkg / nexe / bun compile**: Native binaries from Node.js. Adds massive CI complexity (cross-compile for linux-x64, linux-arm64, darwin-x64, darwin-arm64, win-x64). Not worth it until you have a significant Windows user base that doesn't have Node.js.
- **Docker image**: Your CLI runs in the user's project directory with their API keys. Docker adds friction. Skip it.
- **pip install**: promptfoo does this via a Python wrapper that downloads the Node binary. Clever but niche. Not worth the maintenance.
- **Snap/Flatpak**: Linux desktop packaging. Wrong audience.

---

## 3. Cloud Deployment Verification

### Current state

Your `deploy-cloud.yml` already has the right shape:
1. Test -> Deploy staging -> Smoke test -> Deploy production

This is the correct 4-stage pattern. But the smoke tests are minimal (health check + 401 check). Here's what to add:

### Health check endpoint (expand)

Current `/health` just returns 200. Add structured health response:

```typescript
// In packages/cloud/src/routes/health.ts
app.get('/health', async (c) => {
  const checks = {
    status: 'ok',
    version: VERSION, // from package.json or env
    timestamp: new Date().toISOString(),
    checks: {
      d1: await checkD1(c.env.DB),
    }
  };
  const allOk = Object.values(checks.checks).every(c => c === 'ok');
  return c.json(checks, allOk ? 200 : 503);
});
```

### Smoke tests (expand in deploy-cloud.yml)

```yaml
smoke-test:
  needs: deploy-staging
  runs-on: ubuntu-latest
  steps:
    - name: Health check (structured)
      run: |
        RESPONSE=$(curl -sf https://staging-api.kindlm.com/health)
        echo "$RESPONSE"
        STATUS=$(echo "$RESPONSE" | jq -r '.status')
        if [ "$STATUS" != "ok" ]; then
          echo "Health check returned status: $STATUS"
          exit 1
        fi

    - name: Auth check (expect 401 without token)
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging-api.kindlm.com/v1/auth/tokens)
        [ "$STATUS" = "401" ] || (echo "Expected 401, got $STATUS" && exit 1)

    - name: Upload endpoint accepts POST shape
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
          -X POST https://staging-api.kindlm.com/v1/projects/test/runs \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer invalid-token" \
          -d '{}')
        # Should get 401 (bad token), not 404 (route missing) or 500 (crash)
        [ "$STATUS" = "401" ] || (echo "Expected 401, got $STATUS" && exit 1)

    - name: CORS headers present
      run: |
        HEADERS=$(curl -sI -X OPTIONS https://staging-api.kindlm.com/v1/auth/tokens \
          -H "Origin: https://app.kindlm.com" \
          -H "Access-Control-Request-Method: GET")
        echo "$HEADERS"
        echo "$HEADERS" | grep -qi "access-control-allow-origin" || \
          (echo "Missing CORS headers" && exit 1)

    - name: Version matches expected
      run: |
        VERSION=$(curl -sf https://staging-api.kindlm.com/health | jq -r '.version')
        echo "Deployed version: $VERSION"
        # Just log it — useful for debugging deploy issues
```

### Monitoring (Cloudflare-native)

Cloudflare Workers has built-in observability. Use what's free before adding external tools:

| Capability | Tool | Cost | Action |
|-----------|------|------|--------|
| **Request logs** | Workers Logs (dashboard) | Free (included) | Enable in CF dashboard |
| **Real-time debugging** | `wrangler tail` | Free | Use during debugging |
| **Error alerting** | Cloudflare Notifications | Free | Configure email alert for error rate >1% |
| **Uptime monitoring** | Cloudflare Health Checks | Free (up to 5) | Add for `api.kindlm.com/health` |
| **Structured logging** | Workers Logs + Query Builder | Free | Already available in dashboard |
| **OpenTelemetry export** | Workers OTel binding | Free (export) | Defer — only if you need Grafana/Datadog |

**Recommendation:** For v1.0, use Cloudflare's built-in monitoring + a free Uptime Robot monitor as external verification. Add OTel export to Grafana Cloud (free tier: 50GB logs/month) only if you need cross-service tracing.

### What NOT to use for monitoring

- **Sentry for Workers**: Possible via their Cloudflare integration, but adds a dependency and most of its value (stack traces, sessions) is for frontend. Workers errors are simpler — use CF's native logging.
- **Datadog/New Relic**: Enterprise pricing, wrong scale for v1.0.
- **Self-hosted Prometheus/Grafana**: You're on serverless. No servers to scrape. Wrong model.
- **PagerDuty**: You're a solo developer. Cloudflare email alerts are sufficient for v1.0.

---

## 4. Competitor Stack Analysis

### promptfoo (18.6k stars, 399 releases, 7,833 commits)

The closest competitor and the benchmark for what "mature" looks like in this space.

| Dimension | promptfoo | KindLM (current) | Gap |
|-----------|-----------|-------------------|-----|
| **Monorepo** | npm workspaces + pnpm-workspace.yaml (hybrid) | npm workspaces | None |
| **Build** | tsdown (esbuild-based, successor to tsup) | tsup | Minor — tsup is fine, tsdown is newer |
| **Lint** | Biome (replaced ESLint) | ESLint 9 flat config | Consider — Biome is faster but ESLint is fine |
| **Format** | Biome + Prettier (Biome for JS/TS, Prettier for CSS/MD/YAML) | Prettier | None |
| **Test** | Vitest | Vitest | None |
| **Release** | release-please + manual `npm version` scripts | Changesets | Different approach, both valid |
| **CI** | GitHub Actions, matrix: Node 20/22/24 + Ubuntu/macOS/Windows, sharded | GitHub Actions, matrix: Node 20/22 + Ubuntu/macOS/Windows | Add Node 24 when LTS |
| **Distribution** | npm, npx, brew (Homebrew core), pip | npm, npx | Add brew post-v1.0 |
| **Database** | Drizzle ORM (local SQLite + Postgres for cloud) | Raw D1 SQL | Consider Drizzle for type safety |
| **Frontend** | React app (bundled in CLI for `promptfoo view`) | Next.js dashboard (separate) | Different architecture |
| **Dep updates** | Renovate | None configured | Add Renovate or Dependabot |
| **Dead code** | Knip | None | Add Knip |

### Braintrust SDK (1,401 commits)

| Dimension | Braintrust | KindLM (current) | Gap |
|-----------|------------|-------------------|-----|
| **Monorepo** | pnpm workspaces + Turbo | npm workspaces + Turbo | None |
| **Build** | tsup | tsup | None |
| **Lint** | ESLint 9 | ESLint 9 | None |
| **Format** | Prettier | Prettier | None |
| **Release** | Manual workflow_dispatch with environment approval gates, canary/rc/stable channels | Changesets auto-PR | Braintrust is more sophisticated |
| **Pre-commit** | Husky + lint-staged | None | Add Husky + lint-staged |
| **Dead code** | Knip | None | Add Knip |

### Humanloop Node SDK (148 commits)

| Dimension | Humanloop |
|-----------|-----------|
| **SDK generation** | Fern (auto-generated from OpenAPI spec) |
| **Publish** | Automated via Fern workflow |

Not directly comparable — Humanloop auto-generates their SDK from an API spec. Different problem shape.

---

## 5. Prescriptive Recommendations for v1.0

### Must-do (before cutting 1.0.0)

| # | Action | Effort | Why |
|---|--------|--------|-----|
| 1 | Add `NPM_CONFIG_PROVENANCE: true` + `id-token: write` to release workflow | 5 min | Trust signal on npmjs.com, table stakes in 2025 |
| 2 | Expand smoke tests in `deploy-cloud.yml` (structured health, upload shape, CORS) | 30 min | Catch broken deploys before production |
| 3 | Add structured `/health` endpoint with D1 check + version | 15 min | Required for smoke tests above |
| 4 | Enable Cloudflare Health Check for `api.kindlm.com/health` | 5 min | Free uptime monitoring, email alerts |
| 5 | Run `npx changeset pre enter rc` and publish `1.0.0-rc.0` to npm | 10 min | Validate the full publish flow before going stable |
| 6 | Verify `npx @kindlm/cli@1.0.0-rc.0 init` works on clean machine | 10 min | Catch missing deps, bad bin path, etc. |
| 7 | Add Dependabot or Renovate for dependency updates | 10 min | promptfoo uses Renovate, Braintrust doesn't automate. Either works. |

### Should-do (v1.0 or shortly after)

| # | Action | Effort | Why |
|---|--------|--------|-----|
| 8 | Add Husky + lint-staged for pre-commit hooks | 15 min | Braintrust uses this, catches lint issues before CI |
| 9 | Add Knip for dead code detection | 15 min | Both promptfoo and Braintrust use it |
| 10 | Publish a `kindlm` convenience package (re-exports `@kindlm/cli`) | 15 min | `npx kindlm` is shorter than `npx @kindlm/cli` |
| 11 | Add production deploy smoke test for `api.kindlm.com` | 10 min | Currently only staging has smoke tests |
| 12 | Add Node 24 to CI matrix when it hits LTS | 5 min | promptfoo already tests 20/22/24 |

### Defer (post-v1.0)

| # | Action | When |
|---|--------|------|
| 13 | Homebrew core formula | After 500+ weekly npm downloads |
| 14 | OTel export to Grafana Cloud | When debugging requires cross-request tracing |
| 15 | Switch ESLint to Biome | Not urgent, ESLint 9 flat config is working |
| 16 | Canary/RC npm dist-tags for ongoing releases | When you have beta testers or enterprise customers |
| 17 | Drizzle ORM for D1 queries | When queries.ts refactor happens |

---

## 6. Version Matrix

These are the exact versions to pin or range for v1.0:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | `>=20.0.0` (engines) | Test 20 + 22 in CI. Add 24 when LTS. |
| TypeScript | `^5.7.0` | Current, fine |
| Turbo | `^2.3.0` | Current, fine. Braintrust is at `^2.5.6` but no breaking changes. |
| tsup | `^8.3.0` | Current, fine. Don't switch to tsdown yet — it's still pre-1.0. |
| Vitest | `^3.2.4` | Current, fine |
| ESLint | `^9.17.0` | Current, fine |
| Prettier | `^3.4.0` | Current, fine |
| Changesets | `^2.27.0` | Current, fine |
| Wrangler | Latest (npx) | Always use `npx wrangler` for CI, don't pin |
| Commander | `^13.0.0` | Current, fine |
| Zod | `^3.24.0` | Current, fine |
| Hono | Whatever cloud has | Check and ensure latest stable |

---

## 7. Summary

KindLM's stack is already well-aligned with the 2025 standard for TypeScript CLI tools with cloud backends. The main gaps are operational, not architectural:

1. **Release flow is correct** (Changesets) but needs provenance + GitHub Releases
2. **Distribution is correct** (npx first) but should add a convenience package
3. **Cloud deploy pipeline is correct** (staging -> smoke -> production) but smoke tests need depth
4. **Monitoring needs activation** — Cloudflare's free tools cover v1.0 needs

The biggest risk for v1.0 is not the stack — it's that the Cloud API is currently broken (per PROJECT.md). Fix the E2E flow first, then cut the release.
