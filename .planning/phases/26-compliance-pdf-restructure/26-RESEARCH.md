# Phase 26: Compliance PDF Restructure - Research

**Researched:** 2026-04-09
**Domain:** Compliance reporting (EU AI Act Annex IV) + PDF rendering
**Confidence:** HIGH (codebase) / HIGH (Annex IV spec) / MEDIUM (pdfkit edge cases)

## Summary

Phase 26 restructures the existing compliance reporter and PDF renderer so the output
matches the **EU AI Act Annex IV documentation structure** (six numbered elements)
rather than the current Article-based mapping (Articles 9/10/12/13/15). It adds a
page-1 executive summary targeted at non-technical auditors (pass rate, risk
categorization, trend-vs-last-audit) and a dated/signed test logs section that
satisfies Annex IV element 4.

The work is entirely in `@kindlm/core` (markdown generation) and `@kindlm/cli`
(PDF renderer + previous-run loading + metadata capture). No Cloud API, schema,
or dashboard changes are required. The SHA-256 tamper-evidence hash must be
preserved byte-for-byte through the restructure — compliance auditors rely on
reproducibility.

**Primary recommendation:** Replace the Article-structured markdown in
`packages/core/src/reporters/compliance.ts` with a new Annex-IV-structured template
while keeping `createComplianceReporter()` as the public entry point. Feed the executive
summary from `RunResult` + a new optional `previousRun` parameter (loaded from
`.kindlm/last-run.json` by the CLI). Extend `pdf-renderer.ts` to emit a dedicated
page-1 layout before the existing section loop and recognize new H2 section keys for
page-break control. Do not introduce new libraries — pdfkit + existing markdown
walker handle everything needed.

## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for phase 26 yet.** Research runs standalone per the
`/gsd-research-phase` path. All constraints below are derived from
`CLAUDE.md`, `REQUIREMENTS.md`, and `ROADMAP.md`.

### Locked Decisions (from project)

- **Core is zero-I/O** — `compliance.ts` must not read files, must not call `fetch`,
  must not `console.log`. Any previous-run data must be passed in as a parameter.
- **Cloudflare Workers compatibility** — `compliance.ts` must continue to use
  `globalThis.crypto.subtle` (already does), not Node's `crypto` module.
- **YAML is the config format** — any new metadata fields go through
  `ComplianceSchema` in `packages/core/src/config/schema.ts`.
- **No classes** — factory functions only.
- **Result types over exceptions** — fallible operations return `Result<T, E>`.
- **`.js` extensions on relative imports**, `import type` for type-only imports.

### Claude's Discretion

- Exact markdown phrasing inside each Annex IV element.
- Risk categorization bucket names and thresholds (subject to research below).
- Exact trend chart representation in PDF (text delta vs sparkline).
- Backwards-compat strategy (version the format, or single-break).

### Deferred Ideas (OUT OF SCOPE)

- AI Bill of Materials (AI BOM) component inventory — flagged in research as
  emerging but not in requirements.
- Discriminatory impact metrics beyond "not applicable" placeholder — requires
  fairness assertion types KindLM does not have.
- Signing with cryptographic keys (x.509, Sigstore). Current "signed" means
  operator name + timestamp; cryptographic signing is enterprise-tier and not
  in COMP-01..03.
- Cloud-side compliance storage changes (compliance_report column already exists
  in D1 schema).
- Internationalization of the report.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Page 1 executive summary (pass rate, risk categories, trend vs last audit) | See `## Executive Summary Design` + `## Previous Run Loading` |
| COMP-02 | Report structured by Annex IV elements (architecture, data, testing, risk) | See `## Annex IV Element Mapping` |
| COMP-03 | Dated/signed test logs section per Annex IV | See `## Dated/Signed Test Logs` |

## Project Constraints (from CLAUDE.md)

- `@kindlm/core` has **zero I/O dependencies**. No `fs`, `fetch`, `console.log`.
- Cloud runs on Cloudflare Workers — Web APIs only (no Node built-ins).
- Use Zod for all external input validation.
- Result types (`{ success: true, data } | { success: false, error }`) over
  exceptions, except Zod config validation.
- No `any`, use `unknown` + narrowing.
- `verbatimModuleSyntax: true` — `import type` for type-only imports.
- `.js` extensions on all relative ESM imports.
- One file per concern (don't merge multiple reporter variants into one file
  unnecessarily).
- Comments explain "why", not "what".
- Provider API keys are user-owned — never stored or proxied.

## Existing Implementation Audit

Read from codebase at HEAD (main branch), confidence HIGH.

### `packages/core/src/reporters/compliance.ts`
[VERIFIED: direct read]

- 193 lines, single file. Exports `createComplianceReporter(metadata?)`.
- Structure today: Header → Article 9 → Article 10 → Article 12 → Article 13 →
  Article 15 → Quality Gate Summary → Verdict → Hash footer.
- Inputs: `RunResult` (from engine) + `GateEvaluation`.
- Helpers: `sha256Hex()`, `sortDeep()`, `canonicalize()` for content hash +
  run identity hash (metadata-aware).
- **Two SHA-256 hashes** (both must be preserved in restructure):
  - `contentHash` — hash of report body, same inputs → same hash (reproducibility).
  - `runHash` — hash of `{content, metadata}` for per-execution traceability.
- Hashes are computed from `sections.join("\n")` BEFORE the hash footer lines
  are pushed. New implementation must honor this ordering exactly.
- `formatGateEvidence(gateEval, gateNames[])` filters gates by name — reusable
  for the Annex IV element mapping below.

### `packages/cli/src/utils/pdf-renderer.ts`
[VERIFIED: direct read]

- Uses `pdfkit` v0.15.0 (no type declarations — `@ts-expect-error` shim).
- Renders: title page → `parseSections(markdown)` → per section `doc.addPage()`
  → walks body lines handling code fences, tables, subheadings, bullets.
- `parseSections` splits on H2 (`## ...`). Each H2 gets its own page.
- Table detection: next line matches `^\s*\|[-:\s|]+\|\s*$`.
- Hash extraction: regex `SHA-256:\s*`([a-f0-9]+)``.
- Title page extracts `# <title>` via `extractTitle()`.
- Page header: "KindLM Compliance Report" + timestamp top-right.
- Page footer: "Generated by KindLM · kindlm.com".
- No table-of-contents logic. No page numbers. No exec summary layout.
- `ensureSpace(doc, needed)` checks remaining vertical space and `addPage()` if
  insufficient — used for tables and text runs.

### `packages/cli/src/commands/test.ts`
[VERIFIED: direct read, lines 262-296]

- `--compliance` triggers `createComplianceReporter(metadata)`. Metadata is
  built from `crypto.randomUUID()` (runId), `KINDLM_VERSION` (declared const),
  `getGitInfo().commitSha`, model IDs, and `config.compliance.metadata`
  (spread). The config metadata can already supply `systemName`, `operator`,
  `riskLevel`, `intendedPurpose` (all optional).
- Report is then written to stdout (pretty) or stderr (machine reporters).
- `--pdf <path>` requires `--compliance`, calls `renderCompliancePdf(content, path)`.
- `saveLastRun()` persists `complianceReport: complianceContent` and `complianceHash`
  to `.kindlm/last-run.json`.
- Exit code unchanged by compliance generation.

### `packages/core/src/config/schema.ts` ComplianceSchema
[VERIFIED: direct read, lines 589-617]

Current metadata fields available via `config.compliance.metadata`:
- `systemName` (string, optional)
- `systemVersion` (string, optional)
- `riskLevel` (enum: "high" | "limited" | "minimal", optional)
- `operator` (string, optional)
- `intendedPurpose` (string, optional)
- `dataGovernanceNotes` (string, optional)

**Gap for COMP-03:** No `responsiblePerson` field (needed for dated/signed
test logs). Recommended addition in schema, backed by optional field so
existing configs don't break.

### `packages/cli/src/utils/last-run.ts`
[VERIFIED: grep]

- `LastRunData` already includes `complianceReport?: string` and
  `complianceHash?: string`. The previous run's gate result and pass rate are
  NOT currently persisted separately — but the full run data (`runnerResult`)
  IS persisted and can be re-read for trend-vs-last-audit.

### Tests: `packages/core/src/reporters/compliance.test.ts`
[VERIFIED: direct read]

- 152 lines, snapshot-style markdown assertions.
- Expects "includes all article sections" — this test will BREAK under the
  restructure and must be rewritten for Annex IV elements.

## Annex IV Element Mapping

[CITED: https://artificialintelligenceact.eu/annex/4/]
[CITED: .planning/research/v2.4-market-signal.md Part 7]

Annex IV requires six elements for high-risk system technical documentation.
This table maps each to what KindLM actually has evidence for.

| # | Annex IV Element | KindLM has evidence? | Data source in code | Handling |
|---|------------------|----------------------|---------------------|----------|
| 1 | System architecture & design specifications (logic, algorithms) | Partial | `metadata.systemName`, `metadata.systemVersion`, `metadata.intendedPurpose`, `modelIds`, `config.models[].params` | Emit section with metadata fields + model inventory. If `systemName` absent, emit "Not documented — declare in `kindlm.yaml` under `compliance.metadata.systemName`" |
| 2 | Data requirements & provenance (training data sources, labeling) | No | `metadata.dataGovernanceNotes` (free-text only) | Emit section with `dataGovernanceNotes` if present, else "Not applicable — KindLM tests agent behavior, not training data. Declare training data governance in `compliance.metadata.dataGovernanceNotes`." |
| 3 | **Testing & validation reports** with metrics for accuracy, robustness, cybersecurity | **Yes — core strength** | `RunResult` (totals, per-test), `GateEvaluation.gates` (all named gates) | Full gate table + per-suite breakdown. Split into three subsections: Accuracy (passRateMin, judgeAvgMin, schemaFailuresMax), Robustness (probabilisticPassRate, driftScoreMax, latencyMaxMs, costMaxUsd), Cybersecurity (piiFailuresMax, keywordFailuresMax) |
| 4 | **Test logs dated and signed by responsible persons** | Yes | `runId`, run timestamp, `metadata.operator`, per-test timestamps derivable from runId + test order | New dedicated section — see `## Dated/Signed Test Logs` below |
| 5 | Measures for risk management | Partial | Gate configuration itself IS a risk management measure | Emit section documenting configured gates as "risk thresholds" + reference to `passRateMin`, `piiFailuresMax`, etc. from user's `kindlm.yaml` |
| 6 | Discriminatory impact assessment | No | None — KindLM has no fairness assertions | Emit "Not applicable to this report. KindLM does not currently compute fairness metrics. Recommended: run separate fairness evaluations aligned with ISO/IEC TR 24027 and cite results here." |

**Articles 9/10/12/13/15 are not discarded** — they remain referenced at the
bottom of each Annex IV element as "Relevant articles: ..." cross-references
to preserve the existing regulatory framing for auditors who expect it.

## Executive Summary Design (COMP-01)

Page 1 layout, rendered BEFORE any Annex IV element. The markdown version uses a
dedicated `## Executive Summary` H2 that the PDF renderer recognizes as a
special case (no page break after title page, styled as page 1).

### Content blocks

1. **Verdict banner** — one line, large font in PDF. Derived from
   `gateEvaluation.passed`:
   - PASS → green "PASS — All quality gates met"
   - FAIL → red "FAIL — See gate failures below"

2. **Headline metrics table** (4 rows):
   - Overall Pass Rate: `passed / totalTests` formatted as percentage
   - Tests Executed: `totalTests`
   - Tests Failed: `failed + errored`
   - Duration: `durationMs` formatted human-readably (e.g., "2.5s")

3. **Risk categorization** — three buckets derived from gate results, not
   user-configured. [ASSUMED] bucket thresholds; need confirmation from
   discuss-phase:
   - **Critical risk failures**: gates with "pii" or "schema" in name that
     failed → direct safety/compliance issues.
   - **Robustness risk failures**: gates with "latency", "cost", "drift" in
     name that failed → operational/reliability issues.
   - **Quality risk failures**: remaining gate failures (passRate, judgeAvg,
     keyword) → subjective quality issues.
   - Each bucket shows count + list of failing gate names.

4. **Trend vs last audit** — comparison of current run to previous run loaded
   from `.kindlm/last-run.json` (see `## Previous Run Loading`). If no previous
   run exists, show "No previous audit available — this is the first run on
   this machine." Otherwise show a 3-row delta table:
   - Pass rate: `oldRate → newRate (±delta)` with ↑/↓/→ arrow
   - Failures: `oldFail → newFail (±delta)`
   - Previous audit date: ISO timestamp

5. **Report metadata line** — operator, system name, runId, git commit, date
   (duplicates what's on the original header — that's fine for page 1
   standalone).

## Previous Run Loading

Core stays zero-I/O. The CLI loads `.kindlm/last-run.json` via existing
`loadLastRun()` and passes a new optional parameter to the reporter:

```typescript
// New public type in core
export interface PreviousRunSnapshot {
  timestamp: string;          // ISO
  passRate: number;           // 0..1
  passed: number;
  failed: number;
  totalTests: number;
  complianceHash?: string;    // for audit linkage
}

// Reporter signature extension
export function createComplianceReporter(
  metadata?: ComplianceRunMetadata,
  previousRun?: PreviousRunSnapshot,
): Reporter;
```

CLI flow (in `test.ts`):
1. Call `loadLastRun()` BEFORE running tests.
2. If `lastRun.runnerResult` is present, compute `PreviousRunSnapshot` from
   its aggregated numbers (pass rate = passed/total).
3. Pass snapshot as second argument to `createComplianceReporter()`.

**Gotcha:** The current run is saved AFTER compliance generation, so loading
before test execution is correct — it gets the actual previous run, not the
current one.

**Gotcha:** `last-run.json` may be from a different suite. Include `suiteName`
check — if it mismatches, treat as "no previous audit for this suite".
`LastRunData.suiteName` already exists (verified in test.ts line 302).

## Dated/Signed Test Logs (COMP-03)

New dedicated section under Annex IV element 4. Content:

```markdown
## Annex IV Element 4 — Test Logs (Dated & Signed)

**Responsible Person:** {metadata.operator ?? "Not declared"}
**Test Execution Date:** {runTimestamp ISO}
**Run ID:** {metadata.runId}
**Attestation:** The test results below were executed by KindLM v{version}
on behalf of {operator}. Integrity is verified by the SHA-256 tamper evidence
hash at the end of this report.

### Per-test log

| Timestamp | Suite | Test | Status | Latency | Cost |
|-----------|-------|------|--------|---------|------|
| {iso}     | {s}   | {t}  | PASS/FAIL | 800ms | $0.01 |
```

**Timestamp derivation:** The current `RunResult` type does NOT include
per-test start timestamps. Two options:
- **Option A (recommended)**: derive sequential approximate timestamps by
  starting from `runResult.startedAt` (needs adding to `RunResult`) and
  incrementing by each test's `latencyMs`. Approximate but monotonic and
  auditable.
- **Option B**: add `startedAt: string` to each `TestCaseResult` in the runner
  directly. More accurate but touches more files.

Recommend **Option A** for phase 26 scope: single `startedAt` field on
`RunResult`, plus one-line derivation at report time. Option B can come in a
later phase if auditors demand it.

**"Signed" interpretation:** The combination of `operator` + `runTimestamp` +
SHA-256 hash is the "signature" for COMP-03 v1. Cryptographic signing (x.509 /
Sigstore) is explicitly out-of-scope — deferred to enterprise-tier phase.

## Schema Changes Required

[VERIFIED: direct read of schema.ts]

Add to `ComplianceSchema.metadata`:

```typescript
responsiblePerson: z.string().optional().describe(
  "Name and title of the person responsible for test execution — " +
  "required for EU AI Act Annex IV element 4 (dated/signed test logs)."
),
```

This is **additive** — existing configs continue to work; the field shows as
"Not declared" when absent. Back-compat: safe.

Also recommend adding (but not blocking phase 26):
- `systemArchitectureRef: z.string().url().optional()` — URL to external
  architecture documentation, rendered as a link under element 1.
- `trainingDataRef: z.string().url().optional()` — same for element 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom PDF bytes | Existing `pdfkit` v0.15.0 | Already installed, already working; restructure its call sequence, don't replace it |
| SHA-256 hashing | Node crypto | `globalThis.crypto.subtle` (already in code) | Workers compatibility constraint |
| Markdown → PDF walker | Full markdown parser (marked, markdown-it) | Extend existing `parseSections` in pdf-renderer.ts | Current walker is scoped to KindLM's own markdown dialect; adding a full parser bloats CLI for minimal gain |
| ISO timestamp formatting | Custom formatter | `Date.prototype.toISOString()` | Already in use throughout the codebase |
| Table-of-contents generation | Manual anchors | Generate from `parseSections()` output with page numbers from pdfkit's `doc.bufferedPageRange()` | pdfkit exposes page count during rendering |
| YAML metadata validation | Manual field checks | Extend existing Zod `ComplianceSchema` | Zod is already the validation layer for all config |

**Key insight:** This phase is a **restructuring and presentation** change, not
a new-capability change. Every piece of data needed already exists in
`RunResult`, `GateEvaluation`, or `compliance.metadata`. No new dependencies.

## Markdown → PDF Rendering Considerations

[VERIFIED: direct read of pdf-renderer.ts]

### Page break strategy

Current `pdf-renderer.ts` puts each `## H2` on its own page via `doc.addPage()`
at line 191. The restructure produces this section sequence:

1. Title page (existing, line 172)
2. `## Executive Summary` → **page 2** (first page of content)
3. `## Annex IV Element 1 — System Architecture` → **page 3**
4. `## Annex IV Element 2 — Data Provenance` → **page 4**
5. `## Annex IV Element 3 — Testing & Validation` → **page 5+** (may span
   multiple pages due to per-gate tables)
6. `## Annex IV Element 4 — Test Logs (Dated & Signed)` → **page N+**
7. `## Annex IV Element 5 — Risk Management` → **page N+**
8. `## Annex IV Element 6 — Discriminatory Impact` → **page N+**
9. `## Quality Gate Summary` → **page N+**
10. `## Appendix — Per-test Detail` → **page N+**
11. Hash footer (merged with last section today; keep it)

The existing per-H2-new-page behavior is fine. **No page-break hints needed**
beyond the existing convention.

### Table of contents

After the title page and before the executive summary, insert a new page with
"Contents" listing each Annex IV element with its page number. pdfkit supports
this via:

```typescript
const tocPage = doc.addPage();
// ... later
doc.switchToPage(tocPage);
doc.text("..."); // after final render, go back and fill in page numbers
```

[CITED: pdfkit docs - https://pdfkit.org/docs/text.html#page_buffering]

Requires `bufferPages: true` in the `new PDFDocument({...})` constructor
options. Currently NOT set in pdf-renderer.ts — must be added.

**Alternative (simpler):** Generate TOC after walking all sections by tracking
each section's start page number in a local array, then use `doc.switchToPage`
to retroactively write the TOC. Requires `bufferPages: true`.

### Executive summary layout

The exec summary should NOT go through the generic section walker. Instead,
`renderCompliancePdf` should special-case `## Executive Summary` to:
- Use larger fonts for verdict banner
- Render risk category as a 3-column grid instead of plain markdown
- Render trend delta with arrow glyphs

This means either:
- **Option A**: Structured data passed separately from markdown — clean, but
  core would need to emit both formats.
- **Option B**: Parse structured markdown blocks in `renderCompliancePdf`
  using HTML-comment markers like `<!-- exec-summary-verdict: PASS -->`.
  Ugly but keeps core pure-markdown and compliance with zero-I/O.

Recommend **Option B** for phase 26 — markdown stays the canonical artifact,
PDF adds visual polish. HTML comments are invisible in markdown renderers and
do not affect hashes (they're part of the hashed content, but consistent).

### Font/color constraints

pdfkit ships with Helvetica + Courier baked in. No custom fonts, no emoji
support. Existing renderer uses:
- Helvetica / Helvetica-Bold / Courier
- Colors: `#1c1917` (titles), `#44403c` (body), `#57534e` (subtitle),
  `#a8a29e` (meta), `#78716c` (mono), `#e7e5e4` (rules), `#f5f5f4` (table bg),
  `#6366f1` (link)

Reuse this palette. For the verdict banner, add:
- PASS green: `#16a34a`
- FAIL red: `#dc2626`

## Backwards Compatibility

**Breaking change for anyone parsing `--compliance` markdown output.**
The section headers change from "Article 9 — Risk Management System" to
"Annex IV Element 3 — Testing & Validation". Anyone grepping for article names
will break.

**Mitigation options:**

1. **Single-break, documented** (recommended): Call out in CHANGELOG as breaking
   under v2.4.0 banner. Justify with EU AI Act alignment. Provide migration
   note for users who parse the markdown.

2. **`--compliance-format=articles|annex-iv` flag**: Keep both generators
   alive. Cost: 2× code, 2× test surface, 2× drift risk. **Not recommended**
   — complexity not justified by audience size.

3. **Environment variable fallback**: `KINDLM_COMPLIANCE_LEGACY=1` to get
   Article-based output for one more minor version. Cheapest compromise.
   **Recommend for phase 26** as a safety valve if discuss-phase surfaces
   known downstream parsers.

**Non-breaking aspects:**
- Exit codes unchanged
- `--compliance` and `--pdf` flags unchanged
- `.kindlm/last-run.json` schema unchanged (additive only if new fields are
  introduced — they should be optional)
- SHA-256 hash algorithm unchanged (reproducibility guarantee preserved)
- Hash will DIFFER between old and new reports (expected — different content)

## Common Pitfalls

### Pitfall 1: Breaking the tamper hash contract
**What goes wrong:** The restructure changes section ordering, which changes
`sections.join("\n")`, which changes `contentHash`. Users with stored previous
hashes can no longer verify old reports.
**Why it happens:** Content hash is by design a function of content.
**How to avoid:** Document in CHANGELOG that pre-v2.4.0 reports remain valid
against their own recorded hash, but cannot be compared to v2.4.0 reports.
Keep the hashing algorithm identical.
**Warning signs:** Snapshot tests fail; users report "my audit trail broke".

### Pitfall 2: Previous-run loading in wrong process order
**What goes wrong:** CLI loads `.kindlm/last-run.json` AFTER the current run
writes it → trend comparison shows "current vs current" (always zero delta).
**Why it happens:** Natural code flow — run first, then load.
**How to avoid:** Call `loadLastRun()` BEFORE test execution. Store the
snapshot in a local variable and pass it in when building the compliance
reporter.
**Warning signs:** Trend table always shows `0.00 → 0.00 (±0)`.

### Pitfall 3: pdfkit page buffering not enabled
**What goes wrong:** Table of contents can't be generated retroactively
because pdfkit streams pages to disk as soon as they're complete.
**Why it happens:** `bufferPages: true` is off by default.
**How to avoid:** Set `bufferPages: true` in constructor; call `doc.flushPages()`
or let `doc.end()` handle flush.
**Warning signs:** `doc.switchToPage()` throws "Pages already flushed".
[CITED: https://pdfkit.org/docs/text.html#page_buffering]

### Pitfall 4: Risk category bucket over-fitting
**What goes wrong:** The bucket thresholds ("Critical", "Robustness", "Quality")
are hard-coded by gate name substring, which breaks when users have custom gate
names or when new gates are added in phase 19 (STAT-01..04).
**Why it happens:** Classifying by string match is fragile.
**How to avoid:** Keep the mapping in a single lookup function
`categorizeGate(gateName): "critical" | "robustness" | "quality" | "other"`
with a fallback to "other" and a unit test per gate name.
**Warning signs:** A new gate lands in "other" bucket unexpectedly.

### Pitfall 5: Non-ASCII in operator names breaks pdfkit Helvetica
**What goes wrong:** pdfkit's built-in Helvetica is Windows-1252 only. Non-Latin
operator names render as `?????`.
**Why it happens:** pdfkit requires TTF embedding for Unicode.
**How to avoid:** Either ship a Unicode TTF (adds ~1MB to CLI install) or
sanitize non-ASCII in the operator field and warn on stderr.
**Warning signs:** Report contains `?` characters in operator/system name.
**Recommendation:** For phase 26, document the ASCII-only limitation and
warn on non-ASCII. TTF embedding is a future phase.

### Pitfall 6: `startedAt` field missing on `RunResult`
**What goes wrong:** Timestamped test logs can't be generated without a run
start time.
**Why it happens:** `RunResult` currently has `durationMs` but no absolute
timestamp.
**How to avoid:** Add `startedAt: string` to the `RunResult` interface in
`packages/core/src/engine/runner.ts`. Populate from `new Date().toISOString()`
at runner entry. Check for existing users of `RunResult` (pretty, json, junit
reporters, reporter tests) — additive change.
**Warning signs:** Tests fail because `runResult.startedAt` is undefined in
fixtures.

## Code Examples

### Extending the reporter interface (core)

```typescript
// Source: new code following existing compliance.ts pattern
export interface PreviousRunSnapshot {
  timestamp: string;
  passRate: number;
  passed: number;
  failed: number;
  totalTests: number;
  complianceHash?: string;
}

export function createComplianceReporter(
  metadata?: ComplianceRunMetadata,
  previousRun?: PreviousRunSnapshot,
): Reporter {
  return {
    name: "compliance",
    async generate(runResult, gateEvaluation): Promise<ReporterOutput> {
      const sections: string[] = [];
      // 1. Title
      sections.push(...renderTitle(metadata));
      // 2. Executive Summary (Page 1)
      sections.push(...renderExecutiveSummary(runResult, gateEvaluation, previousRun));
      // 3. Table of Contents markers
      sections.push(...renderTocMarker());
      // 4. Annex IV Elements 1-6
      sections.push(...renderAnnexElement1(metadata));
      sections.push(...renderAnnexElement2(metadata));
      sections.push(...renderAnnexElement3(runResult, gateEvaluation));
      sections.push(...renderAnnexElement4(runResult, metadata));
      sections.push(...renderAnnexElement5(gateEvaluation));
      sections.push(...renderAnnexElement6());
      // 5. Quality Gate Summary (existing)
      sections.push(...renderGateSummary(gateEvaluation));
      // 6. Appendix
      sections.push(...renderAppendix(runResult));
      // 7. Hash footer
      const contentAboveHash = sections.join("\n");
      const contentHash = await sha256Hex(contentAboveHash);
      const runHash = metadata
        ? await sha256Hex(canonicalize({ content: contentAboveHash, metadata }))
        : contentHash;
      sections.push(...renderHashFooter(contentHash, runHash, metadata));
      return { content: sections.join("\n"), format: "markdown" };
    },
  };
}
```

### Risk categorization helper

```typescript
// Source: new code
type RiskBucket = "critical" | "robustness" | "quality" | "other";

function categorizeGate(gateName: string): RiskBucket {
  const name = gateName.toLowerCase();
  if (name.includes("pii") || name.includes("schema")) return "critical";
  if (name.includes("latency") || name.includes("cost") || name.includes("drift")) return "robustness";
  if (name.includes("passrate") || name.includes("judge") || name.includes("keyword")) return "quality";
  return "other";
}

function buildRiskSummary(gateEval: GateEvaluation): Record<RiskBucket, string[]> {
  const buckets: Record<RiskBucket, string[]> = { critical: [], robustness: [], quality: [], other: [] };
  for (const gate of gateEval.gates) {
    if (!gate.passed) buckets[categorizeGate(gate.gateName)].push(gate.gateName);
  }
  return buckets;
}
```

### pdfkit TOC with buffered pages

```typescript
// Source: pdfkit docs - https://pdfkit.org/docs/text.html#page_buffering
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 72, bottom: 72, left: 60, right: 60 },
  bufferPages: true,  // NEW — required for TOC
  info: { /* ... */ },
});

// Track section start pages as you render
const sectionPages: Array<{ heading: string; pageIndex: number }> = [];
for (const section of sections) {
  doc.addPage();
  const range = doc.bufferedPageRange();
  sectionPages.push({ heading: section.heading, pageIndex: range.start + range.count - 1 });
  // ... render section ...
}

// Retroactively populate the TOC page (which was page 2)
doc.switchToPage(1);
doc.fontSize(16).text("Contents", { align: "center" });
doc.moveDown();
for (const { heading, pageIndex } of sectionPages) {
  doc.fontSize(10).text(`${heading} ........ ${pageIndex + 1}`);
}

doc.flushPages();
doc.end();
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pdfkit` | PDF generation | ✓ (installed in `@kindlm/cli`) | 0.15.0 | — |
| `@kindlm/core` build | `createComplianceReporter` | ✓ | workspace | — |
| `vitest` | Snapshot tests | ✓ | 3.2.4 | — |
| `globalThis.crypto.subtle` | SHA-256 hashing | ✓ (Node 20+) | native | — |

No missing dependencies. No fallbacks needed.

## Validation Architecture

[VERIFIED: `.planning/config.json` does not set `workflow.nyquist_validation`, so default = enabled.]

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `/Users/petr/projects/kindlm/vitest.config.ts` |
| Quick run command | `npx vitest run packages/core/src/reporters/compliance.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | Page 1 contains exec summary (verdict, pass rate, risk buckets, trend) | unit (markdown snapshot) | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "executive summary"` | ⚠ Needs rewrite — existing test is Article-based |
| COMP-01 | Trend row shows "No previous audit" when `previousRun` is undefined | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "no previous run"` | ❌ Wave 0 |
| COMP-01 | Trend row shows delta when `previousRun` provided | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "previous run delta"` | ❌ Wave 0 |
| COMP-02 | Report contains all six Annex IV element H2 headers | unit (markdown contains) | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "annex iv elements"` | ❌ Wave 0 |
| COMP-02 | Element 6 shows "Not applicable" message | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "discriminatory impact"` | ❌ Wave 0 |
| COMP-03 | Test logs section includes operator name | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "test logs operator"` | ❌ Wave 0 |
| COMP-03 | Test logs section includes per-test timestamps in chronological order | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "test logs timestamps"` | ❌ Wave 0 |
| COMP-03 | Test logs show "Not declared" when operator metadata absent | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "test logs no operator"` | ❌ Wave 0 |
| — | Content hash is stable across repeated invocations with same input | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "stable hash"` | ⚠ Extend existing hash test |
| — | Content hash changes when exec summary content changes | unit | `npx vitest run packages/core/src/reporters/compliance.test.ts -t "hash sensitivity"` | ❌ Wave 0 |
| — | PDF generation succeeds for restructured markdown (smoke test) | integration | `npx vitest run packages/cli/src/utils/pdf-renderer.test.ts` | ❌ Wave 0 (no test file yet) |
| — | TOC page numbers match actual section pages | integration | `npx vitest run packages/cli/src/utils/pdf-renderer.test.ts -t "toc"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/reporters/compliance.test.ts packages/cli/src/utils/pdf-renderer.test.ts`
- **Per wave merge:** `npm run test -- --run packages/core packages/cli`
- **Phase gate:** `npm run test && npm run typecheck && npm run lint` (all packages green)

### Wave 0 Gaps
- [ ] Rewrite `packages/core/src/reporters/compliance.test.ts` — drop Article-based assertions, add Annex IV element assertions + exec summary + test logs assertions
- [ ] Create `packages/cli/src/utils/pdf-renderer.test.ts` — smoke test PDF generation using a fixture markdown and temp-file output
- [ ] Add `RunResult.startedAt` field in `packages/core/src/engine/runner.ts` + propagate through all reporters' fixtures
- [ ] No framework install needed — vitest already configured

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Risk bucket thresholds (critical/robustness/quality by gate-name substring match) | Executive Summary Design | Auditor rejects categorization; need explicit configuration |
| A2 | COMP-03 "signed" interpretation = operator name + timestamp + SHA-256 (not cryptographic signing) | Dated/Signed Test Logs | Enterprise auditors demand x.509/Sigstore signing; requires new phase |
| A3 | ASCII-only operator names acceptable for v1 (pdfkit Helvetica limitation) | Pitfalls | International users get `?????` and file bug reports |
| A4 | Previous audit comparison scoped to same `suiteName` | Previous Run Loading | Cross-suite comparisons silently missing |
| A5 | HTML comments in markdown as layout hints for PDF renderer don't break downstream markdown parsers | Markdown → PDF Considerations | Dashboard markdown rendering shows HTML comment markers as text |
| A6 | Backwards-compat via `KINDLM_COMPLIANCE_LEGACY=1` env var is sufficient | Backwards Compatibility | Users with scripts parsing Article headers break without recourse |
| A7 | Per-test timestamps derivable from `startedAt + cumulative latencyMs` are auditable enough | Dated/Signed Test Logs | Auditors demand true per-test timestamps; requires runner refactor |
| A8 | "Not applicable" placeholder for Annex IV element 6 (discriminatory impact) satisfies the structural requirement | Annex IV Element Mapping | Auditors mark the report deficient; requires fairness metrics phase |

## Open Questions

1. **Does the snapshot test suite exist in another package that imports the compliance markdown?**
   - What we know: `packages/cloud/src/routes/compliance.test.ts` exists.
   - What's unclear: Whether it parses markdown content (would break) or just handles metadata blobs.
   - Recommendation: Grep in planning phase — `compliance\.test\.ts` and inspect before starting restructure.

2. **Is there a downstream consumer of the existing Article-structured markdown?**
   - What we know: None identified in this repo.
   - What's unclear: Whether `@kindlm/dashboard` renders the markdown verbatim (its compliance viewer).
   - Recommendation: Check `packages/dashboard` for markdown parsing of report body in discuss-phase.

3. **Should the TOC page be part of the markdown (element-aware) or PDF-only?**
   - What we know: TOC is inherently visual (page numbers only meaningful in PDF).
   - What's unclear: Whether users reading raw markdown want a TOC-like section.
   - Recommendation: TOC is PDF-only. Markdown gets a plain `## Contents` list of Annex IV element names without page numbers.

4. **Trend chart format: text delta only, or ASCII/unicode sparkline?**
   - What we know: Only 2 data points (current + previous) available from `last-run.json`.
   - What's unclear: Whether richer history should be surfaced (requires cloud API or local history log).
   - Recommendation: Text delta only for phase 26. Richer history is a cloud-tier feature deferred.

## Sources

### Primary (HIGH confidence)
- `/Users/petr/projects/kindlm/packages/core/src/reporters/compliance.ts` — current implementation (VERIFIED direct read)
- `/Users/petr/projects/kindlm/packages/cli/src/utils/pdf-renderer.ts` — PDF rendering path (VERIFIED direct read)
- `/Users/petr/projects/kindlm/packages/cli/src/commands/test.ts` lines 262-296 — `--compliance` / `--pdf` wiring (VERIFIED direct read)
- `/Users/petr/projects/kindlm/packages/core/src/config/schema.ts` lines 589-617 — `ComplianceSchema` (VERIFIED direct read)
- `/Users/petr/projects/kindlm/packages/core/src/reporters/compliance.test.ts` — existing test structure (VERIFIED direct read)
- `/Users/petr/projects/kindlm/.planning/research/v2.4-market-signal.md` Part 7 — Annex IV market research (CITED)
- https://artificialintelligenceact.eu/annex/4/ — EU AI Act Annex IV text (CITED)
- https://pdfkit.org/docs/text.html#page_buffering — pdfkit page buffering for TOC (CITED)

### Secondary (MEDIUM confidence)
- `.planning/research/v2.4-market-signal.md` Part 9.2 — lists "Compliance PDF executive summary" as P1 UX gap (internal prior research)

### Tertiary (LOW confidence / ASSUMED)
- All A1–A8 entries in Assumptions Log — need confirmation in discuss-phase or by user during planning

## Metadata

**Confidence breakdown:**
- Existing codebase audit: HIGH — direct reads of every referenced file.
- Annex IV structural requirements: HIGH — cross-referenced EU AI Act text and internal research.
- Risk bucket thresholds: LOW — assumed categorization, needs user confirmation.
- pdfkit TOC mechanics: MEDIUM — pdfkit docs verified, but not yet tested against this codebase's specific renderer.
- Backwards-compat impact: MEDIUM — no external parsers identified, but dashboard compliance viewer not inspected.

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — the codebase and Annex IV text are stable; only external consumer assumptions may shift)
