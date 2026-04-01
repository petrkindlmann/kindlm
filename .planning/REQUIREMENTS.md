# Requirements: KindLM v2.1.0 Gap Closure

**Defined:** 2026-04-01
**Core Value:** Reliably test AI agent behavior end-to-end — from YAML config to provider call to assertion verdict to exit code — so developers trust it in CI pipelines.

## v1 Requirements

### Feature Flags

- [ ] **JUDGE-01**: `betaJudge` flag enables 3-pass median judge scoring; errored passes are excluded from median (minimum 1 successful pass required)
- [ ] **COST-01**: `costGating` flag gates whether `config.gates.costMaxUsd` is forwarded to the runner (runner logic already exists; flag controls activation)

### Worktree Isolation

- [ ] **ISOLATE-01**: `--isolate` copies gitignored referenced files (schemaFile, argsSchema paths) into the worktree before running; git-tracked files are already present; missing files are non-fatal

### CLI Overrides

- [ ] **CLI-01**: `kindlm test --concurrency N` overrides `config.defaults.concurrency` (validated ≥ 1, exits with error otherwise)
- [ ] **CLI-02**: `kindlm test --timeout MS` overrides `config.defaults.timeoutMs` (validated ≥ 0; controls execution timeout only, not provider HTTP timeout)

### Test Coverage

- [ ] **TEST-01**: Unit tests for `dry-run.ts` (`formatTestPlan` — output format, skipped tests, command tests, totals)
- [ ] **TEST-02**: Unit tests for `select-reporter.ts` (routes to pretty/json/junit, exits on unknown type)
- [ ] **TEST-03**: Unit tests for `spinner.ts` (start/stop/update, testable via mock)

## Future Requirements

*(None deferred — all gaps are in scope for v2.1.0)*

## Out of Scope

| Feature | Reason |
|---------|--------|
| `--timeout` affecting provider HTTP timeout | Provider adapter init happens at startup, separate lifecycle; requires adapter-level API change — future milestone |
| `betaJudge` per-assertion YAML field (`passes: N`) | Flag-level default is sufficient for v2.1.0; per-assertion config requires Zod schema change and migration |
| Stripe live-mode products | Blocked on user-owned `sk_live_` key with product create permissions — not automatable |
| `--isolate` + `--watch` performance optimization | Worktree created fresh each watch cycle is slow but correct; optimization deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| JUDGE-01 | TBD | Pending |
| COST-01 | TBD | Pending |
| ISOLATE-01 | TBD | Pending |
| CLI-01 | TBD | Pending |
| CLI-02 | TBD | Pending |
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |
| TEST-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 8 ⚠️

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after initial definition*
