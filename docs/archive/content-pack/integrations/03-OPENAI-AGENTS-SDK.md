# Integration Guide: KindLM + OpenAI Agents SDK

> Test behavioral correctness of agents built with OpenAI's official Agents SDK.

## Overview

The OpenAI Agents SDK (v0.8+) is a lightweight framework for multi-agent workflows with built-in tracing, handoffs, guardrails, and sessions. **Tracing shows what happened. KindLM verifies it was correct.**

Key SDK concepts mapped to KindLM:
- **Function tools** → `tool_called` / `tool_not_called` assertions
- **Handoffs** → `tool_order` assertions (handoff is a specialized tool call)
- **Guardrails** → complement with `no_pii`, `keywords_absent` assertions
- **Sessions** → test multi-turn tool call sequences

---

## Integration Pattern: Direct Python Bridge

The OpenAI Agents SDK is Python-native. Extract tool calls from `Runner.run()` results.

### `openai_agent_bridge.py`

```python
"""
OpenAI Agents SDK → KindLM Bridge
Extracts tool calls from agent execution for behavioral testing.
"""
import json
import sys
import asyncio
from agents import Agent, Runner, function_tool, RunConfig

# ── Define tools ────────────────────────────────────

@function_tool
def lookup_order(order_id: str) -> str:
    """Look up an order by ID and return its status."""
    # In production, this calls your order service
    return json.dumps({
        "order_id": order_id,
        "status": "shipped",
        "tracking": "FX123456789",
    })

@function_tool
def verify_identity(customer_id: str) -> str:
    """Verify customer identity before processing sensitive actions."""
    return json.dumps({"verified": True, "customer_id": customer_id})

@function_tool
def process_refund(order_id: str, amount: float) -> str:
    """Process a refund for the given order."""
    return json.dumps({"refunded": True, "order_id": order_id, "amount": amount})

@function_tool
def escalate_to_human(reason: str) -> str:
    """Escalate the conversation to a human agent."""
    return json.dumps({"escalated": True, "reason": reason, "queue_position": 3})

# ── Define agent ────────────────────────────────────

support_agent = Agent(
    name="Customer Support",
    instructions="""You are a customer support agent. 
    Always verify identity before processing refunds.
    Escalate to human for disputes over $500.
    Never delete accounts without explicit manager approval.""",
    tools=[lookup_order, verify_identity, process_refund, escalate_to_human],
)

# ── Tool call capture via tracing ───────────────────

async def run_and_capture(input_message: str) -> dict:
    """Run agent and capture all tool calls."""
    
    result = await Runner.run(
        support_agent,
        input_message,
        run_config=RunConfig(
            tracing_disabled=False,  # Keep tracing for extraction
        ),
    )
    
    # Extract tool calls from the result
    # The SDK stores tool call info in the run's new_items
    tool_calls = []
    
    for item in result.new_items:
        # Check for tool call items
        if hasattr(item, 'type') and item.type == 'function_call':
            tool_calls.append({
                "name": item.name,
                "arguments": json.loads(item.arguments) if isinstance(item.arguments, str) 
                            else item.arguments,
            })
        elif hasattr(item, 'type') and item.type == 'function_call_output':
            # Attach result to the last tool call
            if tool_calls:
                tool_calls[-1]["result"] = item.output
        # Check for handoffs (also tool calls in the SDK)
        elif hasattr(item, 'type') and item.type == 'handoff':
            tool_calls.append({
                "name": f"handoff_{item.target_agent}",
                "arguments": {"reason": item.reason if hasattr(item, 'reason') else ""},
            })
    
    # Alternative: extract from raw messages
    if not tool_calls and hasattr(result, 'raw_responses'):
        for response in result.raw_responses:
            if hasattr(response, 'output'):
                for output_item in response.output:
                    if hasattr(output_item, 'type') and output_item.type == 'function_call':
                        tool_calls.append({
                            "name": output_item.name,
                            "arguments": json.loads(output_item.arguments)
                                        if isinstance(output_item.arguments, str)
                                        else output_item.arguments,
                        })
    
    return {
        "text": result.final_output if isinstance(result.final_output, str) 
               else str(result.final_output),
        "tool_calls": tool_calls,
    }


if __name__ == "__main__":
    input_msg = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
    output = asyncio.run(run_and_capture(input_msg))
    print(json.dumps(output))
```

### KindLM Config

```yaml
providers:
  openai-support-agent:
    type: exec
    command: "python openai_agent_bridge.py"
    inputMode: argv

suites:
  - name: openai-agents-sdk-tests
    provider: openai-support-agent

    tests:
      - name: verifies-before-refund
        input: "I need a refund for order ORD-456"
        assertions:
          - type: tool_order
            sequence:
              - verify_identity
              - process_refund
          - type: tool_called
            tool: verify_identity
          - type: no_pii

      - name: escalates-high-value-dispute
        input: "I'm disputing a $2,000 charge on order ORD-789"
        assertions:
          - type: tool_called
            tool: escalate_to_human
          - type: tool_not_called
            tool: process_refund

      - name: order-lookup-correct-args
        input: "Where is my order ORD-123?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args: { order_id: "ORD-123" }
```

---

## Testing Handoffs

The Agents SDK uses handoffs to transfer between agents. These are specialized tool calls that KindLM can assert on:

```python
from agents import Agent

billing_agent = Agent(
    name="Billing",
    instructions="Handle billing questions.",
    tools=[lookup_invoice, process_payment],
)

technical_agent = Agent(
    name="Technical",
    instructions="Handle technical issues.",
    tools=[check_system_status, restart_service],
)

router_agent = Agent(
    name="Router",
    instructions="Route to the correct specialist.",
    handoffs=[billing_agent, technical_agent],
)
```

```yaml
suites:
  - name: handoff-tests
    provider: openai-router-agent

    tests:
      - name: billing-question-routes-correctly
        input: "Why was I charged twice this month?"
        assertions:
          - type: tool_called
            tool: transfer_to_Billing  # handoff appears as tool call
          - type: tool_not_called
            tool: transfer_to_Technical

      - name: technical-issue-routes-correctly
        input: "The API keeps returning 503 errors"
        assertions:
          - type: tool_called
            tool: transfer_to_Technical
          - type: tool_not_called
            tool: transfer_to_Billing
```

---

## Testing Guardrails

The SDK has input/output guardrails. Test that guardrails + agent behavior work together:

```python
from agents import Agent, InputGuardrail, GuardrailFunctionOutput

async def pii_guardrail(ctx, agent, input) -> GuardrailFunctionOutput:
    """Block messages containing PII."""
    contains_pii = any(pattern in input for pattern in ["SSN", "social security"])
    return GuardrailFunctionOutput(
        output_info={"blocked": contains_pii},
        tripwire_triggered=contains_pii,
    )

agent = Agent(
    name="Support",
    instructions="Help customers.",
    input_guardrails=[InputGuardrail(guardrail_function=pii_guardrail)],
    tools=[lookup_order],
)
```

```yaml
tests:
  - name: guardrail-blocks-pii-input
    input: "My SSN is 123-45-6789, can you look up my account?"
    assertions:
      # Agent should NOT call any tools when guardrail triggers
      - type: tool_not_called
        tool: lookup_order
      - type: judge
        criteria: "Refuses to process request with PII"
        threshold: 0.8

  - name: normal-input-passes-guardrail
    input: "What's the status of order ORD-456?"
    assertions:
      - type: tool_called
        tool: lookup_order
```

---

## Testing Sessions (Multi-Turn)

The SDK's session system maintains conversation history. Test multi-turn tool call patterns:

```yaml
suites:
  - name: session-tests
    provider: openai-session-agent

    tests:
      - name: multi-turn-refund-flow
        turns:
          - input: "I want to return order ORD-100"
            assertions:
              - type: tool_called
                tool: lookup_order
                args: { order_id: "ORD-100" }

          - input: "Yes, please process the return"
            assertions:
              - type: tool_called
                tool: verify_identity
              - type: tool_order
                sequence:
                  - verify_identity
                  - check_return_eligibility
              - type: tool_not_called
                tool: process_refund  # shouldn't refund yet

          - input: "My customer ID is C-001"
            assertions:
              - type: tool_called
                tool: process_return
              - type: no_pii
```

---

## Tracing Integration

The Agents SDK traces to multiple backends. Use traces as test data:

```python
"""
Export OpenAI Agents SDK traces as KindLM regression tests.
"""
from agents import trace_utils

# Get recent traces
traces = trace_utils.get_recent_traces(limit=20)

for trace in traces:
    if trace.status == "error":
        tool_calls = [
            step.tool_name 
            for step in trace.steps 
            if step.type == "function_call"
        ]
        print(f"Failed trace {trace.id}: tools called = {tool_calls}")
        # Generate KindLM test case from this trace
```

---

## Tips

1. **Provider-agnostic**: The Agents SDK works with non-OpenAI models via Chat Completions API. KindLM tests work regardless of which LLM you use.
2. **Handoffs are tool calls**: In the SDK, `transfer_to_AgentName` is a function call. Assert on it like any other tool.
3. **`max_turns` parameter**: Set this in tests to prevent runaway agent loops. KindLM's `latency` assertion can also catch this.
4. **Structured output**: If your agent uses `output_type`, you can combine `json_schema` assertions with tool call assertions for full coverage.
