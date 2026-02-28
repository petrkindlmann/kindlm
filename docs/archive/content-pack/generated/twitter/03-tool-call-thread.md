# Twitter Thread: How to Test Tool Calls in AI Agents

---

**Tweet 1 (Hook)**

How to test tool calls in AI agents (in 4 minutes):

Most eval frameworks ignore the most important output your agent produces — the functions it calls.

Here's how to test them properly:

---

**Tweet 2 (tool_called)**

STEP 1: Verify the agent calls the RIGHT tool

```yaml
assert:
  - type: tool_called
    value: lookup_order
    args:
      order_id: "12345"
```

This checks that lookup_order was called with the exact right argument.

Not "did the response mention the order." Did it actually CALL the function.

---

**Tweet 3 (tool_not_called)**

STEP 2: Verify the agent DOESN'T call the WRONG tool

```yaml
assert:
  - type: tool_not_called
    value: process_refund
```

Testing absence is as important as testing presence.

"The agent didn't call the dangerous function" is a test. Write it.

---

**Tweet 4 (tool_order)**

STEP 3: Verify the sequence

```yaml
assert:
  - type: tool_order
    value:
      - lookup_order
      - check_eligibility
      - process_refund
```

Agents should follow protocols. Verify first, then act.

tool_order ensures the right process, not just the right functions.

---

**Tweet 5 (CTA)**

That's it. Three assertion types that catch what text eval misses.

tool_called — right action, right arguments
tool_not_called — guardrails respected
tool_order — protocol followed

```bash
npm i -g @kindlm/cli
kindlm init
kindlm test
```

Open source. Free forever. github.com/kindlm/kindlm
