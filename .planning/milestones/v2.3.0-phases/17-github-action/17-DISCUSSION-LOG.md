# Phase 17: GitHub Action - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-03
**Phase:** 17-github-action
**Areas discussed:** Repo structure, Input/output design, PR comment format, Security boundaries
**Mode:** Auto (--auto)

---

## Note: Greenfield — New Separate Repo

Unlike phases 13-16, there is no existing code to extend. The action lives in `kindlm/test-action`, a separate repository. All work is new.

---

| Area | Decision | Rationale |
|------|----------|-----------|
| Repo structure | Separate repo with dist/ checked in, node20 JS action | GitHub requirement for JS actions |
| Input/output | 6 inputs, 5 outputs | Standard action interface covering all use cases |
| PR comment | Markdown table + failing tests, update existing comment | Clean PR thread, no spam |
| Security | Never write model responses to summary/comments | Prevent API key/sensitive data leaks |

## Claude's Discretion

- npm install strategy (global vs npx vs tool-cache)
- working-directory input for monorepos
- Error handling for install failures

## Deferred Ideas

None.
