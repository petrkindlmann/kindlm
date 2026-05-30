# Deferred Items — Phase 18.1

## Out-of-scope failing test (pre-existing, unrelated)

- **Test:** `packages/cli/src/commands/__redteam_disabled__/run.test.ts > kindlm redteam run command > runs full pipeline: generate → execute → grade → report`
- **Status:** Failing on a clean tree, in a `__redteam_disabled__/` directory (untracked WIP red-team CLI work).
- **Relation to 18.1-02:** None. Does not import `assertions/schema`, `createJsonSchemaValidator`, `validateJsonSchema`, or `engine/runner`. Verified via grep.
- **Action:** NOT fixed (outside plan scope). Logged here for visibility.
