# Show HN + Product Hunt Launch Sequence

---

## Part 1: Show HN (Hacker News)

### Timing

- **Day:** Tuesday, Wednesday, or Thursday (highest engagement)
- **Time:** 8:00–9:00 AM EST (13:00–14:00 UTC, 14:00–15:00 CET)
- **Why:** US East Coast waking up, EU afternoon — max overlap
- **Avoid:** Mondays (backlog), Fridays (checkout mode), weekends (low traffic)
- **Check:** Before posting, scan HN front page — avoid days with major tech news that would drown you out

### Title Format

HN titles are critical. Follow these rules:
- Start with "Show HN:"
- State what it does, not what it is
- Include the key differentiator
- No buzzwords, no emojis, no exclamation marks
- Under 80 characters

#### Title Options (pick one)

**Option A (Recommended — problem-focused):**
```
Show HN: KindLM – Test what your AI agents do, not just what they say
```

**Option B (technical-focused):**
```
Show HN: KindLM – Tool call assertions for AI agent testing (MIT, CLI)
```

**Option C (gap-focused):**
```
Show HN: KindLM – The behavioral testing framework AI agents are missing
```

**Option D (EU AI Act angle):**
```
Show HN: KindLM – Test AI agent behavior and generate EU AI Act compliance docs
```

### Link

Point to the GitHub repo, NOT the landing page. HN respects GitHub links.
```
https://github.com/kindlmann/kindlm
```

### First Comment (Post Immediately After Submitting)

This is the most important part. HN readers click through to comments before clicking the link. Your first comment should be:
- Honest about what it does and doesn't do
- Technical enough to satisfy HN
- Personal enough to be interesting
- Under 500 words

```markdown
Hi HN, I'm Petr. I've been a QA automation engineer for 4+ years, 
mostly writing Playwright tests for news websites in the Czech Republic.

Last year my team started integrating AI agents into our products, 
and I realized the testing toolkit I relied on had no answer for 
a fundamental question: did the agent call the right tools?

Existing eval tools (Promptfoo, Braintrust, DeepEval) are great at 
testing text output quality — "does the response contain X" or 
"is the tone appropriate." But AI agents don't just generate text. 
They make decisions by calling tools: looking up orders, checking 
fraud scores, processing refunds, querying databases.

If your refund agent skips the fraud check and processes a refund 
anyway, the text output might still look perfect. The behavior is 
broken. Nothing catches this today.

KindLM adds three assertion types that don't exist elsewhere:

- `tool_called` — verify the agent called a specific tool with 
  specific arguments
- `tool_not_called` — verify the agent didn't call dangerous tools
- `tool_order` — verify the agent called tools in the correct sequence

It's YAML-configured, CLI-first, MIT licensed, and runs in CI/CD.
It also generates EU AI Act Annex IV compliance documentation from 
test results (the August 2026 deadline is real and the penalties 
are €35M or 7% of revenue).

What it doesn't do (yet):
- No web UI (CLI only for now)
- No hosted service (local execution only)
- Only supports OpenAI, Anthropic, and Ollama so far
- The `judge` assertion requires an LLM call (the behavioral 
  assertions are deterministic and free)

I'd love feedback on the assertion API design and the YAML config 
format. This is my first open-source tool and I'm building it 
evenings and weekends.

Try it: `npm install -g @kindlm/cli && kindlm init`

Repo: https://github.com/kindlmann/kindlm
Docs: https://kindlm.com/docs
Playground: https://kindlm.com/playground
```

### Comment Engagement Strategy

**In the first 2 hours, respond to EVERY comment.** This is non-negotiable. HN rewards active engagement.

#### Prepared Responses for Common HN Questions

**"How is this different from Promptfoo?"**
```
Promptfoo is excellent for testing text output quality and red-teaming. 
It has $23.4M from a16z and a strong community. KindLM focuses on a 
specific gap: tool call behavior. Promptfoo tests what an agent says. 
KindLM tests what an agent does (which tools it calls, with what 
arguments, in what order). They're complementary — you could use 
Promptfoo for output quality and KindLM for behavioral correctness.
```

**"Why not just use unit tests / integration tests?"**
```
You can unit test your tool implementations. What you can't unit test 
is the LLM's decision to call those tools. The model is non-deterministic — 
given the same input, it might call tools in different orders or skip 
steps entirely. KindLM runs multiple passes (default: 3) and checks 
consistency across runs. Traditional test frameworks don't have primitives 
for "assert this function was called by an AI model."
```

**"LLM-as-judge is unreliable"**
```
Agreed — that's why the core behavioral assertions (tool_called, 
tool_not_called, tool_order) are fully deterministic. No LLM call, 
no hallucination risk. The `judge` assertion is optional and meant for 
subjective quality checks where deterministic matching isn't enough. 
Most users should lean heavily on the deterministic assertions.
```

**"This is too early / agents aren't ready"**
```
You might be right about agents in general — only 11% of orgs have 
them in production (Deloitte 2026). But the ones that do have them in 
production need testing now. And the EU AI Act deadline (Aug 2026) 
doesn't care whether your agent is "ready" — if it's deployed in a 
high-risk category, it needs documented testing. I'd rather build the 
testing infrastructure early than scramble later.
```

**"What about security / prompt injection testing?"**
```
KindLM doesn't do adversarial prompt injection testing (that's 
Promptfoo's strength). It tests behavioral correctness under normal 
operation — does the agent follow the expected tool-calling flow? 
Think of it as the difference between penetration testing and 
functional testing. Both are necessary.
```

**"Why YAML instead of code?"**
```
QA teams and non-ML engineers need to write agent tests too. YAML 
lowers the barrier. That said, the YAML compiles to a TypeScript test 
runner internally, and we plan to expose a programmatic API for users 
who want code-level control. The YAML is the 80% case.
```

### Metrics to Track

- Position on HN front page (check every 30 min for first 6 hours)
- Number of points (target: 100+ for front page)
- Number of comments (target: 30+)
- GitHub stars gained (track hourly on launch day)
- NPM installs in the 48 hours after posting

### If It Doesn't Hit Front Page

This happens to most first attempts. Strategy:
1. Wait 1 week
2. Rewrite title with a different angle
3. Post as a text post (no link) with more narrative
4. Try a Tuesday at 7 AM EST instead

---

## Part 2: Product Hunt

### Timing

- **Day:** Tuesday (highest launch traffic)
- **Time:** Launch at 12:01 AM PT (Pacific Time) — PH resets daily at midnight PT
- **Schedule:** Use Product Hunt's scheduled launch feature (set up 3 days ahead)
- **Do NOT launch same day as Show HN** — space them 3-5 days apart

### Pre-Launch Setup (1 Week Before)

1. **Create a Product Hunt maker account** if you don't have one
2. **Build a "Coming Soon" page** to collect early supporters
3. **Get 5-10 people to be early upvoters** (friends, colleagues, LinkedIn connections)
4. **Prepare all assets** (see below)

### Product Hunt Listing

#### Product Name
```
KindLM
```

#### Tagline (60 char max)
```
Test what your AI agents do, not just what they say
```

#### Description (260 char max)
```
Open-source CLI for behavioral testing of AI agents. 
Verify tool calls, argument validation, and call sequences 
with YAML config. Run in CI/CD. Generate EU AI Act compliance 
docs. MIT licensed.
```

#### Full Description
```markdown
## The Problem

AI agents don't just generate text — they make decisions by calling 
tools. But no testing framework verifies this behavior. Your refund 
agent might skip the fraud check and process a refund anyway. The text 
output looks fine. The behavior is broken.

## What KindLM Does

KindLM adds behavioral assertions to AI agent testing:

🎯 **tool_called** — Verify the agent called the right tool with 
the right arguments
🚫 **tool_not_called** — Verify the agent didn't call dangerous tools
📋 **tool_order** — Verify the correct sequence of tool calls
🔍 **11 total assertion types** including PII detection, schema 
validation, and LLM-as-judge

## How It Works

1. Write a YAML config describing your agent and test cases
2. Run `kindlm test` in your terminal
3. Get pass/fail results with detailed assertion reports
4. Add to CI/CD for continuous behavioral verification

## Why Now

- 80% of AI agent projects fail before production (RAND)
- EU AI Act requires documented testing by August 2026 (€35M penalties)
- No existing tool tests agent tool-calling behavior

## Built By

Created by Petr Kindlmann, QA Automation Engineer with 4+ years 
of Playwright testing experience. Built because AI agents deserve 
the same testing discipline as websites.

🔗 GitHub: https://github.com/kindlmann/kindlm
📖 Docs: https://kindlm.com/docs
🎮 Playground: https://kindlm.com/playground
```

#### Topics
```
- Artificial Intelligence
- Developer Tools
- Open Source
- Testing
- SaaS
```

#### Categories
```
- Developer Tools
- AI
```

### Product Hunt Visual Assets

#### Thumbnail (240×240)
- KindLM logo on dark background
- Clean, minimal, recognizable at small size

#### Gallery Images (1270×760, up to 5)

**Image 1: Hero**
- Split screen: YAML config (left) → terminal output (right)
- Title: "Test AI Agent Behavior"

**Image 2: The Problem**
- Diagram showing: "Agent says ✅ → Agent does ❌"
- Text: "Current tools test output. KindLM tests behavior."

**Image 3: Assertion Types**
- Visual grid of 11 assertion types with icons
- Highlight the 3 unique ones (tool_called, tool_not_called, tool_order)

**Image 4: CI/CD Integration**
- GitHub Actions workflow screenshot
- Title: "Runs in your CI/CD pipeline"

**Image 5: EU AI Act Compliance**
- Compliance report preview
- Title: "Auto-generated compliance documentation"

#### Video (Optional but High Impact)
- 60-second demo: init → config → test → results
- Terminal recording with annotations
- Same video used for YouTube (see Deliverable 5)

### First Comment (Maker Comment)

Post immediately at launch:

```markdown
Hi Product Hunt! 👋

I'm Petr, a QA automation engineer from the Czech Republic. I've 
spent 4+ years writing Playwright tests for news websites. When 
my team started building AI agents, I realized the testing toolkit 
had a massive gap.

Every eval tool I tried tests what agents SAY (text output quality). 
None test what agents DO (tool calls, argument validation, sequences).

So I built KindLM — a CLI that lets you write behavioral assertions 
for AI agents in YAML. It's MIT licensed and runs in CI/CD.

The EU AI Act deadline (August 2026) adds urgency — if your agent 
is in a high-risk category, you need documented testing, and the 
penalties are serious (€35M or 7% of revenue).

I'd love your feedback. Try the playground without installing anything:
https://kindlm.com/playground

Or install: npm install -g @kindlm/cli

Ask me anything! 🧪
```

### Engagement Strategy (Launch Day)

| Time (PT) | Action |
|-----------|--------|
| 12:01 AM | Launch goes live, post maker comment |
| 6:00 AM | Check ranking, respond to all comments |
| 8:00 AM | Share on LinkedIn: "We just launched on Product Hunt" |
| 10:00 AM | Share on Twitter/X |
| 12:00 PM | Mid-day check, respond to new comments |
| 3:00 PM | Share in relevant Discord/Slack communities |
| 6:00 PM | Evening check, thank everyone who upvoted |
| 11:00 PM | Final check, respond to stragglers |

### Product Hunt Launch LinkedIn Post

```
We just launched KindLM on Product Hunt.

It's an open-source tool for testing AI agent behavior — 
not text output, but actual tool calls.

Why it matters:
• 80% of AI agent projects fail before production
• Existing tools test what agents SAY, not what they DO
• EU AI Act requires documented behavioral testing by August 2026

I built it because AI agents deserve the same testing discipline 
as the websites I've been testing for 4 years.

Try it, break it, tell me what's missing.

→ Link in comments
```

### Post-Launch

- **Day 2:** Write a "What we learned from our Product Hunt launch" LinkedIn post (meta-content performs well)
- **Day 3:** Email everyone who commented to say thanks + ask for feedback
- **Week 2:** If you got "Product of the Day" badge, add it to README and landing page

---

## Part 3: Launch Sequence Calendar

### Recommended Order

| Day | Platform | Why This Order |
|-----|----------|---------------|
| **Tuesday Week 6** | Show HN | HN audience gives technical feedback first |
| **Wed-Thu** | Respond to HN, fix any issues raised | Use feedback to improve before PH |
| **Following Tuesday** | Product Hunt | PH audience is broader, benefits from HN credibility |
| **Same Day** | LinkedIn "We launched on PH" post | Cross-promote |
| **Day After PH** | Twitter/X thread about the launch | Third wave |

### Why Stagger (Not Same Day)

1. You can only actively engage one community at a time
2. HN feedback lets you fix issues before PH (broader audience)
3. Each platform amplifies the next ("trending on HN" → PH credibility)
4. Doubles your launch window from 1 day to 1 week of visibility

---

## Part 4: Other Launch Platforms

### Dev.to
- Cross-post Article 3 ("I Built an Open-Source Tool") as launch post
- Tag: #showdev, #opensource, #ai, #testing
- Include "Show DEV" in title

### Reddit
- r/MachineLearning (Sunday "What are you working on?" thread)
- r/LocalLLaMA (if Ollama support is solid)
- r/devops (CI/CD integration angle)
- r/programming (general dev audience)
- **Do NOT post to multiple subreddits on the same day** — looks like spam

### Twitter/X Thread

```
I've been a QA engineer for 4 years. I test websites for a living.

Last year, AI agents started appearing in our products.

I tried to test them the same way I test everything else. 
It didn't work.

🧵 Here's what I learned and what I built:

[Thread of 8-10 tweets covering: the gap, the tool, specific 
assertions, EU AI Act, the playground, installation]
```

### Discord Communities
- Langchain Discord → #showcase channel
- AI Engineers Discord → #projects channel  
- OpenAI Community → Developer forum
- Anthropic Discord → #showcase

Post in each ONCE. Be helpful, not spammy. Answer questions.
