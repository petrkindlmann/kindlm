# Twitter/X Thread Prompts

Paste each prompt into Claude. Output = ready-to-post thread.
Rules for all threads: No emojis except ✓ and ✗. No hashtags. No "thread incoming 🧵". Just start.


---


## THREAD 01: Launch Announcement

Write a 6-tweet thread announcing KindLM, an open-source testing framework for AI agents.

Tweet 1: Hook — state the core problem in under 200 characters. Something like "Your AI agent passed all tests. Then it approved a refund without checking the order. Here's why output-based testing isn't enough."

Tweet 2: What KindLM does — tool call assertions, LLM judge, drift detection, compliance. One sentence each.

Tweet 3: Show a minimal YAML config (8-10 lines). Use a code block screenshot format — write it as plain text the user can screenshot.

Tweet 4: Show the CLI output of `kindlm test` — the pass/fail results with the terminal aesthetic.

Tweet 5: The compliance angle — one line about EU AI Act, the --compliance flag, what it generates.

Tweet 6: CTA — GitHub link, npm install command, "open source, MIT, no account needed."

Tone: Builder sharing their work. Not corporate announcement.


---


## THREAD 02: "Why I stopped trusting LLM eval scores"

Write a 5-tweet thread about why aggregate eval scores are misleading for AI agents.

Tweet 1: "I had a 94% eval score on my agent. It was broken. Here's what happened."

Tweet 2: The problem — aggregate scores hide specific failures. The agent scored well on output quality but was calling the wrong tools 12% of the time.

Tweet 3: The fix — testing what agents DO, not just what they SAY. Tool call assertions catch behavior failures that output evals miss.

Tweet 4: Show a specific example — an agent that produces a helpful refund message but never actually calls the refund API.

Tweet 5: "If you test AI agents, test the decisions. Not just the text." Link to KindLM.


---


## THREAD 03: "EU AI Act explained for engineers"

Write a 7-tweet thread explaining the EU AI Act to engineers who haven't read it.

Tweet 1: "The EU AI Act becomes enforceable for high-risk systems on August 2, 2026. If you deploy AI in hiring, finance, health, or education — this affects you. Here's what engineers need to know."

Tweet 2: What counts as high-risk — list Annex III categories in plain language.

Tweet 3: What you need to document — testing methodology, performance metrics, risk management. Article 11 requirements in plain English.

Tweet 4: The penalties — up to 7% of global annual revenue. Compare to GDPR (4%).

Tweet 5: What most teams are doing wrong — manual testing with no audit trail. "We tested it" isn't compliance.

Tweet 6: What compliance testing actually looks like — automated, timestamped, repeatable, documented.

Tweet 7: "We built a --compliance flag into KindLM that generates Annex IV documentation from your existing tests. Open source." Link.


---


## THREAD 04: "I tested the same agent with Claude and GPT-4o"

Write a 5-tweet thread about multi-model testing results.

Tweet 1: "Same agent. Same 8 tests. Claude vs GPT-4o. Here are the actual results."

Tweet 2: Pass rates — Claude 8/8, GPT-4o 7/8. The failure: GPT-4o skipped lookup_order on one scenario.

Tweet 3: Judge scores — Claude averaged 0.91, GPT-4o averaged 0.87. The specific criterion that differed.

Tweet 4: Cost and latency — actual numbers per run. Which model gives better value.

Tweet 5: "The point isn't that one model is better. It's that you need data, not opinions, to make this decision." Link to multi-model testing docs.


---


## THREAD 05: "Build in public update — week 1"

Write a 5-tweet thread sharing the first week of KindLM development progress.

Tweet 1: "Week 1 of building KindLM in public. Here's what happened."

Tweet 2: Stars/downloads/feedback received. What surprised you.

Tweet 3: The hardest technical decision this week — and what you chose.

Tweet 4: What's coming next week — specific feature with a preview.

Tweet 5: Ask for input — "What's the first thing you'd test on your AI agent?" Link to repo.


---


## THREAD 06: "The deploy that broke everything" (storytelling)

Write a 6-tweet thread telling the story of a production AI agent failure.

Tweet 1: "Friday 4pm. Merged a prompt tweak. Looked good in staging. Deployed."

Tweet 2: "Monday 9am. Support tickets flooding in. The agent was approving every refund request — even for orders that didn't exist."

Tweet 3: "What happened: The prompt change removed a sentence that told the agent to verify orders. It started hallucinating order details instead of calling lookup_order."

Tweet 4: "The output looked perfect. Professional, empathetic, detailed. It just… made up everything."

Tweet 5: "No test caught it because we were testing the text, not the behavior. The text was great. The decisions were catastrophic."

Tweet 6: "This is why we built KindLM. Test the tool calls. Test the decisions. Not just the words." Link.


---


## THREAD 07: "PII detection your agent needs" (weekly insight)

5 tweets about PII leaks in AI agent responses.

Tweet 1: "Your AI agent is probably leaking PII. Here's how to test for it."

Tweet 2: Common patterns — SSN, credit card, email, phone embedded in agent responses that shouldn't contain them.

Tweet 3: Why it happens — the agent pulls customer data via tool calls and includes it in the response text.

Tweet 4: The fix — KindLM's guardrails.pii config, show the YAML (3 lines).

Tweet 5: "Zero tolerance by default. One PII leak = test failure." Link.


---


## THREAD 08: "What 'testing AI' actually means in 2026"

5 tweets reframing AI testing for the current landscape.

Tweet 1: "In 2024, 'testing AI' meant eval benchmarks. In 2026, it means regression tests that block deploys. Here's the shift."

Tweet 2: Eval benchmarks tell you how good a model is. Regression tests tell you if your agent still works after a change. Different questions.

Tweet 3: What regression testing for agents includes — tool calls, output quality, drift, compliance, PII, cost tracking.

Tweet 4: Why YAML + CLI wins over Python frameworks — any engineer on the team can read and contribute. No ML background needed.

Tweet 5: "Testing AI is now a CI problem, not a research problem." Link to getting started guide.
