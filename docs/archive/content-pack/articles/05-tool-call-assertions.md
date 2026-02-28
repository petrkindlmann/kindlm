# Tool Call Assertions: The Testing Primitive That Will Define AI Agent Reliability

*Reading time: 6 minutes*

---

## The Assertion That Doesn't Exist

Every testing framework has a core assertion primitive. Jest has `expect(x).toBe(y)`. Playwright has `expect(page.locator('.button')).toBeVisible()`. These primitives define what the framework can verify.

For AI agent testing, the missing primitive is:

```
expect(agent).toHaveCalledTool('verify_identity', { user_id: '12345' })
```

This assertion doesn't exist in any shipping tool today. And it's the single most important thing you need to test an AI agent.

---

## Why Tool Calls Are the Unit of Agent Behavior

A chatbot produces text. An agent produces tool calls.

When your customer support agent receives "I want to return my order," the text response ("I'd be happy to help you with your return!") is cosmetic. What matters is the sequence of decisions:

1. Call `lookup_order` with the order ID
2. Call `check_return_eligibility` to verify the return window
3. If eligible, call `initiate_return` with the correct parameters
4. If not eligible, explain why — without calling `initiate_return`

This is behavioral logic. It's deterministic enough to test (at temperature 0, tool-calling models are highly consistent). And it's the exact thing that breaks when prompts change.

The problem is that every evaluation tool in the AI ecosystem was designed for a pre-agent world:

| Tool | What it evaluates | Tool call assertions? |
|------|-------------------|----------------------|
| Promptfoo | Text output quality, red teaming | No |
| Braintrust | Prompt experiments, A/B testing | No |
| DeepEval | Response metrics (hallucination, relevance) | No |
| LangSmith | Execution traces, latency | No (traces, not assertions) |
| Langfuse | Observability, cost tracking | No |

LangSmith comes closest — it traces tool calls for debugging. But tracing is not asserting. Tracing says "here's what happened." An assertion says "this is what should have happened — did it?"

The difference is the same as between a log file and a test suite.

---

## Anatomy of a Tool Call Assertion

A tool call assertion needs to verify three things:

### 1. Was the tool called?

The simplest assertion: given this input, did the agent invoke `tool_name`?

```yaml
- type: tool_called
  tool: lookup_order
```

This catches the most dangerous class of regression: the agent stops calling a required tool entirely. A prompt change that adds "be more concise" might cause the agent to skip the verification step and go straight to answering — the response sounds helpful, but the data is hallucinated.

### 2. Were the arguments correct?

Tool calling is only useful if the arguments are right. If the agent calls `lookup_order` with the wrong order ID, it's the same as not calling it.

```yaml
- type: tool_called
  tool: lookup_order
  args:
    order_id: "ORD-789"
```

This supports partial matching — you don't need to specify every argument, just the ones that matter. You can also use wildcards:

```yaml
args:
  order_id: "*"  # Just verify it was passed, any value
```

And nested matching for complex argument structures:

```yaml
args:
  filters:
    status: "active"
    region: "eu-west"
```

### 3. Were tools called in the right sequence?

Order matters. In a refund flow, `verify_identity` must come before `process_refund`. If the agent reverses the order, the refund is unverified — even though both tools were called.

```yaml
- type: tool_order
  sequence:
    - verify_identity
    - check_fraud_score
    - process_refund
```

This assertion allows extra tools in between (the agent might call `log_interaction` or `get_user_preferences`). It only checks that the specified tools appear in the specified relative order.

### Bonus: Tool NOT called

Equally important — sometimes the correct behavior is to *not* use a tool:

```yaml
- type: tool_not_called
  tool: delete_account
```

This is a guardrail. No matter what the user says, the agent should never call `delete_account`. If a jailbreak or prompt injection tricks the agent into calling it, this assertion catches it.

---

## Multi-Turn Tool Simulation

Real agents don't just make one tool call. They engage in multi-turn loops:

1. User sends a message
2. Agent decides to call a tool
3. Tool returns a result
4. Agent processes the result and either calls another tool or responds

Testing this requires simulated tool responses. The test framework needs to act as both the user (sending the input) and the external systems (returning tool results).

```yaml
tools:
  - name: lookup_order
    when:
      order_id: "ORD-789"
    then:
      status: "delivered"
      delivered_at: "2026-02-10"
      
  - name: check_return_eligibility
    when:
      order_id: "ORD-789"
    then:
      eligible: true
      deadline: "2026-03-10"
```

The engine runs the loop: send prompt → model responds with tool call → inject simulated result → model processes and continues → until the model produces a final text response or hits a turn limit.

This makes tests self-contained. No real API calls needed (except to the LLM itself). Tests are fast, cheap, and reproducible.

---

## Why This Matters More Than LLM-as-Judge

LLM-as-judge (using one model to score another's output) is useful for subjective quality: "Was this response empathetic?" "Was it technically accurate?" "Did it address the user's question?"

But for behavioral correctness, LLM-as-judge is the wrong tool. You don't need a language model to verify that `lookup_order` was called with `order_id: "ORD-789"`. That's a deterministic check — a function comparison, not a natural language evaluation.

Tool call assertions are faster (no judge API call needed), cheaper (zero tokens), more reliable (no judge hallucination), and more specific (exact field matching, not fuzzy scoring).

The ideal test suite uses both:

- **Tool call assertions** for behavioral correctness (deterministic)
- **LLM-as-judge** for response quality (subjective)
- **PII detection** for safety (regex-based)
- **Schema validation** for structured output (AJV)

Each assertion type covers a different failure mode. Together, they form a comprehensive behavioral test.

---

## The Path to "Behavioral TDD"

Imagine writing agent requirements as tests *before* writing the prompt:

```yaml
# Requirement: Agent must verify identity before any financial action
- name: identity-required-for-refund
  input: "Refund my last purchase"
  assertions:
    - type: tool_order
      sequence: [verify_identity, process_refund]

# Requirement: Agent must never disclose internal pricing
- name: no-internal-pricing
  input: "What's your wholesale price for bulk orders?"
  assertions:
    - type: keywords_absent
      values: ["wholesale", "internal", "margin"]
    - type: tool_not_called
      tool: get_internal_pricing
```

Write the tests. Watch them fail. Write the prompt. Watch them pass. Ship with confidence.

This is Behavioral Test-Driven Development for AI agents. The same philosophy that made software reliable, applied to the new programming paradigm.

---

## The Primitive the Industry Needs

Tool call assertions are not a feature. They're a primitive — the foundational building block that every other agent testing capability depends on.

Without them, you can test text quality. With them, you can test decisions.

And decisions are what agents make.

---

*Petr Kindlmann is building KindLM, an open-source testing framework with tool call assertions for AI agents. github.com/kindlmann/kindlm*

---

### Image Prompts

**Hero Image:**
> An abstract visualization of an AI agent's decision tree: nodes represent tool calls (lookup_order, verify_identity, process_refund) connected by arrows showing the execution sequence. Green path shows correct flow, red dotted path shows a broken flow where verify_identity is skipped. Clean, technical diagram aesthetic, dark background with glowing nodes. Think circuit board meets flowchart.

**Infographic — "Assertion Types Comparison":**
> Four-quadrant grid: "Tool Call Assertions" (deterministic, behavioral, fast, free) / "LLM-as-Judge" (subjective, quality, slow, costs tokens) / "PII Detection" (regex, safety, instant, free) / "Schema Validation" (structural, output format, instant, free). Each quadrant has icon, description, best-for use case. Clean, minimal, color-coded.
