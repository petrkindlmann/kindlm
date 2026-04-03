---
phase: quick
plan: 260403-voa
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/dashboard/package.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "Dashboard package.json shows version 2.3.0 instead of 0.0.0"
  artifacts:
    - path: "packages/dashboard/package.json"
      provides: "Correct version number"
      contains: '"version": "2.3.0"'
  key_links: []
---

<objective>
Fix dashboard package version showing 0.0.0 instead of the actual project version.

Purpose: The dashboard package.json was initialized with version 0.0.0 and never updated because it is marked as `"private": true`, which causes changesets to skip it during version bumps. The version should match the current project version (2.3.0).

Output: Updated packages/dashboard/package.json with correct version.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/dashboard/package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update dashboard package version to 2.3.0</name>
  <files>packages/dashboard/package.json</files>
  <action>
    In packages/dashboard/package.json, change `"version": "0.0.0"` to `"version": "2.3.0"` to match the current project version.

    The package is `"private": true` so changesets skips it during automated version bumps. This is a one-time fix to bring it in line with the rest of the monorepo.
  </action>
  <verify>
    <automated>grep '"version": "2.3.0"' packages/dashboard/package.json</automated>
  </verify>
  <done>packages/dashboard/package.json shows version 2.3.0</done>
</task>

</tasks>

<verification>
- `grep '"version"' packages/dashboard/package.json` returns `"version": "2.3.0"`
- `npm run typecheck` still passes (version field change has no type impact)
</verification>

<success_criteria>
Dashboard package.json version is 2.3.0, matching the project version.
</success_criteria>

<output>
After completion, create `.planning/quick/260403-voa-fix-dashboard-version-shows-0-0-0/260403-voa-SUMMARY.md`
</output>
