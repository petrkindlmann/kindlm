# Requirements: KindLM Launch Ops

- [x] **OPS-01**: Fix duplicate migration 0011, renumber
- [x] **OPS-02**: Push 28 commits to remote
- [x] **OPS-03**: Run D1 migrations on production
- [x] **OPS-04**: Deploy Cloud Worker
- [x] **OPS-05**: Merge Version Packages PR (v2.0.0 publish)
- [x] **OPS-06**: Set SENTRY_DSN Worker secret (needs Sentry project — manual)
- [x] **OPS-07**: Publish VS Code extension (needs PAT — manual)
- [x] **OPS-08**: Create Stripe production products (needs dashboard — manual)

## Phase 2: Append-only Run Artifacts and Versioned Baselines

- [ ] **ARTIFACT-01**: After `kindlm test`, a `.kindlm/runs/{runId}/{executionId}/` directory exists containing exactly 5 files: `results.json`, `results.jsonl`, `summary.json`, `metadata.json`, `config.json`; same config+suite+git commit always produces the same `runId` (deterministic hash, retry-safe); each individual attempt produces a unique `executionId` (UUID)
- [ ] **ARTIFACT-02**: `last-run.json` includes `runId` and `artifactDir` optional fields after a test run; artifact write failure produces a console warning (`chalk.yellow`) but does not change the process exit code
- [ ] **BASELINE-01**: Running `kindlm baseline set` twice never overwrites the first file — both are kept as timestamped files (`{suite}-{YYYYMMDDHHMMSS}.json`) with a `-latest.json` pointer file containing only the filename reference `{ latestFile: "..." }` (not a content copy)
