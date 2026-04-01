# KindLM Roadmap

## Milestones

- ✅ **v2.0.0 Launch Ops** — Phases 1-5 (shipped 2026-04-01)
- **v2.1.0 Gap Closure** — Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v2.0.0 Launch Ops (Phases 1-5) — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Deploy Everything (3/3 plans) — completed 2026-04-01
- [x] Phase 2: Append-only Run Artifacts + Versioned Baselines (1/1 plans) — completed 2026-04-01
- [x] Phase 3: Feature Flags via Config (1/1 plans) — completed 2026-04-01
- [x] Phase 4: MCP Provider Adapter (1/1 plans) — completed 2026-04-01
- [x] Phase 5: Worktree Isolation for Test Runs (1/1 plans) — completed 2026-04-01

See `.planning/milestones/v2.0.0-ROADMAP.md` for full details.

</details>

### v2.1.0 Gap Closure

- [x] **Phase 6: Cost Gating + CLI Overrides** — Wire costGating flag and add --concurrency/--timeout flags (completed 2026-04-01)
- [x] **Phase 7: betaJudge Multi-Pass Scoring** — Implement 3-pass median judge scoring gated behind betaJudge flag (completed 2026-04-01)
- [ ] **Phase 8: Worktree File Copy** — Copy referenced schema files into worktree for complete filesystem isolation
- [ ] **Phase 9: CLI Utility Unit Tests** — Unit tests for dry-run.ts, select-reporter.ts, and spinner.ts

## Phase Details

### Phase 6: Cost Gating + CLI Overrides
**Goal**: Users can control test run cost enforcement and execution parameters from the CLI
**Depends on**: Nothing (pure CLI-layer mutations, no new files)
**Requirements**: COST-01, CLI-01, CLI-02
**Success Criteria** (what must be TRUE):
  1. When `costGating` is enabled in `.kindlm/config.json`, a run that would exceed `config.gates.costMaxUsd` stops mid-run rather than continuing to accrue cost
  2. `kindlm test --concurrency 1` overrides `config.defaults.concurrency` and runs tests serially; `--concurrency 0` exits with a non-zero error code and a clear message
  3. `kindlm test --timeout 5000` overrides `config.defaults.timeoutMs` for test execution; the help text explicitly states this does not affect provider HTTP timeout
  4. When `costGating` is disabled (default), `config.gates.costMaxUsd` is ignored and runs proceed regardless of cost
**Plans**: 1 plan
Plans:
- [x] 06-01-PLAN.md — Wire costGating flag strip + add --concurrency and --timeout CLI overrides with tests

### Phase 7: betaJudge Multi-Pass Scoring
**Goal**: Users running judge assertions get stable, variance-reduced scores when betaJudge is enabled
**Depends on**: Phase 6
**Requirements**: JUDGE-01
**Success Criteria** (what must be TRUE):
  1. When `betaJudge` is enabled, each judge assertion runs 3 times and reports the median score; a single slow or slightly different inference no longer flips a border-line pass to fail
  2. When fewer than `ceil(N/2)` judge passes succeed (e.g., provider errors on all but one), the assertion returns `JUDGE_EVAL_ERROR` rather than a poisoned median score
  3. When `betaJudge` is disabled (default), judge assertions run exactly once — no change to existing behavior
**Plans**: 1 plan
Plans:
- [x] 07-01-PLAN.md — Implement betaJudge multi-pass median scoring + wire feature flag from CLI to runner

### Phase 8: Worktree File Copy
**Goal**: Users running `kindlm test --isolate` get a fully functional isolated environment including all files referenced in kindlm.yaml
**Depends on**: Phase 6
**Requirements**: ISOLATE-01
**Success Criteria** (what must be TRUE):
  1. Running `kindlm test --isolate` with a config that references `schemaFile` paths copies those files into the worktree before the run starts, so assertions that validate JSON Schema work correctly in isolation
  2. A referenced file that is missing from disk does not abort the run — the copy is skipped with a warning and the test proceeds (fail-open for missing optional files)
  3. A `schemaFile` path containing `../` that resolves outside the repo root is rejected with an error before any files are copied (path escape guard)
**Plans**: 1 plan
Plans:
- [ ] 08-01-PLAN.md — Implement extractConfigFilePaths + copyFilesToWorktree and wire into test.ts isolate block

### Phase 9: CLI Utility Unit Tests
**Goal**: The three previously-untested CLI utilities have verifiable unit test coverage
**Depends on**: Phase 7, Phase 8 (tests cover final implementations)
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. `formatTestPlan` in `dry-run.ts` is tested for correct output format, skipped test filtering, command test rendering, and accurate totals
  2. `select-reporter.ts` is tested to confirm it routes to `pretty`, `json`, and `junit` reporters correctly, and calls `process.exit(1)` with an error message on an unknown reporter type
  3. `spinner.ts` start/stop/update behavior is tested via `vi.mock("ora")` mocked at the wrapper level, with no dependency on real terminal I/O
**Plans**: 1 plan
Plans:
- [ ] 09-01-PLAN.md — Unit tests for dry-run.ts, select-reporter.ts, and spinner.ts

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Deploy Everything | v2.0.0 | 3/3 | Complete | 2026-04-01 |
| 2. Append-only Run Artifacts + Versioned Baselines | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 3. Feature Flags via Config | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 4. MCP Provider Adapter | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 5. Worktree Isolation for Test Runs | v2.0.0 | 1/1 | Complete | 2026-04-01 |
| 6. Cost Gating + CLI Overrides | v2.1.0 | 1/1 | Complete    | 2026-04-01 |
| 7. betaJudge Multi-Pass Scoring | v2.1.0 | 1/1 | Complete   | 2026-04-01 |
| 8. Worktree File Copy | v2.1.0 | 0/1 | Not started | - |
| 9. CLI Utility Unit Tests | v2.1.0 | 0/1 | Not started | - |
