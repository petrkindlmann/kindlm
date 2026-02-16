# Integration Guide: KindLM + CrewAI

> Test behavioral correctness of CrewAI crews — verify individual agent tool calls and multi-agent handoff patterns.

## Overview

CrewAI (v1.6+) orchestrates multi-agent workflows with role-based agents, tasks, and tools. CrewAI's AMP Suite provides tracing, but **no behavioral assertion framework exists for verifying crew execution patterns.** KindLM adds:

- Verify each agent calls the expected tools
- Assert on agent-to-agent delegation sequences
- Catch agents that skip required steps under different task assignments
- Generate compliance documentation for multi-agent systems

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  CrewAI Crew                                  │
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Researcher│─▶│ Analyst  │─▶│ Writer   │   │
│  │  Agent   │  │  Agent   │  │  Agent   │   │
│  └──────────┘  └──────────┘  └──────────┘   │
│       │              │              │         │
│  search_web    calculate_risk   format_report │
│  get_data      validate_data    check_tone    │
└──────────────────┬───────────────────────────┘
                   │
                   │  Tool calls + delegation extracted
                   ▼
┌──────────────────────────────────────────────┐
│  KindLM Assertions                            │
│                                               │
│  - tool_order across agents                   │
│  - tool_called per agent                      │
│  - tool_not_called (safety guardrails)        │
│  - delegation sequence verification           │
└──────────────────────────────────────────────┘
```

---

## Integration Pattern: CrewAI Hook Adapter

CrewAI supports hooks that intercept agent execution. Use these to capture tool calls for KindLM.

### `crew_test_bridge.py`

```python
"""
CrewAI → KindLM Bridge
Captures all tool calls from a crew execution and outputs
them in KindLM's JSON format for assertion checking.
"""
import json
import sys
from crewai import Agent, Task, Crew, Process
from crewai.tools import tool

# ── Your tools ──────────────────────────────────────

@tool("search_knowledge_base")
def search_knowledge_base(query: str) -> str:
    """Search the internal knowledge base for relevant information."""
    return f"Results for: {query}"

@tool("verify_facts")
def verify_facts(claims: str) -> str:
    """Verify factual claims against trusted sources."""
    return f"Verified: {claims}"

@tool("check_compliance")
def check_compliance(content: str) -> str:
    """Check content against regulatory compliance requirements."""
    return f"Compliance check passed for: {content}"

# ── Tool call capture ───────────────────────────────

captured_tool_calls = []

class ToolCallCapture:
    """Wraps CrewAI tools to capture calls for KindLM."""
    
    @staticmethod
    def wrap_tool(original_tool):
        original_func = original_tool.func
        
        def wrapped(*args, **kwargs):
            captured_tool_calls.append({
                "name": original_tool.name,
                "arguments": kwargs if kwargs else {"input": args[0] if args else ""},
            })
            result = original_func(*args, **kwargs)
            captured_tool_calls[-1]["result"] = str(result)
            return result
        
        original_tool.func = wrapped
        return original_tool

# Wrap all tools
search_knowledge_base = ToolCallCapture.wrap_tool(search_knowledge_base)
verify_facts = ToolCallCapture.wrap_tool(verify_facts)
check_compliance = ToolCallCapture.wrap_tool(check_compliance)

# ── Agents ──────────────────────────────────────────

researcher = Agent(
    role="Senior Researcher",
    goal="Find accurate, relevant information on {topic}",
    backstory="Expert researcher who always verifies sources",
    tools=[search_knowledge_base, verify_facts],
    verbose=True,
)

compliance_reviewer = Agent(
    role="Compliance Reviewer",
    goal="Ensure all content meets regulatory requirements",
    backstory="Regulatory compliance specialist",
    tools=[check_compliance],
    verbose=True,
)

writer = Agent(
    role="Technical Writer",
    goal="Produce clear, accurate content based on research",
    backstory="Experienced technical writer",
    tools=[],
    verbose=True,
)

# ── Tasks ───────────────────────────────────────────

research_task = Task(
    description="Research {topic} thoroughly. Verify all key claims.",
    expected_output="Verified research findings",
    agent=researcher,
)

compliance_task = Task(
    description="Review the research for compliance issues.",
    expected_output="Compliance-approved research",
    agent=compliance_reviewer,
)

writing_task = Task(
    description="Write a report based on the verified research.",
    expected_output="Final report",
    agent=writer,
)

# ── Execute and capture ─────────────────────────────

def run_crew_test(topic: str):
    global captured_tool_calls
    captured_tool_calls = []
    
    crew = Crew(
        agents=[researcher, compliance_reviewer, writer],
        tasks=[research_task, compliance_task, writing_task],
        process=Process.sequential,
        verbose=True,
    )
    
    result = crew.kickoff(inputs={"topic": topic})
    
    return {
        "text": str(result),
        "tool_calls": captured_tool_calls,
    }


if __name__ == "__main__":
    input_msg = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read().strip()
    output = run_crew_test(input_msg)
    print(json.dumps(output))
```

### KindLM Config

```yaml
providers:
  crewai-research-crew:
    type: exec
    command: "python crew_test_bridge.py"
    inputMode: argv

suites:
  - name: research-crew
    provider: crewai-research-crew

    tests:
      - name: research-verified-before-writing
        input: "AI agent testing best practices"
        assertions:
          # Researcher must search AND verify
          - type: tool_called
            tool: search_knowledge_base
          - type: tool_called
            tool: verify_facts
          # Compliance must run before final output
          - type: tool_called
            tool: check_compliance
          # Correct order: research → compliance → (writing has no tools)
          - type: tool_order
            sequence:
              - search_knowledge_base
              - verify_facts
              - check_compliance
          # No PII in final output
          - type: no_pii

      - name: researcher-doesnt-skip-verification
        input: "Quick summary of quantum computing"
        assertions:
          # Even for "quick" tasks, verification should happen
          - type: tool_called
            tool: verify_facts
          - type: tool_order
            sequence:
              - search_knowledge_base
              - verify_facts

      - name: compliance-runs-on-sensitive-topic
        input: "Employee performance evaluation criteria"
        assertions:
          - type: tool_called
            tool: check_compliance
          - type: judge
            criteria: "Output mentions compliance review was performed"
            threshold: 0.7
```

---

## Testing CrewAI Flows

CrewAI Flows provide event-driven control. Test that flow transitions happen correctly:

```yaml
suites:
  - name: crewai-flow-test
    provider: crewai-flow-bridge

    tests:
      # Test conditional flow routing
      - name: high-risk-leads-to-manual-review
        input: "Evaluate loan application for $500,000"
        assertions:
          - type: tool_called
            tool: assess_risk_score
          - type: tool_called
            tool: escalate_to_human
          - type: tool_not_called
            tool: auto_approve

      # Test that the flow doesn't shortcut
      - name: low-risk-still-gets-compliance-check
        input: "Evaluate loan application for $5,000"
        assertions:
          - type: tool_called
            tool: assess_risk_score
          - type: tool_called
            tool: check_compliance
          - type: tool_order
            sequence:
              - assess_risk_score
              - check_compliance
```

---

## Multi-Agent Delegation Testing

The key pattern with CrewAI is verifying that agents delegate correctly:

```yaml
suites:
  - name: delegation-patterns
    provider: crewai-crew

    tests:
      # Manager agent delegates research to researcher
      - name: manager-delegates-correctly
        input: "Prepare a market analysis report"
        assertions:
          # Research tools should be called (by researcher agent)
          - type: tool_called
            tool: search_market_data
          - type: tool_called
            tool: analyze_trends
          # Compliance tools should be called (by compliance agent)
          - type: tool_called
            tool: regulatory_check
          # Manager shouldn't use research tools directly
          - type: tool_not_called
            tool: write_raw_sql  # no direct DB access from any agent

      # Test hierarchical process
      - name: hierarchical-follows-chain
        input: "Investigate security incident in production"
        assertions:
          - type: tool_order
            sequence:
              - check_system_logs     # Investigator runs first
              - analyze_attack_vector # Analyst runs second
              - generate_report       # Reporter runs third
              - notify_stakeholders   # Communicator runs last
```

---

## CrewAI + KindLM CI/CD

```yaml
# .github/workflows/crew-tests.yml
name: CrewAI Behavioral Tests
on:
  push:
    paths:
      - 'crews/**'
      - 'agents/**'
      - 'tasks/**'
      - 'kindlm.yaml'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: pip install crewai crewai-tools
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install KindLM
        run: npm install -g @kindlm/cli
      
      - name: Run crew behavioral tests
        run: kindlm test --config kindlm.yaml --runs 3
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Tips

1. **CrewAI's `verbose=True`** logs tool calls to stdout — useful for debugging but KindLM's bridge captures them programmatically.
2. **Test each agent role independently** first, then test the full crew workflow.
3. **CrewAI's memory system** can affect tool call patterns across runs — use `memory=False` for deterministic testing, then test with memory enabled separately.
4. **For hierarchical process**, the manager agent decides task assignment dynamically — test that the right agents get the right tasks by checking tool call patterns.
