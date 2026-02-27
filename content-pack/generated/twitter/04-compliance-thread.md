# Twitter Thread: EU AI Act for Developers

---

**Tweet 1 (Hook)**

The EU AI Act is coming. Here's what you need to know as a developer.

Not the legal summary. The practical "what do I actually have to build" version.

---

**Tweet 2 (Timeline)**

Timeline that matters:

- Aug 2024: AI Act entered into force
- Feb 2025: Bans on unacceptable-risk AI active
- Aug 2025: General-purpose AI rules active
- Aug 2026: Full enforcement for high-risk systems

August 2026 is YOUR deadline. Annex IV documentation required.

Penalties: up to 35M EUR or 7% of global revenue.

---

**Tweet 3 (What Annex IV requires)**

Annex IV requires documented testing evidence:

- Testing methodologies used
- Quantitative metrics and results
- Robustness and edge case testing
- Safety guardrail validation
- Statistical significance

Translation: you need automated tests with recorded results.

Not a checkbox. Real evidence.

---

**Tweet 4 (What to do now)**

What to do TODAY:

1. Classify your AI systems (high/limited/minimal risk)
2. Start writing behavioral tests for high-risk agents
3. Run tests in CI — every run generates timestamped evidence
4. Store results with version info

Every test you run now is documentation you won't scramble to create in 2026.

---

**Tweet 5 (KindLM)**

KindLM generates Annex IV-compliant reports from your test results:

```bash
kindlm test --compliance
```

- Testing methodology documentation
- Assertion results with statistics
- Risk mitigation evidence
- SHA-256 hash for tamper proof
- Timestamp + version info

Open source. Free. github.com/kindlm/kindlm

Start now. Thank yourself later.
