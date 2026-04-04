---
phase: 8
slug: worktree-file-copy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test -- --exclude ".claude/**" packages/cli/src/utils/worktree.test.ts` |
| **Full suite command** | `npm run test -- --exclude ".claude/**"` |
| **Estimated runtime** | ~10 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --exclude ".claude/**" packages/cli/src/utils/worktree.test.ts`
- **After every plan wave:** Run `npm run test -- --exclude ".claude/**" && npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | ISOLATE-01 | unit | `npm run test -- --exclude ".claude/**" packages/cli/src/utils/worktree.test.ts` | ✅ | ⬜ pending |
| 8-01-02 | 01 | 1 | ISOLATE-01 | integration | `npm run test -- --exclude ".claude/**" && npm run typecheck` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — worktree.test.ts can be created alongside worktree.ts additions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end --isolate with schemaFile copy | ISOLATE-01 | Requires real git worktree + real kindlm.yaml config | Run `kindlm test --isolate` with a config that has `format: json` + `schemaFile: schemas/test.json`; verify test passes in isolation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
