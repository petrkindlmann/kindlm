---
phase: 17-github-action
plan: 01
subsystem: infra
tags: [github-actions, typescript, ncc, @actions/core, @actions/exec, @actions/artifact, @actions/github]

requires: []
provides:
  - packages/action/ scaffolded as standalone GitHub Action package
  - action.yml with 6 inputs and 5 outputs, node20 runtime
  - src/types.ts with ActionInputs, KindlmJsonReport, ActionOutputs interfaces
  - src/run.ts: install CLI, run with --reporter json, parse JSON, set outputs, cloud upload (non-fatal)
  - src/index.ts: minimal entry point calling run()
affects: [17-02]

tech-stack:
  added:
    - "@actions/core ^3.0.0"
    - "@actions/exec ^3.0.0"
    - "@actions/artifact ^6.2.1"
    - "@actions/github ^9.0.0"
    - "@vercel/ncc ^0.38.4"
  patterns:
    - "GitHub Action as standalone package (not in workspace) — no root package.json workspace entry"
    - "ignoreReturnCode: true on getExecOutput for CLIs that exit 1 on expected failures"
    - "parseJsonReport() with first-{ fallback handles mixed CLI stdout gracefully"
    - "Cloud upload wrapped in try/catch AND ignoreReturnCode — double non-fatal guard"

key-files:
  created:
    - packages/action/action.yml
    - packages/action/package.json
    - packages/action/tsconfig.json
    - packages/action/src/types.ts
    - packages/action/src/run.ts
    - packages/action/src/index.ts
  modified: []

key-decisions:
  - "Run kindlm test with --reporter json only (not dual reporters) — CLI supports single --reporter flag per test run; JUnit generation deferred to plan-02 via JSON-to-JUnit conversion inside the action"
  - "parseJsonReport exported as separate function for unit testability"
  - "comment variable void-cast until plan-02 to suppress unused-var warning cleanly"
  - "Cloud upload: use exec env injection for KINDLM_API_TOKEN rather than process.env mutation"

patterns-established:
  - "Action entry point (index.ts) is one line: import { run } + run()"
  - "run() owns full try/catch — index.ts has no error handling"
  - "setOutput before setFailed so downstream steps can read outputs even when tests fail"

requirements-completed: [ACTION-01, ACTION-02, ACTION-03, ACTION-06, ACTION-07, ACTION-08]

duration: 8min
completed: 2026-04-03
---

# Phase 17 Plan 01: GitHub Action Scaffold Summary

**GitHub Action `kindlm/test@v2` scaffolded with action.yml (6 inputs, 5 outputs, node20), TypeScript source that installs @kindlm/cli, runs with JSON reporter, parses structured output, and uploads to Cloud non-fatally**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T05:57:19Z
- **Completed:** 2026-04-03T06:05:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Scaffolded `packages/action/` as a standalone package (not in monorepo workspace)
- Implemented full action flow: npm install CLI → kindlm test --reporter json → parse JSON → set outputs → optional cloud upload
- TypeScript compiles clean with strict mode and verbatimModuleSyntax

## Task Commits

1. **Task 1: Scaffold packages/action with package.json, tsconfig, action.yml, and types** - `0797856` (feat)
2. **Task 2: Implement src/run.ts (core logic) and src/index.ts (entry point)** - `66a8792` (feat)

## Files Created/Modified
- `packages/action/action.yml` - Action metadata: 6 inputs, 5 outputs, node20 runtime, branding
- `packages/action/package.json` - Standalone package with GitHub Actions SDK deps and @vercel/ncc
- `packages/action/tsconfig.json` - Strict TypeScript, ESNext modules, verbatimModuleSyntax
- `packages/action/src/types.ts` - ActionInputs, KindlmJsonReport (mirroring json reporter shape), ActionOutputs
- `packages/action/src/run.ts` - Core action logic with parseJsonReport export and cloud upload guard
- `packages/action/src/index.ts` - One-line entry point

## Decisions Made
- **Single reporter flag:** CLI supports only one `--reporter` at a time. Ran with `--reporter json` for structured output. JUnit generation will happen in plan-02 by converting parsed JSON inside the action itself (no second CLI invocation needed).
- **parseJsonReport as exported function:** Separated from run() to enable unit testing in plan-02 without mocking the entire exec layer.
- **Double non-fatal guard for cloud upload:** Both `ignoreReturnCode: true` on the exec call AND a try/catch wrapper. Belt-and-suspenders for D-22 (cloud upload must never fail CI).
- **KINDLM_API_TOKEN via exec env option:** Injected through the exec `env` option rather than mutating `process.env` directly, keeping the global environment clean.

## Deviations from Plan

**1. [Rule 1 - Bug] Single reporter constraint from IMPORTANT_FINDING honored**
- **Found during:** Task 2 implementation
- **Issue:** The plan's action flow (D-14) and research Pattern 3 assumed dual reporters (`--reporter json --reporter junit`), but the IMPORTANT_FINDING block in the plan explicitly states the CLI only supports a single --reporter flag.
- **Fix:** Implemented with `--reporter json` only. Added TODO comments for plan-02 where JUnit upload and PR comment will be wired in.
- **Files modified:** packages/action/src/run.ts
- **Verification:** Action compiles cleanly; TODO comments clearly mark plan-02 extension points.

---

**Total deviations:** 1 (plan conflict resolved by honoring IMPORTANT_FINDING)
**Impact on plan:** No scope creep. Plan-02 already accounts for this by converting JSON to JUnit format inside the action.

## Issues Encountered
None — TypeScript compiled cleanly on first run after npm install.

## User Setup Required
None — no external service configuration required for this scaffold phase.

## Next Phase Readiness
- Plan-02 can build on run.ts by importing `parseJsonReport` from `./run.js` and adding JUnit generation and PR comment modules
- TODO comments in run.ts mark exact wiring points for plan-02's uploadJunitArtifact and upsertPrComment calls
- `packages/action` is ready to build with `ncc build src/index.ts -o dist` once plan-02 adds test coverage

## Self-Check: PASSED

- FOUND: packages/action/action.yml
- FOUND: packages/action/package.json
- FOUND: packages/action/tsconfig.json
- FOUND: packages/action/src/types.ts
- FOUND: packages/action/src/run.ts
- FOUND: packages/action/src/index.ts
- FOUND: .planning/phases/17-github-action/17-01-SUMMARY.md
- FOUND commit: 0797856 (scaffold)
- FOUND commit: 66a8792 (implement run.ts + index.ts)

---
*Phase: 17-github-action*
*Completed: 2026-04-03*
