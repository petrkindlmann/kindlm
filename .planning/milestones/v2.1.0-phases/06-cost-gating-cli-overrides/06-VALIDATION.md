---
phase: 6
slug: cost-gating-cli-overrides
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run packages/cli/src/utils/run-tests.test.ts` |
| **Full suite command** | `npx vitest run packages/cli/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run packages/cli/src/utils/run-tests.test.ts`
- **After every plan wave:** Run `npx vitest run packages/cli/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | COST-01 | unit | `npx vitest run packages/cli/src/utils/run-tests.test.ts` | ✅ | ⬜ pending |
| 6-01-02 | 01 | 1 | CLI-01 | unit | `npx vitest run packages/cli/src/utils/run-tests.test.ts` | ✅ | ⬜ pending |
| 6-01-03 | 01 | 1 | CLI-02 | unit | `npx vitest run packages/cli/src/utils/run-tests.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Tests go in existing `run-tests.test.ts` — no new files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `--timeout` help text reads "does not affect provider HTTP timeout" | CLI-02 | Help text not captured by unit tests | Run `kindlm test --help`, verify timeout description |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
