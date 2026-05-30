# @kindlm/cli

## 2.3.1

### Patch Changes

- b34582f: Fix a family of "false green" bugs where a misconfigured suite could pass when it should have failed.
  - **Strict config validation.** Unknown keys under `expect` (and its sub-objects) are now rejected instead of silently ignored. A typo like `toolCall` or `contians` previously disabled the assertion and let the test pass; you now get a clear error with a "did you mean…" suggestion for the closest valid key.
  - **`argsSchema` is now enforced.** Tool-call argument schemas referenced via `argsSchema` were parsed but never wired into the validator, so malformed arguments slipped through. The schema validator is now injected and arguments are validated against it.
  - **Opt-in tool-call ordering.** Added `toolCallsOrdered` so you can assert the order in which tools are invoked. Ordering is opt-in and off by default, so suites that only check presence are unaffected.
  - **Correct version in reports.** The JSON reporter stamped a placeholder version; it now records the real package version, so archived run artifacts are accurate.
  - **Expanded, configurable PII detection.** Guardrail PII detection now uses a named-detector registry — `ssn`, `credit_card` (Luhn-checked), `email`, `phone`, `iban` (mod-97-checked), `ip`, `jwt`, and `api_key` — selectable via a `detectors:` list. The Luhn and mod-97 checks cut false positives on credit-card and IBAN matches.

- Updated dependencies [b34582f]
  - @kindlm/core@2.3.1

## 2.1.0

### Minor Changes

- 46f961d: KindLM v2.1.0 — `--concurrency` and `--timeout` CLI overrides for `kindlm test`, `betaJudge` multi-pass median scoring flag, `costGating` enforcement flag, `--isolate` now copies config and schema files into worktree.

### Patch Changes

- Updated dependencies [46f961d]
  - @kindlm/core@2.1.0

## 2.0.0

### Major Changes

- 5dc5d1d: KindLM v2.0.0 — CLI enhancements (--dry-run, --watch, caching, HTTP provider), enterprise features (SAML XML parser, signed compliance, audit log, token rotation), infrastructure refactoring.

### Patch Changes

- Updated dependencies [5dc5d1d]
  - @kindlm/core@2.0.0

## 1.0.0

### Major Changes

- 30ca548: Initial stable release of KindLM v1.0.0

### Patch Changes

- Updated dependencies [30ca548]
  - @kindlm/core@1.0.0

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

### Patch Changes

- Updated dependencies [0abd80c]
  - @kindlm/core@0.1.0
