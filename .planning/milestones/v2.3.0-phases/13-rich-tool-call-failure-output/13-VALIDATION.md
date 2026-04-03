---
phase: 13
slug: rich-tool-call-failure-output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run packages/core/src/assertions/tool-calls.test.ts packages/core/src/reporters/pretty.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | TCOUT-01 | unit | `npx vitest run packages/core/src/assertions/tool-calls.test.ts` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | TCOUT-02 | unit | `npx vitest run packages/core/src/assertions/tool-calls.test.ts` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | TCOUT-03 | unit | `npx vitest run packages/core/src/assertions/tool-calls.test.ts` | ✅ | ⬜ pending |
| 13-01-04 | 01 | 1 | TCOUT-04 | unit | `npx vitest run packages/core/src/reporters/pretty.test.ts` | ✅ | ⬜ pending |
| 13-01-05 | 01 | 1 | TCOUT-05 | unit | `npx vitest run packages/core/src/reporters/pretty.test.ts` | ✅ | ⬜ pending |
| 13-01-06 | 01 | 1 | TCOUT-06 | unit | `npx vitest run packages/core/src/reporters/pretty.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Both `tool-calls.test.ts` and `pretty.test.ts` exist.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
