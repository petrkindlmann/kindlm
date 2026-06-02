# KindLM — Reality vs README Audit

> **Verdict:** KindLM is a **genuinely-built core wrapped in a partly README-driven shell**. The execution engine, the six real provider adapters, the assertion handlers (tool-calls, judge, drift, PII, latency), the reporters, and the test suite (1673 passing tests against real mock HTTP servers) are real, tested, and good — this is not vaporware. But three of the loudest selling points are unsafe or fake: (1) the `@kindlm/core` npm README documents an **entire non-existent config schema, two non-existent providers (Bedrock/Azure), and a non-existent `isEnabled()` export** — copy-paste it and the tool rejects your config on line one; (2) the headline **`kindlm baseline set` → `compare` workflow is broken end-to-end** (writes one filename, reads another, always errors `BASELINE_NOT_FOUND`); (3) **cost budgets silently pass at $0** for Mistral/Cohere/HTTP/unknown models, and the **EU AI Act "compliance" report ships with no legal disclaimer** despite its own spec mandating one. So: the *engine* is production-quality; the *packaging, docs, and three flagship features* are README-driven or false-safe. A regulated or CI-trusting buyer who reads only the README is being materially misled. Fix the docs (cheap, one afternoon) and the four false-safety bugs (real work, ~1 week) and this becomes an honest, adoptable product.

## Severity summary

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 18 |
| Medium | 21 |
| Low | 58 |
| **Total** | **102** |

By status:

| Status | Count |
|--------|-------|
| implemented (confirmed real) | 33 |
| partial | 17 |
| fake-or-missing | 21 |
| inconsistent | 14 |
| overclaimed | 9 |
| unsafe | 3 |
| unclear (premise unsupported) | 1 |
| (skeptic-adjusted, counted above) | (10) |

---

## CRITICAL & HIGH findings

### CRITICAL

#### C1 — Cost budgets silently pass at $0 for unpriced models (false safety) [unsafe]
- **Claim:** "Fail tests that exceed token-cost thresholds" (`expect.cost.maxUsd`) — README.md:45, cli/README.md:19, core/README.md:19.
- **What's actually true:** When `estimateCost` returns `null` (any **Mistral**, **Cohere**, or **HTTP** provider — they have *no pricing table at all* — or any unknown model on a priced provider), `runner.ts:425` passes `costUsd: undefined`, which `cost.ts:11` coalesces to `0` via `?? 0`. `cost <= maxUsd` is then trivially true. A user who writes `expect.cost.maxUsd: 0.01` on a Mistral model **gets a green check while spending arbitrarily.** This is worse than no feature — it *looks* enforced.
- **Evidence:** `cost.ts:11` (`const costUsd = context.costUsd ?? 0`); `runner.ts:425`; `mistral.ts:245-251` / `cohere.ts:247-253` / `http.ts:325-328` (always `null`); `ollama.ts:208-210` (returns 0).
- **Remediation (implement-properly):** `cost.ts` must distinguish `undefined` (unknown) from `0` — emit a **failing/skipped** result `"cost unknown for this model"` when `context.costUsd` is undefined. Add Mistral/Cohere pricing or document that those providers do not support cost budgets. Add a `cost.test.ts` case for the undefined-cost path (currently never tested).

#### C2 — EU AI Act "compliance" report has no legal disclaimer; title overstates conformity [unsafe]
- **Claim:** "EU AI Act compliance — generate Annex IV documentation from test results" (README.md:46, cli/README.md:20,123, core/README.md:20). Generated artifact is titled "**EU AI Act — Annex IV Compliance Report**" stamping "Regulation 2024/1689" (`compliance.ts:61,64`).
- **What's actually true:** The report contains **no disclaimer** that it is not legal advice and does not constitute compliance. A user in a regulated context could reasonably believe `kindlm test --compliance` produces a conformity artifact. It does not — it is a test-results summary with an aspirational title. This is the highest-liability wording in the product and it is unhedged in both artifact and docs.
- **Evidence:** README.md:46, compliance.ts:61,64.
- **Remediation (downgrade-readme + implement-disclaimer):** Reword README to "generate a compliance-documentation **DRAFT** mapping test results to EU AI Act articles (not legal advice)" AND inject the disclaimer **the spec already mandates** (06-COMPLIANCE_SPEC.md:239-241) into the generated report.

#### C3 — Mandated compliance disclaimer/limitations block is entirely absent [fake-or-missing]
- **Claim:** Spec (06-COMPLIANCE_SPEC.md:239-241, 359-371) requires the report to state "It does not constitute legal advice… consult qualified legal professionals" and list limitations (does NOT cover all Annex IV, does NOT provide legal interpretation, does NOT replace conformity assessment by notified bodies).
- **What's actually true:** `grep` for `legal advice|disclaimer|consult|notified|conformity|not constitute` across `compliance.ts` and `pdf-renderer.ts` returns **zero matches**. The report body ends at `compliance.ts:163` with metadata only — no disclaimer block. The implementation diverged from its own spec and shipped a legal-titled document with no caveat.
- **Evidence:** 06-COMPLIANCE_SPEC.md:239-241,359-371 vs compliance.ts:59-165.
- **Remediation (implement-properly):** Append the disclaimer + limitations block to the section list in `compliance.ts` before the hash footer (so it appears in markdown and PDF). Add a test asserting the disclaimer string is present.

#### C4 — `baseline set` → `compare` is broken end-to-end [fake-or-missing]
- **Claim:** `kindlm baseline set` then `kindlm baseline compare` compares latest run against saved baseline (README "comparison against saved baselines"; CLAUDE.md).
- **What's actually true:** `writeBaselineVersioned` (`store.ts:214-230`) writes `{suiteName}-{timestamp}-{nonce}.json` and a `{suiteName}-latest` pointer **only**. `readBaseline` (`store.ts:189-196` + `baseline-io.ts:14-15`) reads `{suiteName}.json` — a key **never written**, and **no code resolves the `-latest` pointer**. **Empirically reproduced:** after `set`, disk holds `my-suite-20260602122018-4d823c.json` + `my-suite-latest.json`; `compare` reads `my-suite.json` → `BASELINE_NOT_FOUND`, exit 1. The drift-against-baseline feature is **unreachable through the CLI**. Masked because `store.test.ts` only tests the *unused* `writeBaseline` path, never `writeBaselineVersioned → readBaseline`, and no integration test references baseline at all.
- **Evidence:** baseline.ts:80,134,137; store.ts:189-196,214-230; baseline-io.ts:14-15.
- **Remediation (implement-properly):** Make `readBaseline` resolve the `{suiteName}-latest` pointer (or have `writeBaselineVersioned` also write `{suiteName}.json`). Add a unit test for the real write→read path and a CLI integration test for `set`→`compare`.

#### C5 — `@kindlm/core` README Quick Start config is a non-existent schema [fake-or-missing]
- **Claim:** core/README.md:66-104 Quick Start uses `version: "1"`, `defaults.provider: openai:gpt-4o`, `suites:` (plural array), `system_prompt:`, and `assert: [{type: tool_called, value: ...}]`.
- **What's actually true:** The real Zod schema (`schema.ts:737-797`) requires `kindlm: 1` (literal number), singular `suite:` object, separate `providers:`/`models:` blocks, `prompts:` map, and `expect:` (not `assert:`) with `toolCalls:`. The `.strict()` schema **rejects every field** in the core README example. A user copying it hits `CONFIG_VALIDATION_ERROR` on the first run. The CLI README (cli/README.md:51-94) and root README are the correct ones; the core README is stale pre-2.x fiction. This is the most damaging inconsistency because the core README **is the npmjs.com landing page for `@kindlm/core`.**
- **Evidence:** core/README.md:66-104 vs schema.ts:737-797; correct format proven by `kindlm init` (init.ts:7-51).
- **Remediation (downgrade-readme):** Replace the entire core README Quick Start with the real `kindlm: 1` shape from cli/README.md:51-94.

### HIGH

#### H1 — `@kindlm/core` README advertises AWS Bedrock as a supported provider [fake-or-missing]
- **Claim:** core/README.md:31 lists "AWS Bedrock" with config `bedrock:anthropic.claude-...`.
- **Actually true:** No `bedrock.ts` adapter exists; `registry.ts:13-20` has no `bedrock` factory; `schema.ts:178` enum has no `bedrock`. `provider: bedrock` fails Zod validation before any code runs. The `bedrock:model` colon syntax is also not the real config shape.
- **Remediation (downgrade-readme):** Remove the Bedrock row unless a real adapter + registry entry + schema enum + tests are implemented.

#### H2 — `@kindlm/core` README advertises Azure OpenAI as a first-class provider [fake-or-missing]
- **Claim:** core/README.md:32 lists "Azure OpenAI" with config `azure:my-gpt4o-deployment`.
- **Actually true:** No `azure.ts`, no `azure` factory, no enum entry. Azure works *only* indirectly via the `openai` adapter + custom `baseUrl` (schema.ts:46-52, openai.ts:91) — NOT the deployment-routing + `api-version` provider the README implies. `provider: azure` fails Zod validation.
- **Remediation (downgrade-readme):** Replace with a note that Azure works via `openai` + `baseUrl`, or implement a real adapter.

#### H3 — Root/core README provider tables list Bedrock+Azure (skeptic-corrected to core README) [overclaimed]
- The Bedrock/Azure overclaim lives in **`packages/core/README.md:31-32`**, not the root README (root README:52-60 correctly lists OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, MCP). Same defect as H1/H2; severity high because it's a published npm README.

#### H4 — core README documents a fictional config format for tool-call assertions [fake-or-missing]
- core/README.md:66-86 uses `version`/`suites`/`assert: [{type: tool_called, value}]`/`no_pii`. The `.strict()` schema rejects all of it. Root + CLI READMEs are correct. **Remediation:** rewrite to `expect.toolCalls[]` with `tool/argsMatch/argsSchema/order`.

#### H5 — core README documents a fictional config format for judge assertions [inconsistent]
- core/README.md:66-101 uses `type: judge`/`threshold: 0.8` inside a `suites/assert` block. Real schema is `expect.judge[].minScore` (no `threshold` field exists in `JudgeCriterionSchema`). Copy-paste → Zod errors. **Remediation:** mirror cli/README.md:84-93.

#### H6 — Judge token cost is discarded; cost gates undercount [fake-or-missing]
- **Claim/reality:** The judge makes a real billable LLM call (3× under `betaJudge`), but `judge.ts:104-111,166-180` never reads `response.usage`. Runner cost is solely the completion call (`runner.ts:504`). Per-test cost and the `cost.maxUsd` gate **systematically undercount** whenever judge assertions are used.
- **Remediation (implement-properly):** Capture judge `response.usage`, run through `estimateCost`, add to `costUsd` (or a `judgeCostUsd`); sum across all 3 betaJudge passes.

#### H7 — PII `enabled: false` is a no-op; guardrail cannot be turned off [fake-or-missing]
- `registry.ts:91` gates on object truthiness (`if (expect.guardrails?.pii)`), never reads `pii.enabled`. Setting `enabled: false` **does not disable detection** — the assertion still runs and can flip a verdict/exit code. The schema field (`schema.ts:246`) is read nowhere in core.
- **Remediation (implement-properly):** Change `registry.ts:91` to `if (expect.guardrails?.pii?.enabled)`; add a test for `enabled:false` producing no assertion.

#### H8 — `betaJudge` feature flag documented under wrong JSON key (`flags` vs `features`) [inconsistent]
- core/README.md:40-46 shows `{ "flags": { "betaJudge": true } }`; loader reads `parsed["features"]` (`features.ts:38`). A user following the README has the flag **silently ignored** (stays false). Same defect repeated across config and boundaries dimensions.
- **Remediation (downgrade-readme):** Change `"flags"` → `"features"` in core/README.md:41.

#### H9 — `--output <path>` flag is documented but does not exist [fake-or-missing]
- cli/README.md:122 lists `--output <path>` "Write report to file"; `test.ts:73-85` registers no such option. Commander v13 **rejects unknown flags** — verified: `kindlm test --reporter junit --output results.xml` (the CLI README's own CI example at line 137, and core README:111) **errors before any test runs.** Report output only goes to stdout (`test.ts:288`). Root README dodges this with `> junit.xml` (the correct pattern).
- **Remediation:** Either implement `-o, --output <path>` writing `report.content`, OR delete the row and replace `--output results.xml` with `> results.xml`.

#### H10 — JUnit `--output` claim contradicts itself across the repo [fake-or-missing]
- Same root cause as H9; CLI README and some doc examples use `--output` while `docs/26-CI_GUIDE.md:42` and root README:151 use `> file.xml`. The docs disagree with themselves.

#### H11 — GitLab CI example uses four flags/args that do not exist [fake-or-missing]
- `docs/08-CLI_REFERENCE.md:397`: `kindlm test kindlm.yaml --format json --junit junit.xml --out kindlm-report.json`. None of `--format`, `--junit`, `--out`, or a positional config arg exist (it's `--reporter`, `-c/--config`). Reporters are mutually exclusive, so simultaneous JUnit+JSON is impossible. Copy-paste fails immediately.
- **Remediation:** Rewrite to `kindlm test --reporter junit -c kindlm.yaml > junit.xml`.

#### H12 — Drift assertions always fail in the primary `kindlm test` command [partial]
- `test.ts:271` calls `runTests` **without** `baselineData`; `runner.ts:435-441` only sets `context.baselineText` when a baseline is present. So `expect.baseline.drift` in `kindlm test` **always fails** "No baseline available" (`drift.ts:106-118`). Only `baseline compare` injects a baseline — and that path is broken (C4). There is **no working CLI path** that feeds a baseline to a drift assertion.
- **Remediation (implement-properly):** Have `kindlm test` auto-load the latest baseline (after fixing C4) and inject it, or document the requirement. Depends on C4.

#### H13 — Compliance report makes a false Article 10 (data governance) coverage claim [inconsistent]
- `compliance.ts:88-92` emits "Article 10 — Data and Data Governance" asserting PII guardrails verify personal data — directly contradicting the spec's own statement that Art 10 is "Not covered (training data out of scope)" (06-COMPLIANCE_SPEC.md:18). Conflates runtime output-PII with Annex-IV training-data governance; misleads auditors.
- **Remediation (implement-properly):** Remove or rename the section to "Output PII guardrail evidence — note: Annex IV data-governance is out of scope."

#### H14 — "Annex IV documentation" is substantially overclaimed [overclaimed]
- `compliance.ts:80-130` emits only Articles 9/10/12/13/15 as 1-2 sentence boilerplate + a gate dump. No Article 11 (the actual Annex IV article), no models/provider table, no intended-use, no limitations, no human-oversight (Art 14), no datasets/development-process. The rich spec template (06-COMPLIANCE_SPEC.md:45-244) is **not implemented.** It is a test summary wearing Annex IV headers.
- **Remediation (downgrade-readme):** Describe it as "maps test/gate results to selected EU AI Act articles (9,10,12,13,15)" or implement the spec template.

#### H15 — Published `@kindlm/cli@2.3.1` still pins `@kindlm/core: "*"` [inconsistent]
- Local `package.json:52` has `^2.3.1` (fixed in PR #13) but `npm view @kindlm/cli@2.3.1 dependencies` shows `@kindlm/core: '*'` — **the fix is committed but unreleased.** Today `*` resolves to core@2.3.1 so it works, but a future core@2.4.0 breaking release before a matching CLI will break `npm i @kindlm/cli@2.3.1` at runtime.
- **Remediation:** Cut a patch (2.3.2) so the `^2.3.1` pin reaches npm; fix the CLAUDE.md `"*"` convention.

#### H16 — `isEnabled()` is documented as a `@kindlm/core` export but does not exist there [fake-or-missing / overclaimed]
- core/README.md:35-55 documents an `isEnabled()` export and `.kindlm/config.json` flags subsystem. `grep isEnabled packages/core/src` = 0; runtime `require('@kindlm/core').isEnabled` = `undefined`. The helper lives in `packages/cli/src/utils/features.ts:53` (it uses `readFileSync`/`process.cwd()` — I/O that cannot live in zero-I/O core). Importing from core → TypeError.
- **Remediation (downgrade-readme):** Move the feature-flag section to cli/README.md and attribute it to `@kindlm/cli`; fix the two-arg signature.

#### H17 — `costGating` flag gates the wrong mechanism [overclaimed]
- core/README.md:52 claims `costGating` enforces `expect.cost.maxUsd` (per-test). It does NOT: `run-tests.ts:179-181` only strips suite-level `config.gates.costMaxUsd`. The per-test `createCostAssertion` (`registry.ts:146-150`) runs **unconditionally** regardless of the flag. So with `costGating` off (default), per-test cost assertions still execute — contradicting the docs.
- **Remediation:** Make README + code agree — either reword to "gates the suite-level run budget" or also gate `createCostAssertion` behind the flag.

#### H18 — core README Quick Start config (config dimension, same as C5) [fake-or-missing]
- Duplicate of C5 from the config dimension lens; counted once in severity table. The single most-cited defect — the core README's entire config DSL (`version`/`suites`/`assert`) is rejected by the parser.

---

## Per-dimension findings (the rest)

### Providers
- **Three READMEs disagree on the provider list** [inconsistent, med]: root lists 7 (incl. MCP), cli lists 6 (omits MCP), core lists 7 with a *different* set (omits Mistral/Cohere, invents Bedrock/Azure). Real set is **8 keys**: `openai, anthropic, ollama, gemini, mistral, cohere, http, mcp`. No README mentions the fully-implemented **`http`** provider.
- **Gemini key is `gemini`, not `google`** [overclaimed, med]: all three READMEs show `google:gemini-2.0-flash`; `provider: google` fails the enum (schema.ts:178). The adapter itself is fully real and tested.
- **Six core adapters are solid** [partial→implemented, low]: OpenAI/Anthropic/Gemini/Mistral/Cohere/Ollama all implement complete/estimateCost/supportsTools with tool-call mapping, per-provider error handling, and `.test.ts` + `.resilience.test.ts`. Caveats: only OpenAI implements `embed`; Mistral/Cohere `estimateCost` return null; `maxRetries` hardcoded to 2 (`init-adapters.ts:126`).
- **MCP passthrough works** [partial, low]: real HTTP POST with retry/timeout/error-mapping, 18 tests. Caveat: it sends a bespoke `{toolName, arguments:{...}}` shape, not the MCP spec's JSON-RPC `tools/call` envelope — so "any MCP server" is a slight overclaim. `supportsTools` false, usage zero, cost null (honest, not README-claimed).

### Tool-calls
- **Strong and well-tested.** Exact-tool-called, ordering (numeric `order:` + opt-in `toolCallsOrdered`), `shouldNotCall`, partial `argsMatch` with per-field diffs, nested matching, and provider normalization are all genuinely **implemented** [low].
- **`argsSchema` validation** [partial→implemented, med]: end-to-end real; integration-tested at `runner.test.ts:799-827` (skeptic corrected the auditor's "untested" claim). Gap: `evaluateArgsSchema` (`tool-calls.ts:91-109`) **discards the AJV error list** and emits a generic "did not match argsSchema" — user isn't told *which* field failed. **Fix:** surface `validator.errors[]`.
- **No "called N times" assertion** [fake-or-missing, low] — but not claimed in any README, so no action.
- **`argsMatch` is partial-only** [partial, low]: full/exact match requires `trajectory` or `argsSchema` + `additionalProperties:false`; clarify in docs.
- Minor: OpenAI/Cohere/Mistral hardcode `index:0` per call (harmless — conversation runner re-indexes); malformed-JSON args fall back to `{_raw}` without a clear assertion message.
- README failure-message sample (`✗ tool_called: expected lookup_order, got cancel_order`) is stylized, not literal output [overclaimed, low].

### Compliance
- Beyond C2/C3/H13/H14: **PDF export is genuinely implemented** with pdfkit [implemented, low], but **gating tables are wrong** — local `--pdf` ships free with no plan gate, while 06-COMPLIANCE_SPEC.md:389 + CLAUDE.md mark PDF as paid Team/Enterprise. Reconcile (user-favorable, but docs lie).
- **PDF rendering is effectively untested** [partial, med]: `pdf-renderer.test.ts` re-implements a *divergent copy* of the parser and tests the copy, not the shipped `renderCompliancePdf`. **Fix:** export the parsing helpers and add one integration test producing a real `%PDF`.
- **"Markdown works without pdfkit" claim is technically false** [skeptic-adjusted, low]: `test.ts:18` statically imports `renderCompliancePdf`, which statically imports `pdfkit` — so a missing pdfkit crashes the *entire* CLI at module load. Mitigated only because pdfkit is a hard (non-optional) dependency. Functionally fine in any real install.

### Judge
- **Core flow is real and tested** [implemented, low]: deterministic system prompt, temp 0, structured `{score, reasoning}` JSON, validated 0-1, configurable judge model (per-criterion + `defaults.judgeModel`).
- **Parser is not crash-proof** [partial, low]: ```` ```json\nnull\n``` ```` produces an uncaught `TypeError` (`judge.ts:62` reads `.score` on `null`). Process survives via the engine's outer try/catch but reports a confusing `INTERNAL_ERROR` instead of the designed `JUDGE_PARSE_ERROR`.
- **Greedy JSON extraction regex** [partial, med]: `/(\{[\s\S]*\})/` grabs first `{` to last `}` — trailing prose or two objects → spurious `JUDGE_PARSE_ERROR`/score 0. **Fix:** non-greedy/balanced-brace scan; add a trailing-prose test.
- **Judge not presented as probabilistic in READMEs** [overclaimed, med]: deep docs say so; the three primary READMEs show `✓ judge: 0.92 ≥ 0.8` as a stable measurement. Add a one-line caveat.
- **No `--no-judge` CLI flag** [fake-or-missing, med]: `betaJudge` *adds* a 3-pass median (opposite of disabling). To skip judging you must edit YAML.
- **`betaJudge` under-documented** [overclaimed, low]: it 3×'s judge cost with a 2/3 quorum; README says vague "scoring improvements."

### Drift
- **Embedding/field-diff/judge methods are all real and tested** [implemented, low] — embedding via real OpenAI `/embeddings`, deterministic field-diff, mismatched-field reporting.
- **Embedding cost is invisible** [fake-or-missing, med]: each embedding-drift assertion makes 2 extra `/embeddings` calls whose cost is never tracked or gated. `getEmbedding` has no cost channel (`interface.ts:57`).
- **`docs/08-CLI_REFERENCE.md:167-179` baseline docs are fiction** [inconsistent, med]: documents `set <report.json> --label`, `compare --baseline`, and a `remove` subcommand — none exist. Real commands re-run the live suite and key by suite name.
- **No `--update-baseline` flag** [fake-or-missing, low] — not in any audited README.

### PII
- **Redaction & no-leak design is correct end-to-end** [implemented, low]: terminal, JSON, JUnit, and cloud upload all carry only redacted values; raw PII never leaves. Headline safety property holds. (Minor: `redact()` reveals first-2/last-2 chars.)
- **README overclaims default coverage** [overclaimed, med]: README says "SSNs, credit cards, emails, phone numbers, IBANs"; **default path detects only SSN/CC/email** — phone/IBAN require opt-in `detectors:`. Default also misses undashed SSNs.
- **False-positive-prone regexes** [partial, med]: named `ssn` matches any bare `\d{9}`; default-path CC has **no Luhn check** (only the named `credit_card` detector validates). Can fail tests on benign numbers.
- **`denyPatterns`/`customPatterns`/`detectors` configurable + ReDoS-guarded** [implemented, low] — 36/36 tests pass.
- **Detector inventory undersold** [inconsistent, low]: 8 detectors ship (`ssn, credit_card, email, phone, iban, ip, jwt, api_key`); README lists 5. **Update** README upward.

### Config
- `.kindlm/config.json` is a **real, narrow settings file** [implemented, low] (features + `cacheTtlMs`), distinct from `kindlm.yaml` and from the run-snapshot `config.json` under `.kindlm/runs/`. Only defect is the `flags`/`features` key mismatch (H8).
- **`kindlm init` scaffolds the correct schema** [implemented, low] — proves `kindlm: 1` is the genuine format and the core README is simply stale.

### CLI flags
- **No `doctor`/`report` command** [unclear, low]: confirmed absent, but **not actually claimed** in any current README, so no action.
- **`-s/--suite`** [partial, low]: config has exactly one suite, so the flag only *asserts the name matches* — it cannot select among multiple suites. Reword.
- **`--isolate`** [partial, med]: create/cleanup are **safe and well-tested** (29 tests, fail-closed, no destructive force-remove of dirty trees). BUT "clean environment" overclaims — `copyFilesToWorktree` copies **only** the YAML + referenced schema files, NOT agent code/node_modules/env. On git failure it **silently degrades to a non-isolated run** (`test.ts:263-267`), so a user can believe they ran isolated when they didn't. **Fix docs + make silent fallback opt-in.**
- `--concurrency`/`--timeout`/`--reporter`/`--compliance`/`--pdf`/`--runs`/`--gate` all **implemented + validated** [low]. Exit codes correct (0 pass / 1 fail / 130 SIGINT) [implemented]. **No secrets printed** by auth commands [implemented]. No `--debug` flag exists, so "stack trace leak" concern is moot.
- **`cache` and `redteam` commands ship undocumented** [inconsistent, med]; so do `--dry-run`/`--watch`/`--no-cache`/`-c`. Meanwhile a non-existent flag (`--output`) IS documented.

### Reporters
- **JUnit reporter is the strongest** [implemented, low]: well-formed, correct escaping, strips XML-illegal control chars, gates as synthetic testsuite. No defects.
- **Pretty reporter is feature-complete** [implemented, low]: 40 tests; color injected via interface (zero-I/O honored). Only the README *sample text* is out of date [overclaimed, low].
- **JSON reporter is usable but incomplete** [partial, med]: **drops `modelId`** despite it being available (`runner.ts:76` vs `json.ts:29-47`) — a real omission. Also missing: project name, run id, per-test provider, structured tool-call trace, response text. **No documented JSON schema for the report** [fake-or-missing, med] — the integration surface has no published contract.
- `docs/08-CLI_REFERENCE.md:323-344` JUnit doc sample is **hand-written fiction** [inconsistent, low]: real output is `name="KindLM"`, includes `errors=`, one testsuite per config suite (not per model).

### Cost / latency
- **C1 (unsafe)** above is the headline.
- **`gates.costMaxUsd` mid-run abort is best-effort** [partial, med]: under concurrency it can overshoot by up to (concurrency-1) in-flight calls; unknown-cost models never advance the budget. README says "aborts if exceeded" — reword.
- **Cost totals coerce unknown to $0 and report a precise figure** [partial, med]: a mixed OpenAI+Mistral run reports an exact `$X.XXXX` that silently omits Mistral spend. No "partial/unknown" indicator. **Fix:** track `costKnown`; render `>= $X (partial — N models unpriced)`.
- **Per-turn `expect.cost` is a silent no-op** [fake-or-missing, med]: conversation-turn context omits `costUsd` (`runner.ts:515-521`), so turn cost budgets always pass.
- **Pricing tables sparse/uneven** [partial, med]: OpenAI 4 models, Anthropic 3, Gemini 5; **Mistral/Cohere zero**; no embeddings pricing; no date stamp for staleness.
- **Latency budgets work** [implemented, low]: real wall-clock latency, correct comparison. Nit: breach reuses `PROVIDER_TIMEOUT` failure code (conflates slow-but-OK with actual timeout).

### npm packaging
- **`npx @kindlm/cli init` works against the built package** [implemented, low] — bin resolves, executable bit set, version baked in, init+validate pass in a clean dir.
- **exports map types-first + dual ESM/CJS** [implemented, low] — but skeptic found the **CLI's `import` (ESM) entry is non-functional** (`dist/index.js` throws "Dynamic require of process" — missing the `createRequire` banner the bin gets). Low impact: CLI is consumed as a binary, and core works both ways.
- **No `engines` field on published packages** [fake-or-missing, med]: root + CLAUDE.md claim Node≥20 enforced, but `@kindlm/cli`/`@kindlm/core` carry no `engines`, so Node 18 installs without warning. **Fix:** add `"engines": {"node": ">=20.0.0"}` to both.
- **`files`/deps placement correct** [implemented, low]; minor: ~2MB sourcemaps dominate the tarball. **homepage (kindlm.com) ≠ README docs link (kindlm.dev)** [inconsistent, low]; `repository.url` should be `git+https://...`.

### Boundaries & tests
- **Zero-I/O core boundary genuinely upheld** [implemented, low]: no `console`/`fs`/`fetch`/`process` in core; HTTP via injected `HttpClient`. CLI's `../cloud/*` is its own client, not the Workers package.
- **Test suite is substantive and honest** [implemented, low]: 1673 passing, real mock HTTP servers, full YAML→provider→assertion→exit-code path, ~2.2 assertions/test; only real-key tests are gated `skipIf(!OPENAI_API_KEY)`.
- **Documented tech debt is stale** [fake-or-missing, low]: CLAUDE.md's "5 failing scenarios.test.ts" no longer exist — suite is green. **Remove the note.**
- **`redteam/` module ships undocumented** [partial, low]: a full OWASP subsystem with tests, absent from all READMEs + the CLAUDE.md core-module list. Two TODOs (`generate.ts:43,286`) mean redteam usage/cost isn't fully wired. Document once stable.

---

## The README lies (must-fix before next publish)

Every item below is fake/overclaimed. Honest replacement wording in **bold**.

1. **core/README.md:31** — "AWS Bedrock | `bedrock:anthropic.claude-...`" → **DELETE the row.** No Bedrock adapter exists.
2. **core/README.md:32** — "Azure OpenAI | `azure:my-gpt4o-deployment`" → **"Azure OpenAI — use the `openai` provider with a custom `baseUrl` pointed at your Azure endpoint."**
3. **All three READMEs** — `google:gemini-2.0-flash` → **`gemini` (provider key is `gemini`, not `google`); models are configured under separate `providers:`/`models:` blocks, not `provider:model` shorthand.**
4. **core/README.md:66-104** — the entire `version: "1"` / `suites:` / `assert: [{type, value}]` Quick Start → **replace verbatim with the `kindlm: 1` / `suite:` / `providers:` / `models:` / `prompts:` / `tests[].expect` format from cli/README.md:51-94.**
5. **core/README.md:40-46** — `{ "flags": { "betaJudge": true } }` → **`{ "features": { "betaJudge": true } }`** (loader reads `features`).
6. **core/README.md:35-37** — "`isEnabled()` exported from `@kindlm/core`" → **"Feature flags are provided by `@kindlm/cli`; `isEnabled(flags, name)` is a CLI helper."**
7. **core/README.md:52** — "costGating: Enforce `expect.cost.maxUsd` gates" → **"costGating: enforce the suite-level `gates.costMaxUsd` run budget (per-test `expect.cost.maxUsd` always runs)."**
8. **cli/README.md:122 + cli/README.md:137 + core/README.md:111** — `--output <path>` / `--output results.xml` → **DELETE the flag row; use shell redirection `> results.xml`.**
9. **docs/08-CLI_REFERENCE.md:397** — `--format json --junit junit.xml --out ...` → **`kindlm test --reporter junit -c kindlm.yaml > junit.xml`** (single reporter; no `--format`/`--junit`/`--out`/positional arg).
10. **docs/08-CLI_REFERENCE.md:167-179** — baseline `set <report.json> --label` / `compare --baseline` / `remove` → **rewrite to the real config-based `set`/`compare`/`list` (no file arg, no `--label`/`--baseline`, no `remove`).**
11. **README.md:46 + cli/README.md:20 + core/README.md:20** — "EU AI Act compliance — generate Annex IV documentation" → **"generate a compliance-documentation *draft* mapping test/gate results to selected EU AI Act articles (9,10,12,13,15). Not legal advice; does not constitute conformity."**
12. **README.md:45 etc.** — "fail tests that exceed token-cost thresholds" → **"fail tests that exceed cost thresholds *for priced models* (OpenAI/Anthropic/Gemini subset); Mistral/Cohere/HTTP and unknown models are not yet cost-tracked."**
13. **README.md:15 / core/README.md:15** — "catch leaked SSNs, credit cards, emails, phone numbers, IBANs" → **"default detection covers SSN, credit card, email; phone, IBAN, IP, JWT, API-key require opt-in `detectors: [...]`."**
14. **cli/README.md flags table** — add the real `cache` and `redteam` commands and the `--dry-run`/`--watch`/`--no-cache`/`-c` flags; mark `--isolate` as "copies config + referenced schema files into a detached-HEAD worktree (not your full working tree)."
15. **.claude/CLAUDE.md "Current State"** — "5 pre-existing integration test failures" → **DELETE; suite is green (1673 passing).**

---

## Recommended remediation order

> Mapped to the 18 task steps. **DR** = downgrade README now (cheap, honest, hours). **IMPL** = implement feature (real work, days).

1. **[DR] Rewrite `@kindlm/core` README** (steps: config, providers, judge, npm-packaging). Fixes C5/H1/H2/H4/H5/H8/H16/H17 and ~8 inconsistencies in one file. Highest leverage — it's the npm landing page and is the source of most "fake" findings.
2. **[DR] Fix the `--output` lie everywhere** (steps: cli-flags, reporters). H9/H10/H11 — delete the flag rows, switch CI examples to `> file.xml`. Stops copy-paste-broken CI snippets.
3. **[IMPL] Fix `baseline set` → `compare`** (step: drift). C4 — resolve the `-latest` pointer in `readBaseline`; add the missing write→read test + CLI integration test. Unblocks the entire drift/baseline feature (H12).
4. **[IMPL] Make cost-unknown a failure/skip, not a $0 pass** (step: cost-latency). C1 — `cost.ts` distinguish undefined from 0; add the test. Removes the false-safety guarantee.
5. **[IMPL] Inject the compliance disclaimer + limitations block** (step: compliance). C3 — append spec block to `compliance.ts`; add presence test. **[DR]** reword "compliance" → "draft" (C2). Removes the highest-liability exposure.
6. **[IMPL] Honor PII `enabled:false`** (step: pii). H7 — one-line registry fix + test. A guardrail the user explicitly disabled must not flip exit codes.
7. **[DR] Reword cost + PII README claims** (steps: cost-latency, pii). #12/#13 — disclose priced-model-only cost gating and default detector coverage.
8. **[IMPL] Track judge + embedding cost** (steps: judge, drift). H6 + embedding-cost — capture `response.usage`, feed `estimateCost`, sum betaJudge passes.
9. **[DR] Fix Article 10 + Annex IV overclaim** (step: compliance). H13/H14 — rename/remove Art 10, reword "Annex IV documentation."
10. **[IMPL] Add `engines: node>=20` to both published packages + cut 2.3.2** (step: npm-packaging). H15/engines — fixes the `*` pin reaching npm and the missing engines floor.
11. **[IMPL] Harden judge parser** (step: judge). Non-greedy/balanced JSON extraction + guard the `null` case; surface `argsSchema` AJV errors (tool-calls).
12. **[DR] Clarify `--isolate`, `-s/--suite`, JSON-report contract, JUnit doc sample, baseline docs** (steps: cli-flags, reporters, drift). Remaining inconsistencies. Add `cache`/`redteam` to CLI README; remove stale tech-debt note.
13. **[IMPL, lower] Add Mistral/Cohere pricing, JSON report schema, modelId in JSON, PDF integration test, per-turn cost handling.** Quality hardening once the lies are gone.

---

## Product score (1-10)

| Dimension | Score | Note |
|-----------|-------|------|
| Usefulness | 7 | Tool-calls, judge, PII, JUnit, exit codes all genuinely work — solves a real CI problem. |
| Trustworthiness | 4 | Engine trustworthy; **cost gates false-safe, compliance unhedged, baseline broken** drag it down hard. |
| README clarity | 3 | core README is actively false; three READMEs disagree; broken CI examples. |
| Developer experience | 6 | `init`/`validate`/`test` are smooth; pretty reporter excellent; but copy-paste from core README fails immediately. |
| CI readiness | 6 | Exit codes + JUnit are solid; undermined by the fake `--output` flag in documented CI snippets. |
| Provider coverage | 6 | 6 real adapters + http + mcp = good; 2 advertised providers (Bedrock/Azure) are fiction. |
| Compliance credibility | 2 | Legal-titled artifact with no disclaimer, false Art 10, missing 80% of Annex IV. Liability risk. |
| Chance of adoption | 5 | Real product underneath, but README-driven first impression on npm will burn early evaluators. |

### 10 highest-leverage improvements to grow ~170 → 2000+ weekly downloads (in-product, concrete)

1. **Rewrite the `@kindlm/core` README to the real schema** — it's the npm landing page; today it hands every evaluator a config that errors on run 1. Single biggest credibility leak.
2. **Ship a `examples/` repo + a `kindlm init --template <tool-calls|judge|pii|ci>`** that produces a passing run against a mock/Ollama model with **no API key**, so a new user gets a green check in 60 seconds before paying for tokens.
3. **Fix `baseline set→compare` and surface drift in `kindlm test`** — "behavioral regression testing" is the tagline; the regression-baseline workflow currently can't run. Make the headline promise true.
4. **Make cost gates honest** — turn the silent $0 pass into an explicit "cost unknown (model unpriced)" line and add Mistral/Cohere pricing. CI users adopt tools they can *trust to fail*.
5. **Add a copy-paste GitHub Actions template** (`.github/workflows/kindlm.yml`) using the *working* `> junit.xml` pattern + `actions/upload-artifact`, linked from the README badge. CI integration is the adoption funnel.
6. **Publish a documented JSON-report schema** and add `modelId`/`project`/`runId` — let people build dashboards on KindLM output; integration surfaces drive retention.
7. **Add a `kindlm doctor`-style preflight** (validate config + API key reachability + provider/model pricing coverage) so first-run failures are diagnosed, not cryptic. Reduces churn at the riskiest moment.
8. **Reword the compliance feature as a "draft, not legal advice" and ship the disclaimer** — then it's a *legitimate* differentiator for regulated teams instead of a liability that scares off serious buyers.
9. **A 30-second asciinema demo + a real "what breaks looks like this" failure-output screenshot in the README** — show the per-field arg diff and tool-call trace; the failure UX is genuinely good and undersold.
10. **Trust signals in the README:** real test count badge (1673 passing), "zero-I/O core" architecture note, accurate provider matrix, and an honest "what's not yet supported" table. Buyers reward stated limits over silent gaps — and it ends the README-driven first impression.

---

*Audit basis: 102 verified findings (VERIFIED survived adversarial skeptic; SKEPTIC-ADJUSTED corrected in place). All citations are to files in this repo at the audited revision.*
