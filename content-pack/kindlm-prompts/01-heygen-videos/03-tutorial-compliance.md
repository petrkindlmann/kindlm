# VIDEO 03: Tutorial — "EU AI Act Compliance in One Command" (3 min)

## HeyGen Settings
- Same avatar, same background
- Resolution: 1080p landscape

## Script

---

August second, twenty twenty-six. That's when the EU AI Act starts enforcing compliance for high-risk AI systems. If your product uses AI for hiring, credit scoring, medical decisions, or education, you need documentation proving your system was tested.

[pause]

The penalties? Up to seven percent of global annual revenue. Not a typo. Seven percent.

[pause]

Let me show you how KindLM generates compliance documentation automatically.

[pause]

Take any existing KindLM test suite. As you can see on screen, I'm running the same support agent tests we wrote before. But this time I add one flag. Dash dash compliance.

[pause]

KindLM runs all your tests, then generates a markdown report mapped to EU AI Act Annex Four. It includes the test date, a SHA-256 hash for tamper detection, every test result, judge scores, tool call logs, and a risk assessment summary.

[pause]

The report maps directly to what Article Eleven requires. Risk management evidence. Testing methodology. Performance metrics. Monitoring approach.

[pause]

Every time you run this in CI, you build a timestamped audit trail. When an auditor asks for evidence that your AI system was tested before deployment, you hand them the folder.

[pause]

No consultants. No manual documentation. One CLI flag on the tests you're already running.

[pause]

The compliance spec is open source. You can customize the report template, add your company header, and adjust the risk tier classification. Everything is in the docs.

---

## Overlay plan
- 0:00-0:30 → Avatar (EU AI Act context, penalties)
- 0:30-0:50 → Screen: Terminal `kindlm test --compliance`
- 0:50-1:30 → Screen: Generated compliance report scrolling through sections
- 1:30-2:00 → Screen: Side-by-side of Annex IV requirements vs KindLM report sections
- 2:00-2:30 → Screen: CI pipeline showing compliance report generation on each push
- 2:30-3:00 → Avatar (wrap up + CTA)
