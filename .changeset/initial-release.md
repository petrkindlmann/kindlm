---
"@kindlm/core": minor
"@kindlm/cli": minor
---

Initial release of KindLM — behavioral regression testing for AI agents.

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
