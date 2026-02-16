# Email Sequence Prompts

Paste each into Claude. Output = complete email ready for your ESP (Resend, Loops, ConvertKit, etc.).
Segment: developers who starred the repo, signed up on the site, or downloaded the CLI.


---


## SEQUENCE 1: Onboarding (triggered on npm install or GitHub star)

### Email 1: Welcome (send immediately)

Prompt for Claude:

Write a welcome email from the creator of KindLM, an open-source AI agent testing CLI. The recipient just installed the tool or starred the repo.

Subject: You just installed KindLM — here's your first test in 60 seconds

Body rules:
- Under 150 words
- First line: acknowledge what they did (installed/starred)
- Give them exactly ONE thing to do: create a 5-line YAML file and run `kindlm test`
- Include the actual YAML and command
- Sign off with first name, no company title
- No images, no buttons, plain text feel


### Email 2: First value (send day 3)

Subject: Did your first test pass?

Body: Ask if they ran a test. If not, link to the 5-minute tutorial video. If yes, suggest the next step: adding tool call assertions. Include the 3-line YAML addition. Link to docs. Under 100 words.


### Email 3: Use case nudge (send day 7)

Subject: What does your agent do?

Body: Ask what kind of agent they're testing. Offer 3 links to specific use-case configs: support agent, code assistant, data analyst agent. Under 120 words.


### Email 4: CI integration (send day 14)

Subject: Add KindLM to your CI in 5 minutes

Body: The 5-line GitHub Actions config. The 5-line GitLab CI config. "Once it's in CI, you never deploy a broken agent again." Under 100 words.


### Email 5: Compliance mention (send day 21)

Subject: Your tests can generate compliance docs

Body: Brief mention of --compliance flag. Link to compliance tutorial. Not pushy — "if you serve EU users, you might find this useful." Under 80 words.


---


## SEQUENCE 2: EU AI Act Compliance (targeted at CTOs/VPs who engage with compliance content)

### Email 1: The deadline

Prompt:

Write an email to a CTO or VP Engineering about the EU AI Act August 2026 deadline.

Subject: August 2, 2026 — what your engineering team needs to prepare

Body: State the deadline. State the penalties (7% of revenue). State what's required (documented testing evidence). State what most teams are missing (automated, timestamped test reports). Offer the compliance guide blog post link. Under 200 words. No fear-mongering. Factual.


### Email 2: The gap (send day 4)

Subject: The gap between "we tested it" and compliance

Body: Most teams test their AI informally. Notebooks, one-off scripts, manual checks. EU AI Act requires documented methodology, performance metrics, timestamped records. Explain the gap in 3 sentences. Offer the engineering checklist. Under 150 words.


### Email 3: The demo (send day 8)

Subject: See a compliance report generated in 30 seconds

Body: Link to the 3-minute YouTube tutorial on compliance reports. One-sentence description. "Watch how 3 lines of YAML and one CLI flag produce an Annex IV-mapped audit report." Under 80 words.


### Email 4: The industry angle (send day 14)

Subject: [Fintech/HR-tech/Healthtech] and the EU AI Act — what's specifically required

Body: Customize by industry if possible. If not, cover all three briefly. Each gets 2 sentences: what makes them high-risk and what they need to test. Link to industry-specific blog post. Under 150 words.


### Email 5: The CTA (send day 21)

Subject: Start generating compliance evidence this week

Body: Direct CTA. Install command. Link to getting-started docs. "Your legal team will thank you when auditors come knocking." Under 60 words.


---


## SEQUENCE 3: Re-engagement (triggered when user hasn't run tests in 30 days)

### Email 1:

Subject: Your AI agent hasn't been tested in a month

Body: "Models get updated. Prompts drift. A month is a long time in AI. Run `kindlm test` and see if your baseline still holds." Under 50 words.


---


## NEWSLETTER: Monthly update template

Prompt for Claude:

Write a monthly newsletter for KindLM users. Template structure:

1. **What shipped this month** — 2-3 new features, one sentence each with link to docs
2. **Interesting finding** — one technical insight from the community (anonymized). Example: "A user found their agent's tool call accuracy dropped 8% after switching to a newer model version"
3. **Content roundup** — links to this month's blog posts and videos
4. **Community spotlight** — highlight one user contribution (PR, config example, bug report)
5. **What's next** — one sentence about next month's focus

Rules: Under 300 words total. Plain text feel. No heavy formatting. Feels like a personal update, not a marketing email.
