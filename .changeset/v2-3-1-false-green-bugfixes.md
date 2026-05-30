---
"@kindlm/core": patch
"@kindlm/cli": patch
---

Fix a family of "false green" bugs where a misconfigured suite could pass when it should have failed.

- **Strict config validation.** Unknown keys under `expect` (and its sub-objects) are now rejected instead of silently ignored. A typo like `toolCall` or `contians` previously disabled the assertion and let the test pass; you now get a clear error with a "did you mean…" suggestion for the closest valid key.
- **`argsSchema` is now enforced.** Tool-call argument schemas referenced via `argsSchema` were parsed but never wired into the validator, so malformed arguments slipped through. The schema validator is now injected and arguments are validated against it.
- **Opt-in tool-call ordering.** Added `toolCallsOrdered` so you can assert the order in which tools are invoked. Ordering is opt-in and off by default, so suites that only check presence are unaffected.
- **Correct version in reports.** The JSON reporter stamped a placeholder version; it now records the real package version, so archived run artifacts are accurate.
- **Expanded, configurable PII detection.** Guardrail PII detection now uses a named-detector registry — `ssn`, `credit_card` (Luhn-checked), `email`, `phone`, `iban` (mod-97-checked), `ip`, `jwt`, and `api_key` — selectable via a `detectors:` list. The Luhn and mod-97 checks cut false positives on credit-card and IBAN matches.
