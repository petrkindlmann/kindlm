# S06: Red Team Run CLI — Research

**Date:** 2026-04-10
**Scope:** M001/S06 — wire `runRedTeam` into the CLI

## Summary

S06 adds a `run` subcommand to `kindlm redteam` that exercises the
full red team pipeline end to end from a YAML config file. It reuses
everything S05 produced and every supporting helper the existing
`redteam generate` subcommand already relies on:

* **Config** — `parseConfig` + `createNodeFileReader`
* **Adapters** — `initProviderAdapters` (shared with `kindlm test`)
* **Orchestrator** — `runRedTeam` (S05)
* **Reporter** — `formatRedTeamReportPretty` or `formatRedTeamReportJson` (S04)
* **Colorize** — the chalk-backed instance already used by `selectReporter`

The command is a thin wrapper: parse → init adapters → run → format
→ exit. No new orchestration logic lives in the CLI. This keeps
`@kindlm/cli` a pure I/O shell over `@kindlm/core`.

## Command Surface

```
kindlm redteam run [options]

Options:
  -c, --config <path>     Path to config file (default: kindlm.yaml)
  -r, --reporter <type>   Output format: pretty, json (default: pretty)
  -o, --out <path>        Write output to a file instead of stdout
  -h, --help              Display help for command
```

Exit codes:
- `0` — gates all passed.
- `1` — any failure: config error, missing adapters, pipeline error,
  or gates failed.

This mirrors `kindlm test`'s exit-code semantics: a successful run
with failing gates exits 1, same as a test run with failing
assertions.

## CLI Flow

```
1. Resolve + stat-check config path       (same as generate)
2. readFileSync                            (same as generate)
3. parseConfig + validation                (same as generate)
4. Guard: config.redteam must exist        (same as generate)
5. initProviderAdapters                    (same as generate, noCache: true)
6. runRedTeam(config, { adapters })
7. Branch on Result:
   - err → format error + perPlugin details, exit 1
   - ok  → format report pretty/json, write to file or stdout
8. Exit on result.data.report.gates.passed ? 0 : 1
```

Steps 1–5 are lifted verbatim from the existing `generate` action.
S06 is the first CLI command that calls `runRedTeam`, so the code
path stops being identical at step 6.

## Design Decisions

### No new adapter helper — reuse `initProviderAdapters`.
The existing helper already handles env var resolution,
caching-wrapper toggling, and error messaging with `process.exit(1)`.
Passing `noCache: true` is consistent with `generate` — red team
runs are meant to exercise live provider responses, not cached
ones.

### No progress spinner in S06.
`kindlm test` has an elaborate progress spinner. Red team runs are
longer (many target calls per plugin) but the first version keeps
the UX quiet: print the formatted report at the end and exit. A
spinner can be added in a follow-up if users ask for it.

### Reporter choices: pretty + json only (no junit).
`formatRedTeamReportPretty` and `formatRedTeamReportJson` are the
two public formatters from S04. JUnit output doesn't make sense
for red team reports (JUnit's test/testcase shape doesn't match
per-plugin/per-severity vulnerability data). Only two reporter
types for now.

### `--out` writes to a file, stdout otherwise.
Same semantic as `redteam generate --out`: when the flag is
present, write the formatted output to the file and print a
confirmation message to stderr; otherwise print to stdout. This
keeps stdout JSON-safe for `jq` piping.

### Per-plugin errors on success path.
When `runRedTeam` returns `ok` but `perPlugin[key].error` is
populated for one or more plugins (partial success), print a
warning block to stderr *in addition to* the formatted report on
stdout. This matches the partial-success semantics of the
underlying orchestrator: some plugins failed, some produced
verdicts, and the user needs both signals.

### Exit code mirrors gate verdict.
On success, exit code is `report.gates.passed ? 0 : 1`. Failed
gates are the primary signal the CLI cares about — they're what
CI uses to fail a build. Partial plugin failures do not override
the gate verdict by themselves; they're surfaced in the report
and in the warning block.

## Test Coverage

Extend `packages/cli/src/commands/redteam.test.ts` with a new
`describe` block for the run subcommand. Follow the same mock
pattern already in use (`vi.mock("@kindlm/core")`) and add
`runRedTeam` to the mocked exports.

Tests to add:

1. **Happy path, pretty**: gates pass → stdout contains the pretty
   header ("Red Team Vulnerability Report"), exit code 0.
2. **Happy path, json**: `--reporter json` → stdout parses as JSON
   with `summary`, `categories`, `gates` fields, exit code 0.
3. **Gates failed**: `report.gates.passed === false` → exit code 1,
   stdout still has the report.
4. **runRedTeam returns err**: exits 1 with error message + per-plugin
   error details.
5. **No redteam block**: exits 1 with "No redteam: block" message
   (same guard as generate — should reuse the same assertion).
6. **parseConfig fails**: exits 1 with "Config validation failed"
   and bullet-listed errors.
7. **Config file not found (statSync throws)**: exits 1 with "Config
   file not found".
8. **`--out` writes to file and exits 0**: stdout does NOT contain
   the pretty header, file receives it instead.
9. **Partial success**: one plugin has an error in `perPlugin` but
   gates pass → stderr warning block, stdout report, exit 0.

Test helper: a `makeSuccessfulRunResult` factory that builds a
minimal `RedTeamRunResult` with a `RedTeamReport` where callers can
set `gates.passed`. Mirrors `makeSuccessfulGenerationResult` already
in the test file.

## Implementation Landscape

### File edits

1. `packages/cli/src/commands/redteam.ts`
   - Add imports: `runRedTeam`, `formatRedTeamReportPretty`,
     `formatRedTeamReportJson` from `@kindlm/core`.
   - Add `Colorize` import (or reuse a local chalk colorize — smaller
     surface than importing from `select-reporter.js`).
   - Add `.command("run")` with options and action handler.
   - Extract a small `readAndParseConfig` helper? — NO. Duplication
     between `generate` and `run` is cheap for now. A shared helper
     only pays off with three callers.

2. `packages/cli/src/commands/redteam.test.ts`
   - Add `runRedTeam`, `formatRedTeamReportPretty`,
     `formatRedTeamReportJson` to the mocked `@kindlm/core` module.
   - Add the new `describe("redteam run command", …)` block.

### Zero core changes

Everything S06 needs lives in the `@kindlm/core` barrel already.
No changes to core.

## Verification

```bash
npx tsc --noEmit -p packages/cli/tsconfig.json
npx eslint packages/cli/src/commands/redteam.ts --quiet
npx vitest run packages/cli/src/commands/redteam.test.ts
```

Expected: existing redteam CLI tests still pass, plus the new run
subcommand tests. No core tests touched.

## What's left after S06

S06 closes the M001-redteam milestone's core/CLI loop. Open items
that are *not* in scope for this slice:

* Integration tests that hit a real provider (requires secrets and
  costs money on every CI run).
* Cloud upload of red team results (milestone adjacent, not red
  team core).
* JUnit red team reporter for CI systems that want a uniform shape
  (follow-up slice).
* Progress spinner / live per-plugin output (UX polish).
