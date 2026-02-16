# LinkedIn Post 3: The Builder Story

**Best posting time:** Tuesday, 8–10 AM CET
**Format:** Text post with terminal screenshot image
**Attach:** Mock terminal output infographic

---

I've written Playwright tests for 4+ years.

Last year my team added AI features.
My first question: "How do we test this?"

The honest answer? We didn't. Not properly.

I researched every eval tool: Promptfoo, Braintrust, DeepEval.

They all test the same thing — text output quality.

"Is the response relevant? Is the tone right?"

But our AI wasn't just writing text.
It was calling APIs. Routing queries. Making decisions.

I needed to test:
→ Did it call the right API?
→ With the right parameters?
→ In the right order?

No tool could do that. So I built one.

KindLM lets you write tests like this:

```yaml
assertions:
  - type: tool_called
    tool: verify_identity
  - type: tool_not_called
    tool: process_refund
  - type: no_pii
  - type: judge
    criteria: "includes tracking number"
```

Define in YAML. Run in terminal. Gate in CI.

If a prompt change breaks tool behavior, this catches it.
Before production. Before damage. Before August 2026.

Three design decisions I'm firm on:

1. Open source (MIT). Testing tools should be free.
2. CLI-first. Tests belong in CI, not dashboards.
3. YAML config. Lives in git alongside your code.

It's called KindLM. Launching soon.

Star the repo (link in comments) if you need this.

---

**Hashtags (first comment):**
#OpenSource #QAEngineering #AIAgents #DevTools #BuildInPublic #Testing #AITesting
