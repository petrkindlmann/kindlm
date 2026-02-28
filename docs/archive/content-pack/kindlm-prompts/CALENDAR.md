# Campaign Calendar — Which Prompts to Run When

## WEEK 1-2: Foundation Launch

| Day | Action | Prompt File |
|-----|--------|-------------|
| Day 1 | Generate all Midjourney images | `06-midjourney-images/all-images.md` — run all blog headers + social cards |
| Day 1 | Generate Suno background tracks | `11-suno-music/all-tracks.md` — run all 6 tracks |
| Day 1 | Write launch blog post | `03-blog-posts/POST 01` → Claude |
| Day 2 | Record terminal demos with asciinema | Manual — `kindlm test` runs for each scenario |
| Day 2 | Generate launch video | `01-heygen-videos/01-launch-what-is-kindlm.md` → HeyGen |
| Day 2 | Generate B-roll clips 01, 02, 09 | `02-sora-broll/CLIP 01, 02, 09` → Sora 2 |
| Day 3 | Publish GitHub repo with polished README | Manual |
| Day 3 | Post Show HN | `08-product-hunt/launch-day-copy.md` → HN section |
| Day 3 | Post launch thread on Twitter | `04-twitter-threads/THREAD 01` → Claude → Twitter |
| Day 3 | Post LinkedIn launch | `05-linkedin-posts/POST 01` → Claude → LinkedIn |
| Day 4 | Generate tool call tutorial video | `01-heygen-videos/02-tutorial-tool-call-assertions.md` → HeyGen |
| Day 5 | Write + publish tool call blog post | `03-blog-posts/POST 02` → Claude |
| Day 7 | Post storytelling thread | `04-twitter-threads/THREAD 06` → Claude → Twitter |
| Day 8 | Write EU AI Act blog post | `03-blog-posts/POST 03` → Claude |
| Day 10 | Generate compliance tutorial video | `01-heygen-videos/03-tutorial-compliance.md` → HeyGen |
| Day 10 | Post EU AI Act thread | `04-twitter-threads/THREAD 03` → Claude → Twitter |
| Day 12 | Post LinkedIn compliance post | `05-linkedin-posts/POST 02` → Claude → LinkedIn |
| Day 14 | Submit to DevHunt, BetaList, Uneed | `08-product-hunt/launch-day-copy.md` → cross-post section |

## WEEK 3-4: Content Flywheel

| Day | Action | Prompt File |
|-----|--------|-------------|
| Day 15 | Write comparison blog post | `03-blog-posts/POST 04` → Claude |
| Day 16 | Generate quick demo clips (60s) | `01-heygen-videos/05-06` → HeyGen |
| Day 17 | Post model comparison thread | `04-twitter-threads/THREAD 04` → Claude → Twitter |
| Day 18 | Post LinkedIn multi-model post | `05-linkedin-posts/POST 05` → Claude → LinkedIn |
| Day 19 | Generate YouTube tutorial: 5 min getting started | `07-youtube-scripts/VIDEO 01` → Claude → HeyGen |
| Day 20 | Write drift detection blog post | `03-blog-posts/POST 06` → Claude |
| Day 21 | Post build-in-public update thread | `04-twitter-threads/THREAD 05` → Claude → Twitter |
| Day 22 | Write CI pipeline blog post | `03-blog-posts/POST 07` → Claude |
| Day 23 | Post PII thread | `04-twitter-threads/THREAD 07` → Claude → Twitter |
| Day 25 | Post LinkedIn documentation gap | `05-linkedin-posts/POST 03` → Claude → LinkedIn |
| Day 28 | Send first onboarding email sequence | `10-email-sequences/SEQUENCE 1` → Claude → ESP |

## WEEK 5-6: Product Hunt Amplification

| Day | Action | Prompt File |
|-----|--------|-------------|
| Day 29 | Prep all PH assets | `08-product-hunt/launch-day-copy.md` — screenshots, copy |
| Day 30 | Generate B-roll clips 03, 04, 05 | `02-sora-broll/CLIP 03, 04, 05` → Sora 2 |
| Day 31 | Generate PH launch video (3 min overview) | Combine videos 01 + 02 clips or create new from `07-youtube-scripts/VIDEO 01` |
| Day 33 | **PRODUCT HUNT LAUNCH DAY** | `08-product-hunt/launch-day-copy.md` — all fields |
| Day 33 | Cross-post to HN, Reddit, DevHunt | `08-product-hunt/launch-day-copy.md` — cross-post section |
| Day 33 | Post launch thread Twitter | New thread announcing PH launch |
| Day 33 | Post LinkedIn launch update | `05-linkedin-posts/POST 01` variant |
| Day 35 | Write agent failures thought piece | `03-blog-posts/POST 08` → Claude |
| Day 36 | Post testing-in-2026 thread | `04-twitter-threads/THREAD 08` → Claude → Twitter |
| Day 38 | Generate YouTube: EU AI Act for engineers | `07-youtube-scripts/VIDEO 02` → Claude → HeyGen |
| Day 40 | Post LinkedIn thought leadership | `05-linkedin-posts/POST 07` → Claude → LinkedIn |
| Day 42 | Write fintech use case blog post | `03-blog-posts/POST 05` → Claude |

## WEEK 7-10: Compliance Push (May-June 2026)

| Day | Action | Prompt File |
|-----|--------|-------------|
| Day 43 | Start compliance content wave | `09-compliance-content/COMPLIANCE BLOG 01` → Claude |
| Day 45 | Generate compliance video mini-series (5 parts) | `09-compliance-content/COMPLIANCE HEYGEN` → Claude → HeyGen |
| Day 47 | Post 90-day countdown thread | `09-compliance-content/COMPLIANCE TWITTER` → Claude → Twitter |
| Day 49 | Write audit-ready reports blog | `09-compliance-content/COMPLIANCE BLOG 02` → Claude |
| Day 50 | Launch compliance email sequence | `10-email-sequences/SEQUENCE 2` → Claude → ESP |
| Day 52 | Start weekly LinkedIn countdown | `09-compliance-content/COMPLIANCE LINKEDIN` → Claude → LinkedIn |
| Day 55 | Write fintech compliance blog | `09-compliance-content/COMPLIANCE BLOG 03` → Claude |
| Day 60 | Write HR-tech compliance blog | `09-compliance-content/COMPLIANCE BLOG 04` → Claude |
| Day 63 | Generate YouTube: 5 testing patterns | `07-youtube-scripts/VIDEO 03` → Claude → HeyGen |
| Day 70 | Generate YouTube: model comparison | `07-youtube-scripts/VIDEO 04` → Claude → HeyGen |
| Day 75 | Post LinkedIn long-form article | `05-linkedin-posts/POST 08` → Claude → LinkedIn |
| Day 80+ | Continue weekly: 2 threads + 2 LinkedIn + 1 blog + 1 video | Rotate through remaining prompts |

## ONGOING (every week after launch)

- Monday: Twitter thread (rotate through prompts, create new variants)
- Tuesday: 60-second demo clip (HeyGen)
- Wednesday: Blog post (Claude)
- Thursday: LinkedIn post (Claude)
- Friday: Build-in-public update thread (Twitter)
- Monthly: Newsletter (`10-email-sequences/NEWSLETTER template`)
- Monthly: YouTube deep-dive tutorial
