# LinkedIn Post 5: Tool Call Assertions

**Best posting time:** Tuesday, 8–10 AM CET
**Format:** Text post with "Assertion Types" infographic
**Attach:** Four-quadrant assertion types comparison

---

Every testing framework has a core primitive.

Jest: expect(x).toBe(y)
Playwright: expect(locator).toBeVisible()

AI agent testing needs:

expect(agent).toHaveCalledTool('verify_identity', { user_id: '123' })

This assertion doesn't exist in any shipping tool today.

And it's the most important thing you need to test an agent.

Here's why:

A chatbot produces text.
An agent produces tool calls.

When your support agent hears "return my order," the text ("Happy to help!") is cosmetic.

What matters:
1. Did it call lookup_order?
2. Did it call check_return_eligibility?
3. Did it call initiate_return with correct params?
4. Did it NOT call delete_account?

This is behavioral logic. It's deterministic. It's testable.

And it's what breaks when prompts change.

I checked every major eval tool:

Promptfoo → tests text quality. No tool call assertions.
Braintrust → tests experiments. No tool call assertions.
DeepEval → tests metrics. No tool call assertions.
LangSmith → traces calls. But tracing ≠ asserting.

Tracing: "Here's what happened."
Asserting: "Here's what SHOULD have happened. Did it?"

That's the difference between a log file and a test suite.

Tool call assertions are:
→ Faster than LLM-as-judge (no API call needed)
→ Cheaper (zero tokens)
→ More reliable (no judge hallucination)
→ More specific (exact field matching)

I'm building this primitive into KindLM.

Full technical deep-dive on Medium (link in comments).

---

**Hashtags (first comment):**
#AIAgents #Testing #SoftwareEngineering #DevTools #OpenSource #LLM #ToolCalling #QA
