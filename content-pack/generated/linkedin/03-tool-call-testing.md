# LinkedIn Post: Tool Call Testing

---

The most important output of your AI agent isn't text. It's the functions it calls.

When a customer says "refund order #12345," your agent's response to the user is secondary. What matters is: did it call `lookup_order` with the right ID? Did it check eligibility before processing? Did it avoid calling `process_refund` prematurely?

These are testable, deterministic properties. Yet most teams don't test them.

Here's why: the evaluation tools available today focus on text quality. They score responses on helpfulness, coherence, and relevance. But an agent that writes "I've processed your refund!" scores highly on all three — whether or not it actually called the right function.

Testing tool calls requires a different approach:

```yaml
# Did it call the right tool?
- type: tool_called
  value: lookup_order
  args:
    order_id: "12345"

# Did it NOT call a dangerous tool?
- type: tool_not_called
  value: process_refund

# Did it follow the protocol?
- type: tool_order
  value: [lookup_order, check_eligibility, process_refund]
```

Three assertion types. Three questions that text quality metrics cannot answer.

We ship these as part of KindLM, an open-source CLI for behavioral testing of AI agents. Write your tests in YAML, run them in CI, get JUnit XML for your test dashboard.

If your agent calls tools, you need to test the calls. Not the words around them.

npm i -g @kindlm/cli
github.com/kindlm/kindlm

#AIDevelopment #Testing #AgentTesting #DevTools
