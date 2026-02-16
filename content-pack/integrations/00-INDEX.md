# KindLM Integration Guides

> Test behavioral correctness of AI agents — regardless of which framework you use.

## Supported Frameworks

| Framework | Language | Integration Type | Complexity |
|-----------|----------|-----------------|------------|
| [Anthropic Claude](#anthropic-claude) | TS/Python | **Built-in provider** | Zero config |
| [OpenAI Agents SDK](#openai-agents-sdk) | Python | Python bridge | Low |
| [Vercel AI SDK](#vercel-ai-sdk) | TypeScript | **Native TS adapter** | Low |
| [LangChain / LangGraph](#langchain) | Python/TS | API adapter or bridge | Medium |
| [CrewAI](#crewai) | Python | Hook-based capture | Medium |
| [Microsoft AutoGen](#autogen) | Python | Message extraction | Medium |
| [MCP Servers](#mcp) | Any | Tool-level (framework-agnostic) | Low |

---

## Quick Start by Framework

### Anthropic Claude
**Easiest** — KindLM has a built-in Anthropic provider. No adapter code needed.

```yaml
suites:
  - name: my-agent
    provider: anthropic:claude-sonnet-4-20250514
    system_prompt: "You are a support agent..."
    tools: [...]  # Define tools with mock responses
    tests: [...]  # Write assertions
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
kindlm test
```

→ [Full guide: Anthropic Claude](./06-ANTHROPIC-CLAUDE.md)

---

### OpenAI (Direct API / Agents SDK)
**Built-in provider** for direct API. Python bridge for the Agents SDK.

```yaml
# Direct API — built-in
suites:
  - name: my-agent
    provider: openai:gpt-4o
    # ...

# Agents SDK — use bridge
providers:
  my-agent:
    type: exec
    command: "python openai_agent_bridge.py"
```

→ [Full guide: OpenAI Agents SDK](./03-OPENAI-AGENTS-SDK.md)

---

### Vercel AI SDK
**Native TypeScript** — same ecosystem as KindLM. Write adapter in TS.

```typescript
// Extract tool calls from result.steps
const result = await generateText({ model, system, prompt, tools, maxSteps: 10 });
const toolCalls = result.steps.flatMap(s => s.toolCalls.map(tc => ({
  name: tc.toolName,
  arguments: tc.args,
})));
```

→ [Full guide: Vercel AI SDK](./04-VERCEL-AI-SDK.md)

---

### LangChain / LangGraph
**API adapter** (if you have a server) or **Python bridge** (direct execution).

```python
# Extract from intermediate_steps
result = executor.invoke({"input": message})
tool_calls = [
    {"name": action.tool, "arguments": action.tool_input}
    for action, observation in result["intermediate_steps"]
]
```

Bonus: Export LangSmith failed traces as KindLM regression tests.

→ [Full guide: LangChain / LangGraph](./01-LANGCHAIN.md)

---

### CrewAI
**Hook-based capture** — wrap CrewAI tools to capture calls across multi-agent crews.

```python
# Wrap tools to capture calls
@staticmethod
def wrap_tool(original_tool):
    original_func = original_tool.func
    def wrapped(*args, **kwargs):
        captured_tool_calls.append({"name": original_tool.name, ...})
        return original_func(*args, **kwargs)
    original_tool.func = wrapped
    return original_tool
```

Test crew-level patterns: delegation sequences, agent-to-agent handoffs, multi-step workflows.

→ [Full guide: CrewAI](./02-CREWAI.md)

---

### Microsoft AutoGen
**Message extraction** from multi-agent conversations.

```python
# Extract from AutoGen message stream
async for message in team.run_stream(task=input_message):
    if item.type == 'FunctionCall':
        tool_calls.append({"name": item.name, "arguments": item.arguments})
```

→ [Full guide: Microsoft AutoGen](./05-AUTOGEN.md)

---

### MCP (Model Context Protocol)
**Framework-agnostic** — MCP tools appear as standard function calls. Works with any client.

```yaml
# MCP tools are just tools — same assertions
assertions:
  - type: tool_called
    tool: mcp_db_query
  - type: tool_not_called
    tool: mcp_db_write
  - type: tool_order
    sequence: [mcp_search, mcp_analyze, mcp_report]
```

→ [Full guide: MCP](./07-MCP.md)

---

## Universal Integration Pattern

For any framework not listed above, the pattern is always the same:

### 1. Capture Tool Calls

Extract tool calls from your agent's execution:

```json
{
  "text": "Agent's text response",
  "tool_calls": [
    {"name": "tool_name", "arguments": {"key": "value"}, "result": "..."},
    {"name": "another_tool", "arguments": {...}}
  ]
}
```

### 2. Create a Bridge Script

```python
# bridge.py — any framework
import json, sys

result = your_agent.run(sys.argv[1])
tool_calls = extract_tool_calls(result)  # framework-specific

print(json.dumps({
    "text": result.output,
    "tool_calls": tool_calls,
}))
```

### 3. Configure KindLM

```yaml
providers:
  my-agent:
    type: exec
    command: "python bridge.py"
    inputMode: argv

suites:
  - name: my-tests
    provider: my-agent
    tests:
      - name: basic-test
        input: "test input"
        assertions:
          - type: tool_called
            tool: expected_tool
```

### 4. Run

```bash
kindlm test
```

---

## Comparison: KindLM vs Framework-Native Testing

| Capability | Framework Evals | KindLM |
|-----------|----------------|--------|
| Text output quality | ✅ Native strength | ✅ `judge` assertion |
| Tool call verification | ❌ Not available | ✅ `tool_called`, `tool_not_called` |
| Call sequence testing | ❌ Not available | ✅ `tool_order` |
| PII detection | ⚠️ Manual | ✅ `no_pii` (automatic) |
| CI/CD integration | ⚠️ Varies | ✅ GitHub Action |
| Compliance docs | ❌ Not available | ✅ EU AI Act reports |
| Multi-run consistency | ⚠️ Manual | ✅ Built-in (configurable runs) |
| Framework lock-in | ✅ Tight integration | ✅ Framework-agnostic |

**KindLM is complementary, not competitive.** Use your framework's eval tools for output quality. Use KindLM for behavioral correctness.

---

## Adding a New Integration

Want to add support for a framework not listed here? The contribution pattern is:

1. Create a bridge script or TypeScript adapter
2. Submit it to `kindlm-examples/integrations/`
3. Include at least 3 test cases demonstrating the integration
4. Document any framework-specific gotchas

See [CONTRIBUTING.md](https://github.com/kindlmann/kindlm/blob/main/CONTRIBUTING.md) for details.
