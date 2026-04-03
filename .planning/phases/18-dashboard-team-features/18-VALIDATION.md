---
phase: 18
slug: dashboard-team-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=verbose packages/cloud/src/routes packages/dashboard` |
| **Full suite command** | `npm run test && npm run typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose packages/cloud/src/routes packages/dashboard`
- **After every plan wave:** Run `npm run test && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | DASH-09 | unit | `npx vitest run packages/cloud/src/routes/trends.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | DASH-10 | unit | `npx vitest run packages/cloud/src/routes/run-compare.test.ts` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 2 | DASH-01, DASH-02 | typecheck | `npx tsc --noEmit -p packages/dashboard` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 2 | DASH-03, DASH-04 | typecheck | `npx tsc --noEmit -p packages/dashboard` | ✅ | ⬜ pending |
| 18-02-03 | 02 | 2 | DASH-05 | typecheck | `npx tsc --noEmit -p packages/dashboard` | ✅ | ⬜ pending |
| 18-02-04 | 02 | 2 | DASH-06 | typecheck | `npx tsc --noEmit -p packages/dashboard` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/cloud/src/routes/trends.test.ts` — stubs for DASH-09
- [ ] `packages/cloud/src/routes/run-compare.test.ts` — stubs for DASH-10
- [ ] `npm install recharts` in `packages/dashboard` — chart library required by DASH-03

*Existing Vitest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trend chart renders correctly | DASH-03, DASH-04 | Visual rendering cannot be unit tested | Open /projects/:id/runs, verify dual-axis line chart renders |
| SSR-safe chart loading | DASH-07 | Requires actual Next.js build to verify | Run `npm run build` in dashboard package, verify no SSR errors |
| Timezone-correct date bucketing | DASH-08 | Timezone behavior varies by runtime | Check chart x-axis labels match user's local timezone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
