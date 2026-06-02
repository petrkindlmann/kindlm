---
"@kindlm/cli": patch
"@kindlm/core": patch
---

Honesty + safety remediation (audit-driven). No breaking changes.

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
