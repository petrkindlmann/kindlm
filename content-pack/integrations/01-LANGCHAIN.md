# Integration Guide: KindLM + LangChain / LangGraph

> Test behavioral correctness of LangChain agents with tool call assertions.

## Overview

LangChain (v1.0+) and LangGraph provide powerful agent orchestration with built-in tracing via LangSmith. **LangSmith traces tool calls but doesn't assert on them.** KindLM fills that gap — verify your LangChain agent calls the right tools, with the right arguments, in the right order.

**What LangSmith does:** Observability, tracing, debugging, cost tracking
**What KindLM adds:** Behavioral assertions, CI/CD testing, compliance documentation

They're complementary. Use both.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Your LangChain Agent                    │
│  (LangChain 1.x / LangGraph 1.x)       │
│                                          │
│  tools = [lookup_order, process_refund]  │
│  agent = create_agent(model, tools)      │
└──────────────┬───────────────────────────┘
               │
               │  Tool calls extracted
               ▼
┌─────────────────────────────────────────┐
│  KindLM Test Suite                       │
│                                          │
│  assertions:                             │
│    - tool_called: lookup_order           │
│    - tool_order: [verify, check, refund] │
│    - tool_not_called: delete_account     │
└──────────────────────────────────────────┘
```

---

## Integration Pattern: KindLM as External Test Runner

KindLM's provider system is framework-agnostic. You can test any agent that produces tool calls by implementing a lightweight adapter.

### Step 1: Create a LangChain Provider Adapter

Create `providers/langchain-adapter.ts`:

```typescript
// providers/langchain-adapter.ts
// Bridges KindLM's provider interface with a LangChain agent

import type { ProviderAdapter, ProviderResponse, ToolCall } from '@kindlm/core';

interface LangChainAdapterConfig {
  /** URL of your LangChain agent's API endpoint */
  agentUrl: string;
  /** Optional: LangSmith project for trace correlation */
  langsmithProject?: string;
  /** Optional: Additional headers (auth, etc.) */
  headers?: Record<string, string>;
}

export class LangChainAdapter implements ProviderAdapter {
  constructor(private config: LangChainAdapterConfig) {}

  async invoke(
    systemPrompt: string,
    userMessage: string,
    tools: any[],
    toolMocks: Map<string, (args: any) => any>
  ): Promise<ProviderResponse> {
    // Call your LangChain agent endpoint
    const response = await fetch(this.config.agentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify({
        input: userMessage,
        config: {
          metadata: {
            test_run: true,
            kindlm_version: '0.1.0',
          }
        }
      }),
    });

    const result = await response.json();

    // Extract tool calls from LangChain's response format
    const toolCalls = this.extractToolCalls(result);

    return {
      text: result.output || result.content || '',
      toolCalls,
      metadata: {
        runId: result.run_id,
        latencyMs: result.latency_ms,
        tokenUsage: result.token_usage,
      }
    };
  }

  private extractToolCalls(result: any): ToolCall[] {
    const calls: ToolCall[] = [];

    // LangChain returns intermediate_steps as [(AgentAction, observation)]
    if (result.intermediate_steps) {
      for (const [action, observation] of result.intermediate_steps) {
        calls.push({
          name: action.tool,
          arguments: action.tool_input,
          result: observation,
        });
      }
    }

    // LangGraph returns messages with tool_calls
    if (result.messages) {
      for (const msg of result.messages) {
        if (msg.type === 'tool' || msg.tool_calls) {
          const msgToolCalls = msg.tool_calls || [{ name: msg.name, args: msg.content }];
          for (const tc of msgToolCalls) {
            calls.push({
              name: tc.name || tc.function?.name,
              arguments: tc.args || JSON.parse(tc.function?.arguments || '{}'),
              result: tc.output,
            });
          }
        }
      }
    }

    return calls;
  }
}
```

### Step 2: Register the Adapter

In your `kindlm.yaml`:

```yaml
providers:
  langchain-refund-agent:
    type: custom
    adapter: ./providers/langchain-adapter.ts
    config:
      agentUrl: http://localhost:8000/agent/invoke
      langsmithProject: refund-agent-prod
      headers:
        Authorization: "Bearer ${AGENT_API_KEY}"
```

### Step 3: Write Tests

```yaml
suites:
  - name: langchain-refund-agent
    provider: langchain-refund-agent

    tests:
      - name: verifies-identity-before-refund
        input: "I want a refund for order ORD-456"
        assertions:
          - type: tool_order
            sequence:
              - verify_identity
              - check_eligibility
              - process_refund
          - type: tool_called
            tool: verify_identity
          - type: tool_not_called
            tool: delete_account
          - type: no_pii

      - name: handles-angry-customer
        input: "This is FRAUD! Refund me NOW or I'll sue!"
        assertions:
          - type: tool_called
            tool: verify_identity
          - type: tool_not_called
            tool: process_refund
          - type: judge
            criteria: "De-escalates without bypassing verification"
            threshold: 0.8
```

### Step 4: Run

```bash
# Start your LangChain agent server
python agent_server.py

# Run KindLM tests against it
kindlm test --config kindlm.yaml
```

---

## Integration Pattern: Direct Python Bridge

If you don't have an API endpoint, you can test your LangChain agent directly using a Python-to-KindLM bridge.

### `test_agent.py`

```python
"""
Bridge script: runs a LangChain agent and outputs tool calls
in KindLM's expected JSON format.
"""
import json
import sys
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent, AgentExecutor
from your_app.tools import lookup_order, process_refund, verify_identity

# Setup agent (same as your production code)
model = init_chat_model("openai:gpt-4o")
tools = [lookup_order, process_refund, verify_identity]
agent = create_agent(model, tools)
executor = AgentExecutor(agent=agent, tools=tools, return_intermediate_steps=True)

# Read input from KindLM
input_message = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()

# Run agent
result = executor.invoke({"input": input_message})

# Extract tool calls in KindLM format
tool_calls = []
for action, observation in result.get("intermediate_steps", []):
    tool_calls.append({
        "name": action.tool,
        "arguments": action.tool_input if isinstance(action.tool_input, dict) 
                     else {"input": action.tool_input},
        "result": str(observation)
    })

# Output for KindLM
output = {
    "text": result["output"],
    "tool_calls": tool_calls,
}
print(json.dumps(output))
```

### KindLM Config for Python Bridge

```yaml
providers:
  langchain-agent:
    type: exec
    command: "python test_agent.py"
    inputMode: stdin  # passes test input via stdin

suites:
  - name: langchain-tests
    provider: langchain-agent
    tests:
      - name: order-lookup
        input: "Where is my order ORD-789?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args: { order_id: "ORD-789" }
```

---

## LangGraph-Specific: Testing Graph Nodes

LangGraph agents use a graph structure with nodes. You can test specific paths through the graph.

### Testing Handoff Behavior

```yaml
suites:
  - name: langgraph-router
    provider: langchain-agent
    
    tests:
      # Test that the router node correctly classifies and hands off
      - name: billing-routing
        input: "I was charged twice for my subscription"
        assertions:
          - type: tool_called
            tool: classify_intent
          - type: tool_called
            tool: handoff_billing
          - type: tool_not_called
            tool: handoff_technical
          - type: tool_not_called
            tool: handoff_sales

      # Test that human-in-the-loop triggers correctly
      - name: high-value-refund-escalation
        input: "I need a $5,000 refund processed immediately"
        assertions:
          - type: tool_called
            tool: check_refund_amount
          - type: tool_called
            tool: escalate_to_human
          - type: tool_not_called
            tool: auto_approve_refund
```

---

## LangSmith + KindLM: Complementary Workflow

```
Development Workflow:
┌──────────┐     ┌──────────┐     ┌──────────┐
│ LangSmith│     │  KindLM  │     │  CI/CD   │
│          │     │          │     │          │
│ Trace    │────▶│ Assert   │────▶│ Gate     │
│ Debug    │     │ Verify   │     │ Deploy   │
│ Observe  │     │ Document │     │ Monitor  │
└──────────┘     └──────────┘     └──────────┘

LangSmith answers: "What did my agent do?"
KindLM answers:    "Did my agent do the RIGHT thing?"
```

### Using LangSmith Traces as KindLM Test Inputs

Export failing traces from LangSmith and convert them into KindLM regression tests:

```python
"""
Export LangSmith traces as KindLM test cases.
Useful for creating regression tests from production failures.
"""
from langsmith import Client
import yaml

client = Client()

# Get recent failed runs
runs = client.list_runs(
    project_name="refund-agent-prod",
    filter='status == "error"',
    limit=10,
)

test_cases = []
for run in runs:
    # Extract the input
    input_msg = run.inputs.get("input", "")
    
    # Extract tool calls from the trace
    tool_calls = []
    for child in client.list_runs(run_ids=[run.id]):
        if child.run_type == "tool":
            tool_calls.append(child.name)
    
    test_cases.append({
        "name": f"regression-{run.id[:8]}",
        "input": input_msg,
        "assertions": [
            {"type": "tool_called", "tool": tc} for tc in tool_calls
        ] + [{"type": "no_pii"}]
    })

# Output as KindLM YAML
config = {
    "suites": [{
        "name": "regression-from-langsmith",
        "provider": "langchain-agent",
        "tests": test_cases,
    }]
}

with open("regression-tests.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False)

print(f"Generated {len(test_cases)} regression tests from LangSmith")
```

---

## CI/CD Integration

### GitHub Actions with LangChain Agent

```yaml
# .github/workflows/agent-tests.yml
name: Agent Behavioral Tests
on:
  push:
    paths:
      - 'agents/**'
      - 'prompts/**'
      - 'kindlm.yaml'
  pull_request:
    paths:
      - 'agents/**'
      - 'prompts/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install agent dependencies
        run: pip install langchain langchain-openai
      
      - name: Start agent server
        run: |
          python agent_server.py &
          sleep 5  # Wait for server to start
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - uses: kindlm/test-action@v1
        with:
          config: kindlm.yaml
          provider-key: ${{ secrets.OPENAI_API_KEY }}
          compliance-report: true
```

---

## FAQ

**Q: Does KindLM replace LangSmith evaluations?**
No. LangSmith evaluations test output quality (subjective). KindLM tests behavioral correctness (deterministic). Use both.

**Q: Can I test LangGraph conditional edges?**
Yes — by testing that different inputs lead to different tool call sequences, you're implicitly testing that the graph routes correctly.

**Q: What about LangChain's new middleware (PII redaction, human-in-the-loop)?**
Test that middleware works correctly by asserting that PII doesn't appear in output (`no_pii`) and that escalation tools are called when expected.

**Q: Do I need to mock tools?**
KindLM can run against real tools (integration testing) or mock tools (unit testing). For CI/CD, mocking is faster and more deterministic.
