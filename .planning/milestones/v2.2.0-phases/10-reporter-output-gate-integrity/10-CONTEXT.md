# Phase 10: Reporter Output + Gate Integrity - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the pretty reporter show judge reasoning for every assertion (pass and fail), and make gates warn when they evaluate against zero data instead of silently passing. No new assertion types, no new CLI flags, no reporter format changes beyond reasoning display and gate warnings.

</domain>

<decisions>
## Implementation Decisions

### Reasoning display
- **D-01:** Judge reasoning appears as an indented line below the assertion result in pretty reporter
- **D-02:** On failure: full reasoning line, normal text. On pass: full reasoning line, dimmed
- **D-03:** Format: `      Reasoning: {reasoning text}` (8-space indent, below the 6-space assertion line)
- **D-04:** Reasoning is always shown — no verbose flag gating, no truncation

### Gate warnings
- **D-05:** Empty-data gates use warning icon (⚠) in the existing Quality Gates list — no separate warnings section
- **D-06:** Gate message appends `(no {type} assertions found — gate trivially passed)` to the existing message text
- **D-07:** Affected gates: `judgeAvgMin` (judge), `driftScoreMax` (drift), `deterministicPassRate` (deterministic), `probabilisticPassRate` (probabilistic)
- **D-08:** Gate still passes (not failed) — this is a warning, not a policy change

### Claude's Discretion
- Exact wording of warning messages
- Whether to add an `emptyData` flag to `GateResult` type or just modify the message string
- Test coverage approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reporter
- `packages/core/src/reporters/pretty.ts` — Pretty reporter implementation, `formatAssertion()` function
- `packages/core/src/reporters/interface.ts` — Reporter interface, Colorize type

### Gate evaluation
- `packages/core/src/engine/gate.ts` — Gate evaluation, `evaluateGates()`, empty-data defaults at lines 62-64, 82-84, 211

### Judge assertion
- `packages/core/src/assertions/judge.ts` — Judge implementation, `metadata.reasoning` field at lines 155, 219
- `packages/core/src/assertions/interface.ts` — AssertionResult type, metadata field

### Existing tests
- `packages/core/src/reporters/pretty.test.ts` (if exists)
- `packages/core/src/engine/gate.test.ts` (if exists)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Colorize` interface: provides `dim()`, `green()`, `red()`, `yellow()`, `cyan()`, `bold()` — use `dim()` for pass reasoning, `yellow()` for gate warning icon
- `formatAssertion()` in `pretty.ts:114-124`: current assertion formatter — needs reasoning line added
- `formatScore()` in `pretty.ts:126-137`: extracts threshold from metadata — same metadata access pattern for reasoning

### Established Patterns
- Gate results use `GateResult` type: `{ gateName, passed, actual, threshold, message }`
- Pretty reporter uses `c.green("✓")` / `c.red("✗")` / `c.yellow("○")` for icons — `c.yellow("⚠")` fits
- Assertions store structured data in `metadata` field (already used for judge threshold, betaJudge scores)

### Integration Points
- `formatAssertion()` is the single point where assertion results become text — reasoning display goes here
- `evaluateGates()` returns `GateEvaluation` consumed directly by reporter — warning flag or message change flows through
- JSON reporter (`packages/core/src/reporters/json.ts`) already has full metadata — no changes needed there

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-reporter-output-gate-integrity*
*Context gathered: 2026-04-02*
