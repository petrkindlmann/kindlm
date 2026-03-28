# @kindlm/cli

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
