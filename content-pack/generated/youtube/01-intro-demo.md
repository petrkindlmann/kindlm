# YouTube Script: KindLM in 5 Minutes

**Duration:** 5 minutes
**Format:** Screen recording with voiceover, face cam in corner

---

## [0:00 - 0:30] Hook

**[Face cam]**

Your AI agent sounds perfect. Helpful, empathetic, professional. But is it actually doing the right thing? Is it calling the right tools? Passing the correct arguments? Avoiding functions it shouldn't touch?

In the next five minutes, I'm going to show you how to test your AI agent's behavior — not its text quality, its actual behavior — using a free, open-source CLI tool called KindLM.

Let's go.

## [0:30 - 1:15] Install and Initialize

**[Switch to terminal — full screen]**

First, install KindLM globally with npm.

```bash
npm i -g @kindlm/cli
```

**[Type and run the command. Wait for install to complete.]**

Now let's create a project and initialize it.

```bash
mkdir my-agent-tests
cd my-agent-tests
kindlm init
```

**[Run the commands. Show the generated kindlm.yaml file.]**

KindLM created a `kindlm.yaml` config file for us. This is where we define our test suites. Let's open it up and write our first real test.

## [1:15 - 2:30] Write the First Test

**[Open kindlm.yaml in editor — VS Code or similar]**

I'm going to test a customer service refund agent. Here's my config:

```yaml
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 3

suites:
  - name: "refund-agent"
    system_prompt_file: ./prompts/refund.md
    tests:
      - name: "looks-up-order"
        input: "I want to return order #12345"
        assert:
          - type: tool_called
            value: lookup_order
            args:
              order_id: "12345"
          - type: tool_not_called
            value: process_refund
          - type: no_pii
```

Let me walk through this.

**[Highlight each section as you explain]**

The `defaults` section sets our LLM provider — GPT-4o — temperature zero for consistency, and three runs per test to handle non-determinism.

The `suites` section defines our test suite. We point it at a system prompt file — that's the prompt your agent uses.

Then the `tests`. We give it a user input: "I want to return order #12345."

And here's where KindLM is different from eval frameworks. The `assert` section tests *behavior*:

- `tool_called` with `args` — did the agent call `lookup_order` with the correct order ID?
- `tool_not_called` — did it avoid calling `process_refund` prematurely?
- `no_pii` — did any PII leak into the response?

These aren't text quality checks. These are behavioral assertions.

## [2:30 - 2:45] Create the System Prompt

**[Create prompts directory and file]**

Let me quickly create the system prompt file that the config references.

```bash
mkdir prompts
```

**[Create prompts/refund.md with a basic refund agent prompt. Show briefly — don't dwell.]**

This is your agent's system prompt. Nothing special here — just the instructions your agent follows.

## [2:45 - 3:30] Run the Tests

**[Back to terminal]**

Now let's run it.

```bash
export OPENAI_API_KEY=sk-...
kindlm test
```

**[Run the command. Show the pretty terminal output as it executes.]**

Watch what happens. KindLM sends your input to the LLM with your system prompt, captures the response including all tool calls, then evaluates every assertion.

**[Point to the output]**

Green checkmarks. All three assertions passed across all three runs.

- `tool_called: lookup_order` with the right args — PASS
- `tool_not_called: process_refund` — PASS
- `no_pii` — PASS

Three runs each, all passing. If this were in CI, the exit code would be 0. Build passes.

## [3:30 - 4:15] Add More Assertions

**[Back to editor]**

Let's add a second test — an edge case:

```yaml
      - name: "escalate-angry-customer"
        input: "This is UNACCEPTABLE. I want a manager NOW. Order #99999."
        assert:
          - type: tool_called
            value: lookup_order
          - type: tool_called
            value: escalate_to_human
          - type: tool_not_called
            value: process_refund
          - type: judge
            criteria: "Response is empathetic and acknowledges frustration"
            threshold: 0.8
```

**[Highlight the judge assertion]**

Notice I'm combining behavioral assertions with an LLM-as-judge check. `tool_called` and `tool_not_called` verify the agent's actions. `judge` evaluates the text quality. Both matter — but behavioral tests catch failures that judge alone would miss.

**[Run kindlm test again. Show results.]**

Both tests passing. Let's also look at the CI output format.

```bash
kindlm test --reporter junit
```

**[Show JUnit XML output briefly]**

JUnit XML — every CI system can render this. GitHub Actions, GitLab, Jenkins, CircleCI. Your AI agent tests show up right next to your unit tests.

## [4:15 - 4:45] Multi-Provider Testing

**[Terminal]**

One more thing. Same tests, different provider:

```bash
kindlm test --provider anthropic:claude-sonnet-4-5-20250929
```

**[Run and show results]**

Same YAML config. Same assertions. Different model underneath. Now you can compare providers empirically — not based on which playground response you liked better, but on which model meets your behavioral requirements most consistently.

## [4:45 - 5:00] Wrap-Up

**[Face cam]**

That's KindLM in five minutes. Install it, write your tests in YAML, run them in CI. Test what your agent does, not just what it says.

It's open source and free forever. Link in the description.

```
npm i -g @kindlm/cli
```

Know what your agent will do before your users do.

If this was useful, like and subscribe — I'm going to do a deep dive on tool call testing next.

---

**Description:**

KindLM — open-source behavioral regression testing for AI agents.

Install: npm i -g @kindlm/cli
GitHub: github.com/kindlm/kindlm
Docs: docs.kindlm.com

Chapters:
0:00 Hook
0:30 Install and Initialize
1:15 Write Your First Test
2:30 System Prompt Setup
2:45 Run Tests
3:30 Advanced Assertions
4:15 Multi-Provider Testing
4:45 Wrap-Up
