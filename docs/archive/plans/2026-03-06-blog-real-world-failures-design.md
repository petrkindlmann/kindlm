# Design: Blog Post — 3 AI Agent Disasters That Testing Would Have Prevented

## Goal

Tutorial-style blog post covering 3 real AI agent production failures, each with a reconstructed KindLM test suite and live test output showing how testing catches the failure.

## Incidents

| Incident | Failure | Assertions |
|----------|---------|------------|
| Air Canada chatbot hallucinated refund policy | Made up non-existent policy | `keywords_absent`, `judge`, `no_pii` |
| Cursor "Sam" bot invented login policy | Fabricated "expected behavior" | `judge`, `keywords_absent` |
| Zomato Nugget refused human escalation | Failed to call escalation tool | `tool_called`, `judge` |

## Blog Structure (~800 words)

1. Intro — real cost of untested agents
2. Incident 1: Air Canada — story + YAML + test output
3. Incident 2: Cursor — story + YAML + test output
4. Incident 3: Zomato — story + YAML + test output
5. Conclusion — all three are testable behavioral failures

## Infrastructure Needed

- `site/lib/blog.ts` — content loader (mirrors `docs.ts`)
- `site/app/blog/page.tsx` — blog index
- `site/app/blog/[slug]/page.tsx` — individual post
- `site/app/blog/layout.tsx` — blog layout
- `site/content/blog/` — markdown files with frontmatter
- Update sitemap + nav

## Test Configs

- `examples/air-canada.yaml`
- `examples/cursor-sam.yaml`
- `examples/zomato-nugget.yaml`

## Testing

Live runs with `openai:gpt-4o-mini`. Capture output for blog screenshots/snippets.
