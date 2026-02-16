# YouTube Script Prompts

Workflow: Paste prompt into Claude → get script → paste script into HeyGen → overlay terminal recordings.
All videos use same AI avatar for consistency.


---


## VIDEO 01: "Test Your AI Agent in 5 Minutes" (5 min, beginner tutorial)

SYSTEM: You are a developer educator creating a YouTube tutorial script. The audience is an AI engineer who has never used KindLM. Write a script that can be read by an AI avatar in HeyGen, with clear markers for when to show terminal recordings.

Write a 5-minute tutorial script for "Test Your AI Agent in 5 Minutes with KindLM."

Structure:
[0:00-0:30] Hook — "Your AI agent is in production. You changed a prompt last week. How do you know it still works?" Quick problem statement.
[0:30-1:00] What KindLM is — one sentence. Install command. [SCREEN: terminal showing npm install]
[1:00-2:00] Write your first test — create kindlm.config.yaml. Walk through each line. [SCREEN: file being created in editor]
[2:00-3:00] Define assertions — tool calls and judge criteria. [SCREEN: YAML file with highlights]
[3:00-4:00] Run it — `kindlm test`. Walk through every line of output. [SCREEN: terminal output appearing line by line]
[4:00-4:30] Add to CI — show the 5-line GitHub Actions config. [SCREEN: workflow YAML]
[4:30-5:00] Wrap up — "You just added regression tests to your AI agent. Docs link below."

Rules: Short sentences (8-12 words max for avatar clarity). Use [pause] for breathing. Use [SCREEN: description] for overlay cues. Conversational tone — "let me show you" not "we will now demonstrate."


---


## VIDEO 02: "EU AI Act for Engineers — What You Actually Need to Do" (8 min, deep dive)

SYSTEM: You are a technical educator explaining EU regulation to engineers. No legal jargon. Every concept is translated to an engineering equivalent.

Write an 8-minute script explaining the EU AI Act for engineers.

Structure:
[0:00-0:45] Hook — "August 2026. If your AI system scores credit, screens resumes, or diagnoses patients — this video matters."
[0:45-2:00] What is it — the world's first comprehensive AI regulation. Risk tiers explained with engineering analogies. [SCREEN: risk tier diagram]
[2:00-3:30] What's high-risk — Annex III categories listed with real examples. "If you're reading this and thinking 'that's us' — keep watching." [SCREEN: Annex III list]
[3:30-5:00] What you need to document — Article 11 requirements translated to engineering tasks. Testing methodology = automated test suite. Performance metrics = tracked scores. Risk management = monitored alerts. [SCREEN: requirements mapping table]
[5:00-6:30] How to automate it — KindLM demo. Show writing tests, running with --compliance, the generated report. [SCREEN: full terminal demo]
[6:30-7:30] What this looks like in CI — automated compliance report on every deploy. [SCREEN: CI pipeline with compliance step]
[7:30-8:00] Wrap up — "Start now. Don't wait for the deadline." Links to docs and compliance spec.

Rules: Same avatar rules. Mark every screen transition. Include specific article numbers (Article 11, Annex III, Annex IV) so viewers can reference them.


---


## VIDEO 03: "5 AI Agent Testing Patterns Every Team Needs" (10 min, patterns overview)

Write a 10-minute script covering 5 essential testing patterns:

Pattern 1: Tool Call Verification — assert which tools are called and with what args.
Pattern 2: Negative Tool Assertions — assert tools that must NEVER be called.
Pattern 3: LLM Judge Quality Gates — score output against custom criteria.
Pattern 4: PII Detection — catch personal data leaks before they reach users.
Pattern 5: Baseline Drift — detect when behavior changes without code changes.

For each pattern: (1) 30s explaining the failure mode it catches. (2) 30s showing the YAML config. (3) 30s showing the test output. Total ~10 minutes.

[SCREEN] markers for every terminal recording and YAML display.


---


## VIDEO 04: "I Tested My Agent Against 3 Models. Here's What I Found." (7 min, experiment)

Write a 7-minute script about multi-model comparison testing.

The experiment: Take a customer support agent with 6 test scenarios. Run against Claude Sonnet 4, GPT-4o, and Gemini 2 Flash. Compare: pass rates, judge scores, latency, cost per run, specific failure modes.

Structure: Setup (1 min) → Run tests (2 min of screen recordings) → Analyze results (3 min) → Takeaway (1 min).

Make it feel like a real experiment with real results, not a marketing comparison.
