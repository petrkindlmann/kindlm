# Known Security Advisories — Accepted Exceptions

This file tracks Dependabot / `npm audit` findings that are **knowingly accepted**
(not silently ignored), with the rationale and the condition under which they can
be cleared. Reviewed: 2026-06-02.

## Accepted (2 moderate)

### postcss `<8.5.10` — XSS via unescaped `</style>` in CSS Stringify Output
- **Advisory:** GHSA-qx2v-qp2m-jg93 (moderate)
- **Path:** `next` → bundled `postcss@8.4.31` (in `packages/dashboard` and `site`)
- **Why accepted, not fixed:**
  - The vulnerable `postcss` is bundled *inside* Next.js as a pinned dependency,
    not a direct dependency we control.
  - **Every stable Next release — including the latest `16.2.7` — still bundles
    `postcss@8.4.31`.** The advisory's fixed range (`< 16.3.0-canary.5`) means a
    patched `postcss` only ships in a Next **canary/pre-release** (`16.3.0-canary.x`
    bundles `8.5.10`).
  - `npm audit fix --force` would install `next@9.3.3` — a destructive multi-major
    **downgrade** that would break the dashboard and site.
  - The advisory is build/dev-tooling only (CSS stringify) and is **not present in
    any published `@kindlm` package** (`@kindlm/cli`, `@kindlm/core`, `kindlm`).
  - `npm audit` is not run in CI, so this gates nothing.
- **Clear when:** a **stable** Next release bundles `postcss >= 8.5.10`. At that
  point bump `next` in `packages/dashboard` and `site` and re-run `npm audit`.

## How to re-check

```bash
npm audit                              # should show only the items above
npm view next@latest dependencies.postcss   # clear the exception once this is >= 8.5.10
```

All other Dependabot findings were remediated in the 2026-06-02 audit pass
(PR #16): direct bumps of next/hono/fast-xml-parser/postcss/turbo and transitive
fixes for vite/uuid/qs/tmp/fast-uri/ws via `npm audit fix`, plus `vitest` 3→4.
