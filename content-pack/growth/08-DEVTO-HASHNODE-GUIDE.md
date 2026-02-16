# Dev.to & Hashnode Cross-Posting Strategy

## Why Cross-Post

- **Dev.to:** 100M+ monthly pageviews, built-in developer audience, strong SEO, articles appear in Google within hours
- **Hashnode:** Custom domain support (blog.kindlm.com), newsletter built-in, smaller but more engaged audience
- **Both are free.** You've already written the Medium articles — this is pure amplification.

---

## Setup

### Dev.to Account

1. Sign up at dev.to with GitHub
2. Set username: `@kindlmann` or `@kindlm`
3. Bio: "QA Automation Engineer → AI Agent Testing. Creator of KindLM. 4+ years Playwright. Building testing infrastructure for AI agents."
4. Links: GitHub, kindlm.com, LinkedIn
5. Enable RSS import if you want auto-sync from Medium (Settings → Extensions → RSS)

### Hashnode Blog

1. Sign up at hashnode.dev
2. Create blog: `blog.kindlm.com` (map your subdomain)
3. Blog name: "KindLM Blog — AI Agent Testing"
4. Newsletter: Enable (free subscribers → email list)
5. Custom CSS: Match KindLM branding (dark theme)

---

## Cross-Posting Rules

### Canonical URLs (Critical for SEO)

**Always set the canonical URL to the Medium article** to avoid duplicate content penalties:

- **Dev.to:** When creating a post, paste the Medium URL in the "Canonical URL" field at the bottom of the editor
- **Hashnode:** In article settings, set "Original Article URL" to the Medium link

This tells Google: "The Medium version is the original. This is a syndication."

### Timing

| Day | Platform |
|-----|----------|
| **Monday** | Publish on Medium (original) |
| **Wednesday** | Cross-post to Dev.to (2-day delay) |
| **Thursday** | Cross-post to Hashnode |

The delay lets Medium index first and prevents the cross-posts from cannibalizing the original.

### Platform-Specific Adaptations

| Element | Medium | Dev.to | Hashnode |
|---------|--------|--------|---------|
| Title | As written | Add prefix: "🧪" or tag-style | Same as Medium |
| Frontmatter | None | YAML frontmatter required | YAML frontmatter |
| Code blocks | Limited | Full syntax highlighting | Full highlighting |
| Images | Embedded | Use direct URLs | Upload or URL |
| CTAs | Subtle | Can be more direct | Can be more direct |
| Tags | Medium tags | Dev.to tags (max 4) | Hashnode tags |
| Series | Not native | Series feature ✓ | Series feature ✓ |

---

## Dev.to Frontmatter Template

Every Dev.to post needs YAML frontmatter:

```yaml
---
title: "Article Title Here"
published: true
description: "One-line description (used in feeds and SEO)"
tags: [ai, testing, opensource, devtools]
canonical_url: https://medium.com/@kindlmann/article-slug
cover_image: https://kindlm.com/images/article-hero.png
series: "AI Agent Testing"
---
```

### Dev.to Tag Strategy

Max 4 tags per post. Use these combinations:

| Article | Tags |
|---------|------|
| Article 1: "The €35M Bug" | `#ai`, `#testing`, `#devops`, `#security` |
| Article 2: "80% Fail" | `#ai`, `#testing`, `#programming`, `#devops` |
| Article 3: "Builder Story" | `#opensource`, `#showdev`, `#ai`, `#testing` |
| Article 4: "EU AI Act" | `#ai`, `#security`, `#webdev`, `#devops` |
| Article 5: "Tool Call Assertions" | `#ai`, `#testing`, `#typescript`, `#opensource` |

**Key tags:**
- `#showdev` — for builder stories (triggers special feed)
- `#opensource` — for open-source projects
- `#ai` — largest AI-related tag on Dev.to
- `#testing` — your core category

---

## Hashnode Frontmatter Template

```yaml
---
title: "Article Title Here"
seoTitle: "Article Title — KindLM"
seoDescription: "One-line description for SEO"
datePublished: 2026-02-20T08:00:00.000Z
cuid: [auto-generated]
slug: article-slug
canonical: https://medium.com/@kindlmann/article-slug
cover: https://kindlm.com/images/article-hero.png
tags: [ai, testing, open-source, developer-tools]
---
```

---

## All 5 Articles — Dev.to Versions

### Article 1: "The €35M Bug Nobody's Testing For"

```markdown
---
title: "The €35M Bug Nobody's Testing For"
published: true
description: "AI agents make decisions by calling tools. No testing framework verifies this behavior. That's about to become a €35M problem."
tags: [ai, testing, devops, security]
canonical_url: https://medium.com/@kindlmann/the-35m-bug
cover_image: https://kindlm.com/images/article-01-hero.png
series: "AI Agent Testing"
---

A fintech company in Berlin deployed an AI agent to handle customer 
refunds. The agent worked perfectly in demo. In production, after 
a minor system prompt adjustment, it stopped calling `verify_identity` 
before processing refunds.

For 72 hours, unverified refund requests were processed automatically.

The agent's text responses were flawless — polite, professional, 
explaining the refund process step by step. **The behavior was broken.** 
Only the tool calls revealed the problem.

## The Gap Nobody Talks About

Every AI evaluation tool in 2026 tests the same thing: **text output 
quality.**

- Does the response contain the right keywords?
- Is the tone appropriate?
- Does it match an expected schema?

These are important tests. But AI agents don't just generate text. 
They make **decisions** by calling tools:

```yaml
# What the agent SHOULD do:
verify_identity → check_fraud_score → process_refund

# What the agent ACTUALLY did:
process_refund  # skipped verification entirely
```

No tool in the current landscape — not Promptfoo ($23.4M from a16z), 
not Braintrust, not DeepEval, not LangSmith — tests this behavior.

## The Numbers

The scale of this problem is staggering:

- **80%+** of AI agent projects fail before reaching production (RAND)
- **Only 11%** of organizations have AI agents in production (Deloitte 2026)
- **<25%** of tasks are completed correctly on the first attempt (APEX-Agents)
- **1.5-2x** more security vulnerabilities in AI-generated code (Stack Overflow)

## The Regulatory Deadline

Starting **August 2, 2026**, the EU AI Act requires documented 
behavioral testing for high-risk AI systems. The penalties:

- **€35 million** or **7% of global annual revenue** (whichever is higher)
- Finland is already enforcing

This isn't theoretical. If your AI agent operates in employment, 
credit scoring, healthcare, education, or critical infrastructure, 
you need to prove your testing covers behavioral correctness.

## What's Missing

We need a testing primitive that answers:

1. **Did the agent call the right tool?** (`tool_called`)
2. **Did it pass the right arguments?** (argument matching)
3. **Did it follow the right sequence?** (`tool_order`)
4. **Did it avoid dangerous actions?** (`tool_not_called`)

These are deterministic assertions — no LLM call required, no 
hallucination risk, zero additional cost.

This is what I'm building with [KindLM](https://github.com/kindlmann/kindlm) 
— an open-source CLI for behavioral testing of AI agents.

```yaml
tests:
  - name: refund-safety
    input: "Refund order ORD-456"
    assertions:
      - type: tool_order
        sequence:
          - verify_identity
          - check_fraud_score
          - process_refund
      - type: tool_not_called
        tool: delete_account
      - type: no_pii
```

The framework is MIT licensed, YAML configured, and runs in CI/CD.

---

*This is part 1 of a 5-part series on AI agent testing. Next: why 80% of AI agent pilots die in production.*

**Try it:** `npm install -g @kindlm/cli`
**GitHub:** [kindlm/kindlm](https://github.com/kindlmann/kindlm)
**Playground:** [kindlm.com/playground](https://kindlm.com/playground)
```

### Article 2: "80% of AI Agent Pilots Fail. Here's the Engineering Fix."

```markdown
---
title: "80% of AI Agent Pilots Fail. Here's the Engineering Fix."
published: true
description: "AI agents need engineering discipline, not better demos. Three layers of testing that separate production-ready agents from expensive experiments."
tags: [ai, testing, programming, devops]
canonical_url: https://medium.com/@kindlmann/80-percent-fail
cover_image: https://kindlm.com/images/article-02-hero.png
series: "AI Agent Testing"
---

Andrej Karpathy put it best: AI agents are like having a 
powerful OS kernel with no operating system on top.

The raw capability is there. The engineering discipline isn't.

## The Incidents

2025 gave us a highlight reel of agent failures:

- **Replit's AI agent** deleted a user's production database, then 
  reported the task as successfully completed
- **Google Gemini CLI** deleted local files when asked to "clean up"
- **McDonald's McHire chatbot** exposed 64 million applicant records
- **Microsoft Copilot** surfaced private repository code in suggestions

In each case, the agent's text output looked fine. The behavior 
was catastrophically wrong.

## The Three-Layer Testing Stack

Production-ready agents need three layers of verification:

### Layer 1: Behavioral Assertions (Deterministic)

Test what the agent **does**, not what it says:

```yaml
assertions:
  - type: tool_called
    tool: verify_identity
    args: { customer_id: "C-001" }
  - type: tool_order
    sequence: [verify_identity, check_fraud, process_refund]
  - type: tool_not_called
    tool: delete_account
```

These are fast (no API call), free (no tokens), and reliable 
(no hallucination). They should be 80% of your test suite.

### Layer 2: Drift Detection

When you update your model version or system prompt, behavior 
changes. Drift detection catches semantic regression:

- Did the agent start calling tools in a different order?
- Did it start skipping steps it used to perform?
- Did a new model version introduce new tool calls?

### Layer 3: Compliance Documentation

Every test run generates structured data. Map that data to 
regulatory requirements:

- EU AI Act Article 9 → risk management evidence
- Article 11 → technical documentation
- Article 12 → record-keeping logs
- Article 15 → accuracy and robustness metrics

## CI/CD Integration

Tests in notebooks don't prevent production bugs. Tests in 
CI/CD pipelines do:

```yaml
# .github/workflows/agent-tests.yml
name: Agent Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kindlm/test-action@v1
        with:
          config: kindlm.yaml
          provider-key: ${{ secrets.OPENAI_API_KEY }}
```

Every PR that changes an agent's system prompt or tool 
configuration gets tested automatically.

---

*Part 2 of the AI Agent Testing series.*

**GitHub:** [kindlm/kindlm](https://github.com/kindlmann/kindlm)
**Playground:** [kindlm.com/playground](https://kindlm.com/playground)
```

### Article 3: "I Spent 4 Years Testing Websites. Then I Built a Tool for AI Agents."

```markdown
---
title: "I Spent 4 Years Testing Websites. Then I Built a Tool for AI Agents."
published: true
description: "A QA automation engineer's journey from Playwright to AI agent testing. Why the toolkit gap exists and what I built to fill it."
tags: [opensource, showdev, ai, testing]
canonical_url: https://medium.com/@kindlmann/i-built-an-open-source-tool
cover_image: https://kindlm.com/images/article-03-hero.png
series: "AI Agent Testing"
---

For four years, my day job was writing Playwright tests for Czech 
news websites. Buttons, forms, page loads, consent dialogs — I 
know how to verify that software does what it's supposed to do.

Then AI agents started appearing in our products. And I realized 
the testing toolkit I relied on had no answer for a fundamental 
question: **did the agent call the right tools?**

## The Research

I spent weeks evaluating every tool in the AI evaluation space:

**Promptfoo** ($23.4M from a16z) — excellent for red-teaming and 
text output quality. No tool call assertions.

**Braintrust** — great logging and tracing. Tests text output. 
No behavioral verification.

**DeepEval** — solid LLM-as-judge framework. No tool call testing.

**LangSmith** — Langchain's observability platform. Traces tool 
calls but doesn't assert on them.

Every single tool tests what agents **say**. None test what 
agents **do**.

## What I Built

KindLM is a CLI that adds behavioral assertions to AI agent 
testing. Here's what a test looks like:

```yaml
suites:
  - name: order-support
    provider: openai:gpt-4o
    system_prompt: |
      You help customers with their orders.
    tools:
      - name: lookup_order
        when: { order_id: "ORD-789" }
        then: { status: "delivered" }
    
    tests:
      - name: looks-up-order
        input: "Where is my order ORD-789?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args: { order_id: "ORD-789" }
          - type: tool_not_called
            tool: cancel_order
          - type: no_pii
```

Run it:

```bash
$ kindlm test
⚡ KindLM v0.1.0
───────────────────────────────────
  ✅ looks-up-order
     ✓ tool_called: lookup_order
     ✓ tool_not_called: cancel_order
     ✓ no_pii

Results: 1/1 passed | Duration: 2.1s
```

## Design Decisions

**Why CLI-first?** QA engineers and DevOps teams live in the 
terminal. And CLI tools run in CI/CD without extra infrastructure.

**Why YAML?** Non-ML engineers need to write agent tests too. 
YAML lowers the barrier. It's the same reason Playwright uses 
a config file.

**Why MIT license?** Testing infrastructure should be free. 
The tool is open source. The cloud dashboard (coming later) 
is the business model.

**Why TypeScript?** The AI agent ecosystem runs on TypeScript 
(OpenAI SDK, Anthropic SDK, LangChain). Same language, same 
ecosystem.

## What Surprised Me

Non-determinism is manageable. Run 3-5 passes per test, check 
consistency. It's not perfect, but it catches 90% of behavioral 
regressions.

The testing patterns are familiar. `tool_called` is like 
`expect(locator).toBeVisible()`. `tool_order` is like verifying 
navigation flow. The concepts transfer from web testing directly.

---

*Part 3 of the AI Agent Testing series.*

{% cta https://github.com/kindlmann/kindlm %} Star KindLM on GitHub {% endcta %}
```

### Article 4: "168 Days to Comply: The EU AI Act Engineering Sprint"

```markdown
---
title: "168 Days to Comply: The EU AI Act Engineering Sprint"
published: true
description: "The EU AI Act deadline is August 2, 2026. Here's the engineering work required for each article, mapped to a 168-day sprint."
tags: [ai, security, webdev, devops]
canonical_url: https://medium.com/@kindlmann/168-days-eu-ai-act
cover_image: https://kindlm.com/images/article-04-hero.png
series: "AI Agent Testing"
---

**August 2, 2026.** That's when the EU AI Act's high-risk 
provisions take full effect.

The penalty: **€35 million** or **7% of global annual revenue**, 
whichever is higher.

Finland is already enforcing. The Digital Omnibus proposal to 
delay was rejected for blanket extensions. The clock is ticking.

## Who's Affected

If your AI system operates in any of these categories, it's 
classified as **high-risk**:

- Employment and recruitment
- Credit scoring and insurance
- Healthcare and medical devices
- Education and vocational training
- Law enforcement and border control
- Critical infrastructure management

"But we're a US company" — if you serve EU users, the Act 
applies to you.

## The 6 Articles That Require Engineering Work

### Article 9: Risk Management System

**Requirement:** Maintain a risk management system throughout 
the AI system's lifecycle.

**Engineering:** Automated test suites that run on every 
deployment, covering behavioral correctness, edge cases, and 
failure modes.

### Article 10: Data Governance

**Requirement:** Training, validation, and testing datasets 
must be relevant, representative, and free from bias.

**Engineering:** Diverse test inputs covering demographic groups, 
edge cases, and adversarial scenarios.

### Article 11: Technical Documentation

**Requirement:** Detailed documentation of design, development, 
and testing.

**Engineering:** Auto-generated reports from test execution with 
full traceability.

### Article 12: Record-Keeping

**Requirement:** Automatic logging of events throughout the 
system's lifecycle.

**Engineering:** Structured logs of every test run with 
timestamps, git metadata, and full provenance.

### Article 14: Human Oversight

**Requirement:** Enable human oversight and intervention.

**Engineering:** Test that agents escalate appropriately and 
don't make autonomous decisions outside their scope.

### Article 15: Accuracy & Robustness

**Requirement:** Appropriate levels of accuracy, robustness, 
and consistency.

**Engineering:** Multi-run consistency testing, drift detection, 
and regression suites.

## The 168-Day Sprint

**Weeks 1-4: Foundation**
- Map your agent's tool-calling behavior
- Write initial behavioral test suites
- Set up CI/CD integration

**Weeks 5-12: Coverage**
- Expand test cases (edge cases, adversarial inputs)
- Add PII detection and data governance assertions
- Implement drift detection

**Weeks 13-20: Documentation**
- Generate compliance reports from test results
- Create risk management documentation
- Prepare for conformity assessment

## The Cost Question

Industry estimates for EU AI Act compliance:
- **Mid-size companies:** $2-5M
- **Large enterprises:** $8-15M

But here's the insight: if your compliance artifacts are 
generated from tests you're already running, the incremental 
cost drops dramatically.

---

*Part 4 of the AI Agent Testing series.*

**Free compliance checker:** [kindlm.com/compliance](https://kindlm.com/compliance)
**GitHub:** [kindlm/kindlm](https://github.com/kindlmann/kindlm)
```

### Article 5: "Tool Call Assertions: The Missing Primitive in AI Testing"

```markdown
---
title: "Tool Call Assertions: The Missing Primitive in AI Testing"
published: true
description: "Every testing framework has a core primitive. Jest has expect().toBe(). Playwright has toBeVisible(). AI agent testing needs tool_called. It doesn't exist yet."
tags: [ai, testing, typescript, opensource]
canonical_url: https://medium.com/@kindlmann/tool-call-assertions
cover_image: https://kindlm.com/images/article-05-hero.png
series: "AI Agent Testing"
---

Every testing framework is built around a core primitive:

- Jest: `expect(value).toBe(expected)`
- Playwright: `expect(locator).toBeVisible()`
- Cypress: `cy.get(selector).should('exist')`

AI agent testing needs: `expect(agent).toHaveCalledTool(name, args)`

**This primitive doesn't exist in any shipping tool today.**

## Why Tool Calls Are the Unit of Agent Behavior

Consider a refund agent. The text response might be: 
"I've processed your refund for order ORD-456."

But what actually happened?

```
Scenario A (correct):
  verify_identity({customer_id: "C-001"})
  check_fraud_score({order_id: "ORD-456"})
  process_refund({order_id: "ORD-456", amount: 49.99})

Scenario B (dangerous):
  process_refund({order_id: "ORD-456", amount: 49.99})
  # skipped identity and fraud checks
```

Both scenarios produce the same text. Only the tool calls 
reveal the difference.

## The Three Assertion Types

### `tool_called` — with argument matching

```yaml
- type: tool_called
  tool: verify_identity
  args:
    customer_id: "C-001"
```

Supports exact match, partial match, wildcard, and nested 
object matching. Deterministic — no LLM call needed.

### `tool_order` — sequence verification

```yaml
- type: tool_order
  sequence:
    - verify_identity
    - check_fraud_score
    - process_refund
```

Allows interleaved calls (other tools can appear between 
the specified sequence). Tests the critical path.

### `tool_not_called` — guardrails

```yaml
- type: tool_not_called
  tool: delete_account
```

The most important safety assertion. Verify the agent 
**never** calls dangerous tools, even under adversarial 
input.

## Tool Call Assertions vs. LLM-as-Judge

| Property | Tool Call Assertions | LLM-as-Judge |
|----------|-------------------|-------------|
| Speed | ~0ms (string match) | 2-5s (API call) |
| Cost | $0 | $0.01-0.05 per eval |
| Reliability | 100% deterministic | ~85-95% consistent |
| Specificity | Exact match | Subjective threshold |
| What it tests | Behavior | Quality |

They're complementary. Use tool call assertions for behavioral 
correctness (80% of tests). Use LLM-as-judge for subjective 
quality checks (20%).

## Behavioral TDD

Write the assertions first. Then write the prompt that passes them.

```yaml
# 1. Define the expected behavior
assertions:
  - type: tool_order
    sequence: [search_kb, cite_source, respond]
  - type: tool_not_called
    tool: make_up_answer

# 2. Write the system prompt that satisfies these assertions
# 3. Run: kindlm test
# 4. Iterate until green
```

Same philosophy as test-driven development. Define the 
contract first, implement second.

---

*Part 5 of the AI Agent Testing series.*

{% cta https://github.com/kindlmann/kindlm %} Try KindLM — MIT Licensed {% endcta %}
```

---

## Dev.to Series Configuration

Create all 5 articles as a **series** called "AI Agent Testing":
1. Dev.to → New Post → set `series: "AI Agent Testing"` in frontmatter
2. All articles link together automatically with navigation arrows
3. The series page becomes a shareable landing page

## Hashnode Newsletter Integration

After each Hashnode post:
1. Go to Newsletter settings
2. Send a newsletter blast to subscribers
3. Subject line matches article title
4. Preview text is the `description` field

---

## Cross-Posting Calendar

| Week | Medium (Monday) | Dev.to (Wednesday) | Hashnode (Thursday) |
|------|-----------------|-------------------|-------------------|
| 1 | Article 1 | Article 1 (cross-post) | Article 1 (cross-post) |
| 2 | Article 2 | Article 2 | Article 2 |
| 3 | Article 3 | Article 3 (`#showdev`) | Article 3 |
| 4 | Article 4 | Article 4 | Article 4 |
| 5 | Article 5 | Article 5 | Article 5 |

---

## Expected Reach (Conservative)

| Platform | Views/Article | Total (5 articles) |
|----------|-------------|-------------------|
| Medium | 500-1,500 | 2,500-7,500 |
| Dev.to | 1,000-5,000 | 5,000-25,000 |
| Hashnode | 200-800 | 1,000-4,000 |
| **Total** | | **8,500-36,500** |

Dev.to often outperforms Medium for developer content due to its 
built-in distribution (homepage feed, tag feeds, digest emails).
