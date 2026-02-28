# I Spent 4 Years Testing Websites. Then I Realized AI Agents Need the Same Thing.

*Reading time: 6 minutes*

---

## The Moment It Clicked

I've been a QA automation engineer for over four years. I write Playwright tests for a living — checking that buttons work, pages load, forms submit correctly across multiple websites. It's methodical, unglamorous, and absolutely essential.

Last year, my team started integrating AI features into our products. A chatbot here, an AI-powered recommendation there. And I had the same reaction every QA engineer has when someone ships a new feature:

"How do we test this?"

The honest answer? We didn't. Not properly.

We'd manually check a few conversations. Maybe run a prompt through the API and eyeball the response. If it "looked right," it shipped. That's the standard across the industry — and it's terrifying.

---

## The Gap Nobody Talks About

I started researching evaluation tools. Promptfoo, Braintrust, DeepEval, LangSmith — they all test the same thing: **text output quality**. "Is this response relevant? Is it helpful? Does it match a reference?"

That's useful for chatbots. It's useless for agents.

The AI features we were building weren't just generating text. They were making decisions. Routing customer queries. Calling internal APIs. Pulling user data. Triggering workflows.

I needed to test: **did the agent call the right API, with the right parameters, in the right sequence?**

No tool could do that.

So I started building one.

---

## What KindLM Actually Does

KindLM is a CLI tool. You define tests in YAML. You run them in your terminal or CI pipeline. You get pass/fail results — just like Playwright, Jest, or any other testing framework.

The difference is what you can assert on.

Here's a real test case for a customer support agent:

```yaml
suites:
  - name: order-support
    provider: openai:gpt-4o
    system_prompt_file: prompts/support-agent.md
    tools:
      - name: lookup_order
        when:
          order_id: "ORD-789"
        then:
          status: "shipped"
          tracking: "1Z999AA10123456784"

    tests:
      - name: order-status-check
        input: "Where is my order ORD-789?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args:
              order_id: "ORD-789"
          - type: tool_not_called
            tool: cancel_order
          - type: no_pii
          - type: judge
            criteria: "Response includes tracking number and estimated delivery"
            threshold: 0.8
```

This test verifies four things simultaneously:

1. The agent called `lookup_order` with the correct order ID
2. The agent did NOT call `cancel_order` (it shouldn't for a status query)
3. The response contains no personal data leakage
4. The response quality meets the criteria (scored by an LLM judge)

If a prompt change causes the agent to stop calling `lookup_order`, or to incorrectly trigger `cancel_order`, this test catches it before deployment.

That's it. That's the core value proposition. Test what agents do, not just what they say.

---

## Why Open Source, Why CLI, Why YAML

I made deliberate architectural choices based on my experience in QA:

**Open source (MIT license):** Testing tools should be free. If you're a solo developer or a startup, you shouldn't need a $49/month subscription to verify that your agent works. The CLI and all assertion types are free forever. No account needed.

**CLI-first:** Testing belongs in the terminal and in CI. Not in a web dashboard you check once a week. `kindlm test` runs in GitHub Actions, GitLab CI, Jenkins — anywhere you run your other tests.

**YAML configuration:** Developers already write YAML for CI configs, Docker Compose, Kubernetes. Test definitions should live in version control alongside the code they test. No proprietary format. No lock-in.

**TypeScript:** Because the AI agent ecosystem is predominantly TypeScript/JavaScript (LangChain, Vercel AI SDK, OpenAI SDK). KindLM fits naturally into existing toolchains.

---

## The EU AI Act Angle

Here's the part that surprised me: when I started mapping KindLM's test output to EU AI Act requirements, the overlap was remarkable.

The EU AI Act (Annex IV) requires high-risk AI system documentation to include:

- Description of the system and its intended purpose ← **config metadata**
- Testing and validation measures ← **test results**
- Information about the data used ← **prompt and tool definitions**
- Interaction with other systems ← **tool call documentation**
- Performance metrics ← **pass rates, latency, cost**

By adding a `--compliance` flag, KindLM generates a markdown document that maps test results directly to these regulatory articles. Run your behavioral tests, get a compliance report as a byproduct.

This isn't a full compliance solution — companies will still need legal review, risk assessments, and governance frameworks. But it eliminates the most expensive and time-consuming part: generating the technical test documentation from scratch.

---

## What I've Learned Building This

A few things I didn't expect:

**Non-determinism is manageable, not unsolvable.** Running each test 3 times and aggregating results handles most randomness. Setting temperature to 0 makes most tool-calling behavior deterministic. The "LLMs are too random to test" narrative is overstated.

**The testing patterns are familiar.** If you've written Playwright tests or Jest tests, writing KindLM tests feels natural. It's the same discipline: define expected behavior, run the system, compare actual to expected, fail loudly when they diverge.

**Compliance is a feature, not a burden.** When compliance documentation is generated from tests you're already running, it stops being a separate workstream and becomes a checkbox that fills itself.

**The market doesn't exist yet.** There's no "AI agent behavioral testing" category. Promptfoo tests prompts. Braintrust manages experiments. LangSmith traces executions. Nobody specifically tests agent decisions. That's either a massive opportunity or a sign nobody wants this. I'm betting on the former.

---

## What's Next

KindLM is launching publicly soon. The roadmap is straightforward:

1. **CLI MVP:** All assertion types, multiple providers (OpenAI, Anthropic, Ollama), reporters (terminal, JSON, JUnit XML, compliance markdown)
2. **Cloud dashboard:** Test history, trends, team collaboration — for teams that need shared visibility
3. **Enterprise features:** SSO, audit logs, signed compliance reports — for regulated industries

The CLI stays free forever. Cloud is for teams who need collaboration and history.

If you're building AI agents and losing sleep over "did that prompt change break something?", I'd love your feedback. Star the repo, try it out, tell me what's broken.

Because if there's one thing I've learned in QA: the bugs you don't test for are the ones that ship.

---

*Petr Kindlmann is a QA Automation Engineer based in Prague, building KindLM at github.com/kindlmann/kindlm*

---

### Image Prompts

**Hero Image:**
> Terminal screenshot aesthetic: a dark terminal window showing colorful KindLM test output — green checkmarks for passing tests, red X for one failing test ("Expected tool verify_identity to be called"), summary line at bottom showing "23/24 passed | 1 failed | 12.4s | $0.47". Subtle glow effect. Clean, modern monospace font.

**Infographic — "What KindLM Tests":**
> Side-by-side comparison chart. Left column: "Other Tools" with items (Text quality, Relevance, Tone, Similarity) all with checkmarks. Right column: "KindLM" with same items PLUS (Tool calls, Arguments, Call sequence, PII detection, Schema validation, Drift detection, Compliance docs) — the extra items highlighted in accent color. Clean, minimal, dark theme.
