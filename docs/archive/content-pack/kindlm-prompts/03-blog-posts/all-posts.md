# Blog Post Prompts

Paste each prompt into Claude (or GPT-4o). Output = complete blog post ready to publish.
Publish on: kindlm.com/blog, dev.to, Hashnode


---


## POST 01: Launch Post — "Why We Built KindLM"

SYSTEM: You are the creator of KindLM, an open-source testing framework for AI agents. Write in first person. Direct, technical, no marketing fluff. You're a QA automation engineer who got frustrated that no tool existed for testing AI agent behavior.

Write a blog post titled "Why We Built KindLM."

Structure:
1. The incident that triggered it: A prompt change broke an AI support agent in production. It stopped calling lookup_order and hallucinated order details. No errors, no alerts. The output looked fine. The behavior was wrong.
2. What we looked for: Promptfoo (prompt-level, not agent-level), Braintrust (logging, not testing), DeepEval (Python-only, academic). Nothing tested tool calls.
3. What we built: YAML-defined tests that assert on tool calls, judge output quality, detect drift, and generate compliance docs. One CLI.
4. Show the simplest possible example: 8 lines of YAML, one command, what the output looks like.
5. What's next: Cloud dashboard, GitHub Action, more provider integrations.
6. CTA: GitHub repo link, npm install command, docs link.

Tone: Honest, slightly frustrated with the status quo, optimistic about the solution. Like a dev writing on their personal blog, not a company writing a press release.

Length: 1,200-1,500 words. Use code blocks for all YAML and CLI examples.


---


## POST 02: Technical — "How to Regression-Test AI Agent Tool Calls"

SYSTEM: You are a senior AI engineer writing a tutorial for other AI engineers. Practical, step-by-step, with complete code examples. No theory without immediately showing how to implement it.

Write a tutorial titled "How to Regression-Test AI Agent Tool Calls."

The reader has an AI agent in production that calls external tools (APIs, databases, etc.) and wants to ensure prompt changes don't break tool call behavior.

Structure:
1. The problem: Why traditional output-based testing fails for agents. An agent can produce correct-looking text while calling the wrong tools.
2. Setup: npm install, create kindlm.config.yaml
3. Define a test case: A support agent handling refund requests.
   - Show the complete YAML with toolCalls assertions
   - Explain argsMatch, shouldNotCall, ordering
4. Run it: kindlm test, walk through each line of output
5. Add it to CI: GitHub Actions workflow YAML (5 lines)
6. Advanced: Testing tool call sequences, partial argument matching, negative assertions
7. Common patterns: Table of 5 real-world tool call assertion patterns (e-commerce, fintech, healthtech)

Length: 2,000-2,500 words. Heavy on code blocks. Every concept must have a working YAML example.


---


## POST 03: Compliance — "EU AI Act Testing Requirements: What Engineers Need to Know"

SYSTEM: You are a technical writer who understands both engineering and EU regulation. Write for CTOs and senior engineers at companies deploying AI in the EU. No legal advice disclaimers unless contextually necessary. Focus on what's actionable.

Write a guide titled "EU AI Act Testing Requirements: What Engineers Actually Need to Know."

Structure:
1. The timeline: August 2, 2026 deadline for high-risk systems. What counts as high-risk (Annex III): hiring, credit, medical, education, law enforcement.
2. What Annex IV requires: Technical documentation including testing methodology, performance metrics, risk assessment. Break down each requirement in plain English.
3. What this means for engineering teams: You need documented, repeatable tests with timestamped results. Not "we tested it manually."
4. How KindLM helps: The --compliance flag generates Annex IV-mapped reports. Show the command, show the output structure.
5. What KindLM doesn't do: It's not legal advice. It's not a complete compliance solution. It's the testing documentation component.
6. Recommended approach: Run compliance tests in CI, store reports with each release, review with legal quarterly.
7. Cost of non-compliance: Up to 7% of global revenue. Compare to the cost of running tests.

Length: 1,800-2,200 words. Include the actual Annex IV article references. One YAML example, one CLI example, one sample report excerpt.


---


## POST 04: Comparison — "KindLM vs. Promptfoo: When to Use Which"

SYSTEM: You are a fair, technical reviewer comparing two open-source tools. You built KindLM but you respect Promptfoo. This is not a hit piece. Be honest about where each tool is stronger.

Write a comparison titled "KindLM vs. Promptfoo: When to Use Which."

Structure:
1. Both are good. They solve different problems. Here's how to pick.
2. Promptfoo excels at: Prompt-level evaluation, model comparison, large-scale eval datasets. If you're optimizing prompts, use Promptfoo.
3. KindLM excels at: Agent-level testing (tool calls, decisions, behavior), compliance documentation, drift detection. If you're testing what agents DO, use KindLM.
4. Feature comparison table: 10 features, honest checkmarks for both.
5. Can you use both? Yes. Promptfoo for prompt optimization during development, KindLM for regression testing in CI.
6. Migration: If you have Promptfoo configs, here's how to translate them to KindLM YAML.

Length: 1,500-1,800 words. Include a comparison table. Be genuinely fair.


---


## POST 05: Use Case — "Testing a Fintech AI Agent for EU AI Act Compliance"

SYSTEM: You are writing a detailed walkthrough of testing a real-world fintech AI agent. The agent processes loan applications. This is a high-risk AI system under EU AI Act Annex III.

Write a walkthrough titled "Testing a Fintech AI Agent for EU AI Act Compliance."

Structure:
1. The agent: A loan application processor that calls credit_check, verify_identity, calculate_risk_score, and approve_or_deny.
2. Why it's high-risk: Credit scoring is explicitly listed in Annex III. Must comply by August 2026.
3. Test suite design: Show complete YAML for 5 test scenarios (approved, denied, edge case, PII handling, bias check).
4. Tool call assertions: Verify credit_check is always called before approve_or_deny. Verify PII is never logged.
5. Judge criteria: Fair language, no discriminatory patterns, clear explanation of denial.
6. Running with compliance flag: Show the full command and the generated report.
7. CI integration: How to block deploys that fail compliance tests.

Length: 2,500-3,000 words. Complete, runnable YAML examples throughout.


---


## POST 06: Technical — "Drift Detection: How to Know When Your Agent Changes"

Write as a senior AI engineer explaining semantic drift detection to peers.

Title: "Your Agent Changed and Nobody Noticed: Drift Detection with KindLM"

Cover: What drift is (agent behavior shifts without code changes due to model updates, prompt injection, training data changes). How KindLM baselines work. How semantic comparison differs from string diffs. How to set drift thresholds. Show complete YAML config for drift detection with a working example. Include the baseline save command and the comparison output. Explain when drift matters (production) vs. when it doesn't (development).

Length: 1,500-2,000 words.


---


## POST 07: Tutorial — "Add AI Agent Tests to Your CI Pipeline in 5 Minutes"

Write as a DevOps engineer helping other DevOps engineers add KindLM to existing CI.

Title: "Add AI Agent Tests to Your CI Pipeline in 5 Minutes"

Cover: GitHub Actions setup (complete workflow YAML), GitLab CI setup (complete .gitlab-ci.yml), environment variables for API keys, JUnit XML output for test reporting, exit codes for pipeline gates, caching node_modules for speed.

Length: 1,200-1,500 words. Mostly code blocks. Minimal prose.


---


## POST 08: Thought Leadership — "The Three Types of AI Agent Failures Nobody Tests For"

Write as a provocative but technically grounded opinion piece.

Title: "The Three Types of AI Agent Failures Nobody Tests For"

The three types: (1) Correct output, wrong action — agent says the right thing but calls the wrong tool. (2) Slow drift — agent behavior changes 2% per week until it's unrecognizable. (3) Compliance gaps — agent passes all functional tests but leaks PII or violates regulatory requirements. For each type, give a real-world scenario, explain why traditional testing misses it, and show how to catch it. Don't hard-sell KindLM but naturally reference it as the solution.

Length: 1,500-1,800 words. Shareable, opinionated, backed by examples.
