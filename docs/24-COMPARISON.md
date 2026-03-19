# KindLM vs Promptfoo vs Custom Scripts

Three common approaches to testing AI agents. Here's when to use each.

---

## The short version

| | KindLM | Promptfoo | Custom scripts |
|---|---|---|---|
| **Best for** | Agent behavior regression | Prompt evaluation & red-teaming | One-off checks |
| **Tests what** | Tool calls, arguments, sequences | Output quality, safety, cost | Whatever you write |
| **Config format** | YAML | YAML | Code |
| **CI integration** | JUnit XML, exit codes | JUnit XML, exit codes | Manual |
| **Learning curve** | Low (YAML only) | Low-medium | Depends on you |
| **Maintenance cost** | Low | Low | High (you own it all) |

## When to use KindLM

Your agent calls tools. You need to verify it calls the *right* tools with the *right* arguments in the *right* order — and doesn't call tools it shouldn't.

KindLM was built for this. One YAML block:

```yaml
expect:
  toolCalls:
    - tool: "lookup_order"
      argsMatch: { order_id: "123" }
    - tool: "process_refund"
      shouldNotCall: true
```

You also get PII detection, keyword guardrails, LLM-as-judge scoring, schema validation, and baseline drift comparison — all declarative, no code.

**Choose KindLM when:**
- Your agent makes tool calls or function calls
- You need regression tests that run in CI on every push
- You want to catch behavior changes (not just output quality changes)
- You need EU AI Act compliance documentation
- You want zero-code test definitions that any engineer can read

## When to use Promptfoo

You're evaluating prompt quality across models, running adversarial red-teaming, or comparing cost/latency tradeoffs across providers.

Promptfoo has a broader evaluation focus: it can run hundreds of prompt variants, score them with custom graders, and generate comparison reports. It has a strong plugin ecosystem and a web UI for exploring results.

**Choose Promptfoo when:**
- You're optimizing prompts (A/B testing wording, system prompts, few-shot examples)
- You need adversarial testing and red-teaming at scale
- You want a visual comparison UI for evaluating model outputs
- You need custom grading functions in JavaScript

## When both make sense

Many teams use both:

- **Promptfoo** during prompt development — evaluate quality, compare models, run red teams
- **KindLM** in CI — regression tests that gate deploys based on agent behavior

They test different things. Promptfoo answers "which prompt is better?" KindLM answers "did the agent break?"

## When to use custom scripts

You have a specific test that doesn't fit any framework's model. Maybe you're testing a multi-step workflow with external dependencies, or your assertions need complex business logic.

Custom scripts give you maximum flexibility. You pay for it with maintenance — every test is code you own and debug.

**Choose custom scripts when:**
- You have fewer than 5 test cases and no plans to grow
- Your test logic is genuinely unique and can't be expressed declaratively
- You're prototyping and don't know what "correct" looks like yet

**Migrate away from custom scripts when:**
- You have more than 10 tests — YAML scales, scripts don't
- Multiple people need to read and modify tests
- You need CI integration and reporting
- You've rewritten the same assertion pattern three times

## Feature comparison

| Feature | KindLM | Promptfoo | Custom scripts |
|---------|--------|-----------|----------------|
| Tool call assertions | Built-in | Via custom grader | Manual |
| Tool argument matching | Built-in | Via custom grader | Manual |
| Tool sequence assertions | Built-in | No | Manual |
| Negative tool assertions | Built-in | No | Manual |
| Tool response simulation | Built-in | No | Manual |
| LLM-as-judge | Built-in | Built-in | Manual |
| JSON Schema validation | Built-in | Built-in | AJV or similar |
| PII detection | Built-in | Via plugin | Regex |
| Keyword guardrails | Built-in | Via assertion | String check |
| Baseline drift | Built-in | No | Manual |
| Compliance reports | Built-in (EU AI Act) | No | Manual |
| JUnit XML output | Built-in | Built-in | Manual |
| Multi-model comparison | Built-in | Built-in | Manual |
| Red-teaming | No | Built-in | Manual |
| Web UI | Cloud (paid) | Built-in | No |
| Adversarial testing | No | Built-in | Manual |
| Custom graders (JS) | No | Built-in | Built-in |
| Multi-turn simulation | Built-in | Limited | Manual |
| Config format | YAML | YAML | Code |
| Provider support | 6 providers | 30+ providers | Unlimited |

## Migration from custom scripts

If you have existing test scripts, the migration path is straightforward:

1. Identify what each script checks (tool calls? output format? keywords?)
2. Map each check to a KindLM assertion type
3. Move the prompt and expected behavior into `kindlm.yaml`
4. Delete the script

Most teams migrate in an afternoon. The hardest part is usually extracting implicit assertions — things the script checks without documenting why.

## Migration from Promptfoo

If you're already using Promptfoo for eval and want to add KindLM for regression:

1. Keep Promptfoo for prompt development and red-teaming
2. Add KindLM for CI regression tests focused on agent behavior
3. They can share the same API keys and run in the same CI pipeline
4. No conflict — different tools for different jobs
