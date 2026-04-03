---
phase: 17-github-action
plan: 02
subsystem: infra
tags: [github-actions, typescript, junit-xml, pr-comments, @actions/artifact, @actions/github, vitest]

requires:
  - packages/action/src/run.ts (from 17-01)
  - packages/action/src/types.ts (KindlmJsonReport interface)
provides:
  - packages/action/src/comment.ts: buildCommentBody + upsertPrComment with marker-based dedup
  - packages/action/src/junit.ts: generateJunitXml + uploadJunitArtifact via DefaultArtifactClient
  - packages/action/src/comment.test.ts: 14 tests covering security, marker, fork PR handling
  - packages/action/src/junit.test.ts: 13 tests covering XML structure, escaping, no response_text
  - packages/action/src/index.test.ts: 7 tests covering parseJsonReport and run() outputs
  - packages/action/vitest.config.ts: test globals config
  - packages/action/dist/index.js: ncc-bundled action entry point
affects: []

tech-stack:
  added:
    - "vitest (test runner — already in devDependencies, now configured)"
  patterns:
    - "JUnit XML built via string concatenation — no XML library needed for simple structure"
    - "XML escaping via escapeXml() helper — &, <, >, \", ' replaced with entities"
    - "PR comment dedup via hidden marker <!-- kindlm-test-results --> in comment body"
    - "Non-fatal pattern: try/catch + core.warning() for artifact upload and PR comment"
    - "ncc build excludes test files via tsconfig.json exclude: [src/**/*.test.ts]"

key-files:
  created:
    - packages/action/src/comment.ts
    - packages/action/src/junit.ts
    - packages/action/src/comment.test.ts
    - packages/action/src/index.test.ts
    - packages/action/src/junit.test.ts
    - packages/action/vitest.config.ts
  modified:
    - packages/action/src/run.ts
    - packages/action/tsconfig.json

key-decisions:
  - "Exclude *.test.ts from tsconfig.json to fix ncc build — ncc compiles all included files, not just entry point imports"
  - "JUnit XML generated inside action from JSON report (not via second CLI invocation) — consistent with 17-01 single-reporter decision"
  - "buildCommentBody only accesses test.name, test.status, assertion.label, assertion.failureMessage — never iterates arbitrary fields"
  - "upsertPrComment body parameter includes the MARKER — caller is responsible for wrapping body via buildCommentBody"

requirements-completed: [ACTION-04, ACTION-05, ACTION-08]

duration: 6min
completed: 2026-04-03
---

# Phase 17 Plan 02: PR Comment, JUnit XML, and Unit Tests Summary

**PR comment upsert with marker-based dedup, JUnit XML generation with artifact upload, and 34 unit tests covering all modules — ncc builds dist/index.js cleanly**

## Performance

- **Duration:** 6 min
- **Completed:** 2026-04-03
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Created `comment.ts`: builds markdown PR comment in D-16 format, upserts via `<!-- kindlm-test-results -->` marker, handles fork 403 non-fatally
- Created `junit.ts`: generates JUnit XML with XML-escaping, uploads via `DefaultArtifactClient` (non-fatal)
- Wired both into `run.ts` replacing `// TODO(plan-02)` placeholders
- 34 unit tests pass across all three test files
- `dist/index.js` builds cleanly via ncc after excluding test files from tsconfig

## Task Commits

1. **Task 1: PR comment, JUnit XML, tests, ncc build** - `71b44a1` (feat)

## Files Created/Modified

- `packages/action/src/comment.ts` — buildCommentBody (D-16 format) + upsertPrComment (marker dedup, fork-safe)
- `packages/action/src/junit.ts` — generateJunitXml (XML-escaped, no response_text) + uploadJunitArtifact (DefaultArtifactClient)
- `packages/action/src/run.ts` — imports and calls comment + junit modules
- `packages/action/src/comment.test.ts` — 14 tests: marker, table, security (no response_text), fork 403 handling
- `packages/action/src/junit.test.ts` — 13 tests: XML structure, escaping, no response_text, artifact upload
- `packages/action/src/index.test.ts` — 7 tests: parseJsonReport, run() outputs, cloud upload non-fatal
- `packages/action/vitest.config.ts` — test globals config
- `packages/action/tsconfig.json` — added `src/**/*.test.ts` to exclude

## Decisions Made

- **tsconfig exclude for ncc:** ncc builds all TypeScript files in the tsconfig `include` list (not just entry point imports). Test files had type errors incompatible with ncc's strict compilation. Fixed by adding `src/**/*.test.ts` to `exclude`.
- **buildCommentBody whitelist:** Only accesses named fields (`test.name`, `test.status`, `assertion.label`, `assertion.failureMessage`) — never iterates assertion objects arbitrarily to avoid accidentally including future fields with response text.
- **JUnit via JSON conversion:** Consistent with Plan 01 decision — no second CLI invocation. The parsed JSON report is sufficient to produce valid JUnit XML for all CI systems.

## Deviations from Plan

**1. [Rule 1 - Bug] Exclude test files from tsconfig.json for ncc build**
- **Found during:** Task 1 — ncc build step
- **Issue:** ncc compiled all files in `src/**/*.ts` including `*.test.ts`. Test files used explicit tuple type annotations in callbacks (e.g., `(c: [string, string]) => ...`) that ncc's TypeScript rejected with TS2345/TS2769 when assigning to `any[][]` typed mock call arrays.
- **Fix:** Added `src/**/*.test.ts` to `tsconfig.json` `exclude` array. ncc now only compiles production source files.
- **Files modified:** packages/action/tsconfig.json
- **Commit:** 71b44a1

None of these deviations changed behavior — tests still run via vitest (which uses its own module resolution, not tsconfig exclude).

## Known Stubs

None — all features are fully wired. The `dist/index.js` is production-ready.

## Self-Check: PASSED

- FOUND: packages/action/src/comment.ts
- FOUND: packages/action/src/junit.ts
- FOUND: packages/action/src/comment.test.ts
- FOUND: packages/action/src/junit.test.ts
- FOUND: packages/action/src/index.test.ts
- FOUND: packages/action/vitest.config.ts
- FOUND: packages/action/dist/index.js
- FOUND commit: 71b44a1

---
*Phase: 17-github-action*
*Completed: 2026-04-03*
