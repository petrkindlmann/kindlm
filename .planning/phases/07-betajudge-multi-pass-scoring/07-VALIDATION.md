---
phase: 7
slug: betajudge-multi-pass-scoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test -- --reporter=verbose packages/core/src/assertions/judge.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- packages/core/src/assertions/judge.test.ts`
- **After every plan wave:** Run `npm run test && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | JUDGE-01 | unit | `npm run test -- packages/core/src/assertions/judge.test.ts` | ✅ | ⬜ pending |
| 7-01-02 | 01 | 1 | JUDGE-01 | unit | `npm run test -- packages/core/src/assertions/judge.test.ts` | ✅ | ⬜ pending |
| 7-01-03 | 01 | 2 | JUDGE-01 | integration | `npm run test && npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — judge.test.ts already exists and vitest is configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| betaJudge=false behavior unchanged | JUDGE-01 | Regression check that existing single-pass behavior is identical | Run `kindlm test` with a config that has judge assertions and `betaJudge` not set; verify output matches previous runs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
