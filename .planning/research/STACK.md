# Technology Stack — KindLM v2.3.0 Developer Experience & Depth

**Researched:** 2026-04-02
**Confidence:** HIGH

---

## New Dependencies Needed

### 1. File Watching — `chokidar` v4.x

**Why:** Node.js `fs.watch` is unreliable across platforms (missing events on macOS, no recursive on older Linux). chokidar handles debouncing, atomic writes, and cross-platform edge cases.

**Why this over alternatives:**
- `fs.watch` — too unreliable for production watch mode
- `watchpack` (webpack's watcher) — heavier, designed for bundler use
- `parcel-watcher` — C++ binding, heavier install, overkill for watching 1-2 YAML files

**Bundle impact:** ~30KB minified. CLI-only dependency (not in core).
**Version:** chokidar 4.x (pure ESM, Node 20+ compatible)

### 2. Dashboard Charts — `recharts` v2.x

**Why:** Built on React/D3, works with shadcn/ui ecosystem. SSR-safe with `dynamic(() => import(), { ssr: false })`.

**Why this over alternatives:**
- `chart.js` + `react-chartjs-2` — more config, less React-native API
- `visx` — too low-level for dashboard time-series
- `nivo` — heavy bundle, server-rendering issues
- `tremor` — good option but adds another component library alongside shadcn

**Bundle impact:** ~200KB (tree-shakeable). Dashboard-only dependency.
**Version:** recharts 2.15.x (latest stable)

### 3. GitHub Action Bundling — `@vercel/ncc`

**Why:** Bundles Node.js action into single `dist/index.js` with all deps. GitHub's official recommendation for JS actions.

**Why this over alternatives:**
- `esbuild` — works but needs more config for action bundling (externals, platform)
- Docker action — fails on macOS/Windows runners

**Bundle impact:** Dev dependency only (action repo, not main monorepo).

### 4. No New Core Dependencies

All 6 features can be implemented without adding dependencies to `@kindlm/core`:
- Multi-turn: pure TypeScript state machine
- Response caching: core defines interface, CLI implements with `node:fs` + `node:crypto`
- Rich failure output: extends existing `Colorize` injection pattern
- Cache key: `node:crypto` SHA-256 (already available pattern from compliance hash)

---

## Existing Stack (Sufficient)

| Feature | Existing Stack | Notes |
|---------|---------------|-------|
| Multi-turn conversation | `conversation.ts`, `ProviderAdapter` | Extend, don't rewrite |
| Cache key hashing | `node:crypto` (SHA-256) | Same pattern as compliance hash |
| Cache storage | `node:fs/promises` | CLI-only, `.kindlm/cache/` dir |
| Watch debouncing | chokidar `awaitWriteFinish` | Better than manual setTimeout |
| GitHub Action | `@actions/core`, `@actions/exec` | GitHub's official action toolkit |
| Dashboard API | Hono routes + D1 queries | Add new endpoints to existing cloud |
| Dashboard UI | Next.js + shadcn/ui + Tailwind | Add recharts for charts |
| Rich output formatting | chalk + `Colorize` interface | Extend existing reporter pattern |

---

## Summary

| Feature | New Package | Where |
|---------|-------------|-------|
| Watch mode | chokidar 4.x | CLI |
| Dashboard charts | recharts 2.15.x | Dashboard |
| GitHub Action | @vercel/ncc, @actions/core | Action repo |
| Multi-turn testing | None | Core |
| Response caching | None | Core (interface) + CLI (impl) |
| Rich failure output | None | Core + CLI |

Total new runtime deps: 2 (chokidar in CLI, recharts in dashboard)
