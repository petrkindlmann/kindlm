# Product Hunt Launch Assets

All copy ready to paste directly into Product Hunt fields.


---


## TAGLINE (60 chars max)

Regression tests for AI agents — tool calls, judges, compliance


## ONE-LINER

Open-source CLI that tests what your AI agent does, not just what it says.


## DESCRIPTION (paste into PH description field)

KindLM is an open-source testing framework for AI agents.

Most AI testing checks text output. But agents don't just write text — they make decisions, call tools, and take actions. When a prompt change breaks behavior, output-based tests miss it.

KindLM tests the things that matter:

**Tool call assertions** — verify which tools are called, with what arguments, in what order. Catch when your agent stops calling lookup_order and starts hallucinating data.

**LLM-as-judge** — score output quality against your custom criteria. Tone, accuracy, brand guidelines — with explanations, not just numbers.

**Drift detection** — semantic baseline comparison catches when behavior shifts without code changes.

**Compliance reports** — generate EU AI Act Annex IV-mapped documentation from your existing tests. Timestamped, hashed, audit-ready.

Three lines of YAML. One CLI command. JUnit XML output for CI. No account required.

```
npm i -g @kindlm/cli
kindlm test
```

MIT licensed. Built for AI engineers who are tired of deploying and hoping.


## MAKER COMMENT (paste as first comment after launch)

Hey PH 👋

I'm a QA automation engineer. I've spent years writing Playwright tests for web apps. When my team started deploying AI agents, I looked for the equivalent — something that could regression-test agent behavior in CI.

I couldn't find it.

Promptfoo is great for prompt-level evaluation, but our agents call tools, make decisions, and interact with APIs. We needed to test what the agent *does*, not just what it *says*.

So I built KindLM.

The config is YAML (any engineer can read it). The output is JUnit XML (any CI can parse it). The compliance reports map to EU AI Act Annex IV (any auditor can read them).

It's open source, MIT licensed, and you can install it right now without creating an account.

What I'd love feedback on:
- What's the first thing you'd test on your AI agent?
- Is the YAML config intuitive or would you prefer something else?
- What providers/models should we support next?

GitHub: https://github.com/kindlm/kindlm
Docs: https://kindlm.com/docs


## SCREENSHOT DESCRIPTIONS (generate 5 with Midjourney + terminal recordings)

1. Terminal showing `kindlm test` output with pass/fail results (real screenshot)
2. YAML config file in editor with syntax highlighting (real screenshot)
3. Compliance report output (real screenshot)
4. GitHub Actions integration — CI passing with KindLM step (real screenshot)
5. Side-by-side multi-model comparison output (real screenshot)


## TOPICS TO SELECT

- Developer Tools
- Artificial Intelligence
- Open Source
- Testing
- Compliance


---


## CROSS-POST TEMPLATES

### Hacker News (Show HN) — post same day

Title: Show HN: KindLM – Regression tests for AI agents (tool calls, judges, compliance)

URL: https://github.com/kindlm/kindlm

(No description needed — HN uses the URL. Be ready to answer every comment within 1 hour.)


### Reddit r/MachineLearning

Title: [P] KindLM: Open-source regression testing for AI agents — tool call assertions, LLM judges, EU AI Act compliance reports

Body: We built an open-source testing framework that checks what AI agents actually do (which tools they call, in what order, with what arguments), not just the text they output. YAML config, CLI-based, JUnit XML for CI, compliance reports for EU AI Act. GitHub: [link]. Would love feedback from anyone testing agents in production.


### Reddit r/LocalLLaMA

Title: KindLM: Test your AI agents with 3 lines of YAML — tool calls, quality judges, drift detection

Body: Open-source CLI tool for regression testing AI agents. Works with any provider (OpenAI, Anthropic, local models via OpenAI-compatible endpoints). No account needed. Particularly useful if you're comparing local vs cloud models in production. GitHub: [link]


### Reddit r/devops

Title: Adding AI agent testing to your CI pipeline with KindLM — GitHub Actions + JUnit XML in 5 minutes

Body: If your team deploys AI agents, you probably don't have regression tests for them yet. KindLM outputs JUnit XML so it plugs into any CI system. 5-line GitHub Actions config. Blocks deploys when agent behavior breaks. GitHub: [link]


### Dev.to / Hashnode — cross-post blog post 01 ("Why We Built KindLM")

Use the blog post prompt from 03-blog-posts/POST 01. Publish same day as Product Hunt launch.


### DevHunt submission

Title: KindLM
Tagline: Regression tests for AI agents
Description: Open-source CLI. YAML config. Tests tool calls, output quality, drift, compliance. MIT license.
URL: https://github.com/kindlm/kindlm


### Indie Hackers post

Title: I built an open-source testing framework for AI agents — here's what I learned

Body: Generate using this prompt in Claude: "Write an Indie Hackers post about launching KindLM. Focus on the builder journey — what problem you hit, what you tried, what you built. Include early traction numbers (stars, downloads). Be honest about what's working and what isn't. Ask for feedback. 500-700 words. Conversational, first person."
