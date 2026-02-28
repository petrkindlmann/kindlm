# LinkedIn Post: PII Detection in AI Agents

---

An AI agent can score 0.95 on helpfulness while leaking a customer's Social Security number.

This isn't hypothetical. We've seen it happen. An agent processes a support request, includes the customer's SSN in its reasoning chain, and that reasoning gets logged, stored, or transmitted to a context window that persists across sessions.

The final response to the user might be clean. But the PII was exposed somewhere in the pipeline.

Text quality evaluation doesn't catch this. An LLM-as-judge scoring "helpfulness" won't flag a nine-digit number in a response. Cosine similarity with a reference answer won't detect a credit card number in the tool call arguments.

PII detection needs to be a first-class test assertion, not an afterthought:

```yaml
assert:
  - type: no_pii
```

KindLM's `no_pii` assertion scans every response — text output, tool call arguments, and reasoning — for:

- Social Security Numbers (XXX-XX-XXXX patterns)
- Credit card numbers (with Luhn validation)
- Email addresses
- Phone numbers (US and international formats)
- IBANs (international bank account numbers)
- Custom patterns you define

It runs on every test, every time. Because PII leakage isn't a "sometimes check" — it's a "never should happen" property.

If your AI agent processes any personal data, this is the single most important assertion you can add to your test suite today.

```bash
npm i -g @kindlm/cli
```

github.com/kindlm/kindlm — open source, free.

#DataPrivacy #PII #AITesting #GDPR #AIAgents
