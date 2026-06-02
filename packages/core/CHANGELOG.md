# @kindlm/core

## 2.3.2

### Patch Changes

- 06f7a73: Honesty + safety remediation (audit-driven). No breaking changes.

  **Safety fixes (behavior changes):**
  - **Cost gates no longer silently pass at $0** for unpriced models. When per-test cost is unknown (Mistral, Cohere, HTTP, or any unpriced model), `expect.cost.maxUsd` now fails with a `COST_UNKNOWN` code and a clear message instead of trivially passing. Previously a cost gate on an unpriced model looked enforced but wasn't.
  - **`baseline set` → `baseline compare` now works end-to-end.** `readBaseline` resolves the `{suite}-latest` pointer written by `baseline set`; previously it read a filename that was never written and always failed `BASELINE_NOT_FOUND`, making the drift-against-baseline feature unreachable.
  - **PII guardrail `enabled: false` is now honored.** It previously had no effect — the guardrail ran regardless and could flip a verdict/exit code.
  - **Judge token cost is now counted.** LLM-as-judge calls (3× under `betaJudge`) are billable; their cost is now folded into the reported per-test total instead of being discarded, so cost totals no longer undercount when judges are used.

  **Compliance honesty:**
  - The compliance report is retitled "EU AI Act — Annex IV **Documentation Draft**", carries a prominent "not legal advice" banner, and now includes the mandated Limitations & Disclaimer block (hash-covered, rendered into the PDF). The Article 10 section no longer overclaims data-governance coverage.

  **Packaging:**
  - Add `engines: { node: ">=20.0.0" }` to both `@kindlm/cli` and `@kindlm/core` (previously absent on the published packages, so Node 18 installed without warning).
  - The JSON reporter now includes `modelId` per test (previously dropped).
  - Ship the corrected `@kindlm/core` internal dependency pin (`^2.3.1`) to npm.

  **Docs:** READMEs corrected to match the real config schema, provider set (no Bedrock/Azure; Gemini key is `gemini`), CLI flags (no `--output`), and feature flags. See `docs/AUDIT_REALITY_VS_README.md`.

## 2.3.1

### Patch Changes

- b34582f: Fix a family of "false green" bugs where a misconfigured suite could pass when it should have failed.
  - **Strict config validation.** Unknown keys under `expect` (and its sub-objects) are now rejected instead of silently ignored. A typo like `toolCall` or `contians` previously disabled the assertion and let the test pass; you now get a clear error with a "did you mean…" suggestion for the closest valid key.
  - **`argsSchema` is now enforced.** Tool-call argument schemas referenced via `argsSchema` were parsed but never wired into the validator, so malformed arguments slipped through. The schema validator is now injected and arguments are validated against it.
  - **Opt-in tool-call ordering.** Added `toolCallsOrdered` so you can assert the order in which tools are invoked. Ordering is opt-in and off by default, so suites that only check presence are unaffected.
  - **Correct version in reports.** The JSON reporter stamped a placeholder version; it now records the real package version, so archived run artifacts are accurate.
  - **Expanded, configurable PII detection.** Guardrail PII detection now uses a named-detector registry — `ssn`, `credit_card` (Luhn-checked), `email`, `phone`, `iban` (mod-97-checked), `ip`, `jwt`, and `api_key` — selectable via a `detectors:` list. The Luhn and mod-97 checks cut false positives on credit-card and IBAN matches.

## 2.1.0

### Minor Changes

- 46f961d: KindLM v2.1.0 — `--concurrency` and `--timeout` CLI overrides for `kindlm test`, `betaJudge` multi-pass median scoring flag, `costGating` enforcement flag, `--isolate` now copies config and schema files into worktree.

## 2.0.0

### Major Changes

- 5dc5d1d: KindLM v2.0.0 — CLI enhancements (--dry-run, --watch, caching, HTTP provider), enterprise features (SAML XML parser, signed compliance, audit log, token rotation), infrastructure refactoring.

## 1.0.0

### Major Changes

- 30ca548: Initial stable release of KindLM v1.0.0

## 0.1.0

### Minor Changes

- 0abd80c: Initial release of KindLM — behavioral regression testing for AI agents.

  Features:
  - 11 assertion types: tool_called, tool_not_called, tool_order, schema, judge, no_pii, keywords_present, keywords_absent, drift, latency, cost
  - 6 provider adapters: OpenAI, Anthropic, Ollama, Google Gemini, Mistral, Cohere
  - 4 reporters: pretty terminal, JSON, JUnit XML, EU AI Act compliance
  - Baseline comparison and drift detection
  - Multi-run aggregation with configurable run count
  - Pass/fail gates for CI integration
  - YAML-based configuration with Zod validation
  - CLI commands: init, validate, test, baseline, login, upload
  - Cloud integration: login, upload results
