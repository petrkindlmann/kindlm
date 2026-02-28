# KindLM Content Calendar & LinkedIn/Medium Strategy

## Publishing Strategy

### LinkedIn Algorithm Insights (2026)

Based on current research:

- **LinkedIn now rewards depth over frequency.** The algorithm prioritizes "dwell time" and "save-ability" over vanity likes. Posts that people spend time reading and save rank higher.
- **2–5 posts per week is optimal.** Members posting 2x/week see 5x more profile views.
- **Short hooks win.** One punchy sentence above the fold, then a tight breakdown below.
- **Linkless posts outperform.** Posts without external links get better organic reach. Put links in first comment.
- **Comments > Likes.** The algorithm weights meaningful comments heavily. 24% more comments year-over-year.
- **Video is growing (36% YoY)** but text posts with images still perform well for technical audiences.
- **Anti-AI-slop:** Over 50% of long-form LinkedIn posts are now AI-generated. The algorithm and audience have developed immunity. Real experiences, real terminal output, real code = credibility.
- **189% increase** in AI-generated posts since ChatGPT launched. Standing out requires authentic voice and technical specificity.

### Content Principles

1. **Lead with data, not claims.** Every post cites specific numbers (RAND, Deloitte, APEX-Agents, EU AI Act text).
2. **Show, don't tell.** Real YAML configs, real terminal output, real error messages.
3. **Builder narrative.** "I'm building this" > "you should use this." LinkedIn rewards personal stories.
4. **No buzzwords.** No "revolutionary," "game-changing," "cutting-edge." Technical specificity is the differentiator.
5. **One idea per post.** Each LinkedIn post makes ONE point. The Medium article goes deep.

---

## 6-Week Publishing Calendar

### Week 1: The Problem (Awareness)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Tue** | LinkedIn | Post 1: "The €35M Bug" | Agent Failure Stats (#01) |
| **Wed** | Medium | Article 1: "The €35M Bug" (full 8-min read) | — |
| **Thu** | LinkedIn | Repost Article 1 link with pull quote | — |

**Goal:** Establish the problem. Get people asking "wait, nobody tests agent behavior?"

---

### Week 2: The Engineering Discipline (Education)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Tue** | LinkedIn | Post 2: "80% Fail — Engineering Discipline" | Three Layers Stack (#04) |
| **Wed** | Medium | Article 2: "80% of AI Agents Fail" (full 7-min read) | — |
| **Fri** | LinkedIn | Short follow-up: "One stat that changed how I think about AI testing" (pick one stat, expand) | — |

**Goal:** Position behavioral testing as the solution. Introduce the 3-layer framework.

---

### Week 3: The Builder Story (Personal Brand)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Tue** | LinkedIn | Post 3: "I Built an Open-Source Tool" | Testing Gap Comparison (#03) |
| **Wed** | Medium | Article 3: "I Spent 4 Years Testing Websites" (full 6-min read) | — |
| **Thu** | LinkedIn | "Here's the exact YAML config that catches the bug nobody else catches" (code snippet post) | — |

**Goal:** Humanize the project. Build-in-public credibility. Show real code.

---

### Week 4: EU AI Act Deep Dive (Urgency)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Tue** | LinkedIn | Post 4: "168 Days" EU AI Act Countdown | EU AI Act Timeline (#02) |
| **Wed** | Medium | Article 4: "The EU AI Act Compliance Clock" (full 7-min read) | — |
| **Fri** | LinkedIn | "6 things the EU AI Act requires from engineering teams (not legal)" (educational list post) | — |

**Goal:** Create urgency around August 2026 deadline. Position KindLM as compliance solution.

---

### Week 5: Technical Deep Dive (Authority)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Tue** | LinkedIn | Post 5: "Tool Call Assertions" | Assertion Types quad (#05, create in Canva) |
| **Wed** | Medium | Article 5: "Tool Call Assertions: The Missing Primitive" (full 6-min read) | — |
| **Thu** | LinkedIn | "The difference between tracing and testing" (short educational post) | — |

**Goal:** Establish technical authority. Own the "tool call assertion" concept.

---

### Week 6: Launch Week (Conversion)

| Day | Platform | Content | Infographic |
|-----|----------|---------|-------------|
| **Mon** | LinkedIn | "Tomorrow I'm open-sourcing the tool I've been building for the past few months" (teaser) | — |
| **Tue** | LinkedIn + Medium | Launch post: "KindLM is live. Here's why." | All infographics |
| **Tue** | Hacker News | Show HN post | — |
| **Wed** | LinkedIn | "24 hours since launch. Here's what happened." (real metrics) | — |
| **Thu** | Twitter/X | Launch thread (5 tweets with GIF of terminal output) | — |
| **Fri** | LinkedIn | Thank you + "What should I build next?" (engagement post) | — |

**Goal:** Convert awareness into GitHub stars and npm installs.

---

## Infographic Usage Map

| Infographic | File | Used In | Format |
|-------------|------|---------|--------|
| #01 Agent Failure Stats | `01-agent-failure-stats.html` | LinkedIn Post 1, Article 1 | 1080px card, dark theme |
| #02 EU AI Act Timeline | `02-eu-ai-act-timeline.html` | LinkedIn Post 4, Article 4 | 1080px card, dark theme |
| #03 Testing Gap Comparison | `03-testing-gap-comparison.html` | LinkedIn Post 3, Article 3 | 1080px card, dark theme |
| #04 Three Layers Stack | `04-three-layers-stack.html` | LinkedIn Post 2, Article 2 | 1080px card, dark theme |

### How to Export Infographics

The HTML files are self-contained and designed for screenshotting:

1. Open the `.html` file in Chrome
2. Right-click → Inspect → Toggle device toolbar → Set to 1080px width
3. Screenshot the card element
4. Or use a tool like `html2canvas` or Puppeteer for automated export

All infographics use the same design system:
- Dark navy background (`#0d1225`)
- Inter font family
- 1080px width (LinkedIn optimal)
- Consistent KindLM branding (bottom-right)
- Color palette: Red (#ef4444) for urgency, Blue (#3b82f6) for KindLM, Green (#22c55e) for positive, Purple (#8b5cf6) for features

---

## AI Image Generation Prompts

For hero images on Medium articles, use these with Midjourney, DALL-E 3, or similar:

### Article 1 Hero:
```
A dramatic split-screen visualization: left side shows a friendly chatbot interface with green checkmarks, right side shows a dark terminal with red warnings about skipped tool calls. Clean modern tech aesthetic, dark background, cyan and red neon accent colors. 16:9 aspect ratio, photorealistic render. --ar 16:9 --v 6
```

### Article 2 Hero:
```
A construction site metaphor for AI engineering: a half-built modern glass skyscraper with visible steel reinforcement being installed by cranes. Blueprint papers on a table in the foreground. Photorealistic, dramatic dawn lighting, the invisible structure making the building stand. --ar 16:9 --v 6
```

### Article 3 Hero:
```
A dark terminal window filling the frame, showing colorful test output with green checkmarks and one red X failure. Subtle glow effect from the screen. Clean modern monospace font, cyber aesthetic. Shot from slightly above angle looking at a desk. --ar 16:9 --v 6
```

### Article 4 Hero:
```
A large digital countdown clock displaying "168 DAYS" in bold red LED digits against a dark navy background. Subtle EU flag stars pattern visible. Professional and urgent but not alarmist. Clean minimal composition. --ar 16:9 --v 6
```

### Article 5 Hero:
```
Abstract visualization of an AI agent's decision tree: glowing nodes representing tool calls connected by flowing light streams showing execution sequence. Green path shows correct flow, red dotted path shows broken flow where a step is skipped. Circuit board meets flowchart aesthetic, dark background. --ar 16:9 --v 6
```

---

## Engagement Strategy

### Pre-Launch (Weeks 1–5)

- **Comment on 5 posts/day** in AI, testing, and compliance spaces
- **Connect with 10 people/week** who post about AI agents, LLM evaluation, EU AI Act
- **Engage genuinely** — share specific insights, not "great post!"
- **Reply to every comment** on your own posts within 2 hours

### Launch Week (Week 6)

- **Activate your network:** DM 20 people who engaged with your pre-launch content. "Hey, the thing I've been writing about is live. Would love your honest feedback."
- **Cross-post carefully:** LinkedIn, Twitter/X, Hacker News, Reddit r/MachineLearning (different format for each)
- **Monitor and respond:** First 2 hours after posting are critical for algorithm. Be actively replying.

### Post-Launch (Ongoing)

- **2 LinkedIn posts/week** (one technical insight, one update/story)
- **1 Medium article/month** (deep technical content)
- **Monthly metrics review:** Profile views, post impressions, GitHub stars correlation, npm downloads

---

## Key Metrics to Track

| Metric | Tool | Target (Month 1) |
|--------|------|-------------------|
| LinkedIn impressions | LinkedIn Analytics | 50K+ total |
| LinkedIn profile views | LinkedIn Analytics | 1,000+ |
| Medium reads | Medium Stats | 5,000+ total across articles |
| Medium followers | Medium Stats | 200+ |
| GitHub stars | GitHub | 500+ |
| npm weekly downloads | npm | 100+ |
| Inbound DMs/messages | LinkedIn | 20+ |

---

## Content Repurposing

Each Medium article generates multiple pieces:

1. **Medium article** (original, 6–8 min read)
2. **LinkedIn post** (condensed, hook-first, <300 words)
3. **Infographic** (1 stat card or comparison)
4. **Twitter/X thread** (5 tweets, one key insight per tweet)
5. **Short LinkedIn post** (single stat or quote, 3–5 lines)
6. **YouTube short** or **screen recording** (terminal demo, 60 seconds)

One article = 6 pieces of content across platforms. Publish over 7–10 days.
