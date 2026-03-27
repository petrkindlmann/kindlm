# Features Research: AI Agent Testing & Eval Tools

> Research date: 2026-03-27
> Competitors analyzed: promptfoo, Braintrust, Humanloop, LangSmith, Arize Phoenix
> Focus: What must v1.0 have for solo dev adoption? What's KindLM's unique angle?

---

## Competitive Landscape Summary

| Capability | promptfoo | Braintrust | LangSmith | Arize Phoenix | KindLM (current) |
|---|---|---|---|---|---|
| Open source | Yes (MIT) | Partial (SDK open) | No | Yes (Apache 2.0) | Yes (MIT) |
| CLI-first | Yes | No (SDK-first) | No (SDK-first) | No (notebook/UI) | **Yes** |
| Config-as-code | YAML | Code (TS/Python) | Code (Python) | Code (Python) | **YAML** |
| Assertion types | 30+ | Custom scorers | Custom evaluators | LLM-as-judge + templates | 11 |
| Provider count | 50+ | Any (custom) | Any (custom) | Any (custom) | 6 |
| Red teaming | **Yes (major feature)** | No | No | No | No |
| Tracing/observability | No | **Yes (core)** | **Yes (core)** | **Yes (core)** | Basic (OTLP ingest) |
| Prompt management | No | Yes (playground) | **Yes (core)** | Yes (versioned) | No |
| Datasets/golden sets | YAML inline | **Yes (UI + API)** | **Yes (UI + API)** | **Yes (UI + API)** | YAML inline |
| CI/CD integration | GitHub Action | API upload | API upload | API upload | JUnit + exit codes |
| Web dashboard | Basic viewer | **Full platform** | **Full platform** | **Full platform** | Dashboard (18 pages) |
| Human annotation | No | Yes (queues) | Yes (queues) | No | No |
| Online/production eval | No | Yes | Yes | Yes | No |
| Compliance/regulatory | No | No | No | No | **Yes (EU AI Act)** |
| Tool call assertions | No (custom JS only) | No (custom scorer) | No (custom evaluator) | No | **Yes (native)** |
| Baseline/drift detection | No | Experiment comparison | Experiment comparison | No | **Yes (native)** |
| Cost tracking | Per-eval cost display | Yes | Yes | Yes | Yes (assertions + budgets) |
| Self-hostable | Yes (local only) | Yes (enterprise) | Yes (enterprise) | Yes | Cloud only (v1) |

---

## Table Stakes for v1.0 (Solo Dev Adoption)

These are non-negotiable. If any are missing, solo devs will not adopt. KindLM status noted.

### 1. `npx` Quick Start (HAVE)
Every competitor has a <5 minute path from zero to first eval. promptfoo's `npx promptfoo@latest init` is the gold standard.
- KindLM: `npx @kindlm/cli init` exists, generates `kindlm.yaml`
- **Status: Done. Verify it works E2E before v1.**

### 2. YAML/Declarative Config (HAVE)
promptfoo proved YAML config is the right UX for CLI-first tools. Braintrust/LangSmith use code-first, but their audience is different (platform users, not CLI users).
- KindLM: Zod-validated YAML config with template interpolation
- **Status: Done.**

### 3. Multi-Provider Support (HAVE, but gap)
promptfoo supports 50+ providers. KindLM has 6 (OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama). The critical question: does KindLM support the models solo devs actually use?
- Must-have for v1: OpenAI, Anthropic, Ollama (local). All present.
- Nice-to-have: Azure OpenAI, AWS Bedrock. These are enterprise; can wait.
- **Gap: Custom HTTP provider.** promptfoo's `http://` provider lets users point at any API. This is the escape hatch that prevents "your tool doesn't support my provider" complaints. KindLM should add a generic HTTP adapter.
- **Status: Core 3 covered. Add HTTP adapter for v1.1 at latest.**

### 4. Deterministic Assertions (HAVE)
String matching, JSON schema validation, regex, keyword checks. Every tool has these.
- promptfoo: equals, contains, icontains, starts-with, regex, is-json, contains-json, is-valid-openai-function-call, is-valid-openai-tools-call, javascript, python, levenshtein, latency, cost, perplexity, etc.
- KindLM: tool_called, tool_not_called, tool_order, schema, keywords_present, keywords_absent, no_pii, latency, cost, classification, output
- **Status: Done. Coverage is solid for behavioral testing angle.**

### 5. LLM-as-Judge (HAVE)
Every competitor has this. It's table stakes for any eval beyond exact match.
- promptfoo: llm-rubric, answer-relevance, context-faithfulness, g-eval
- LangSmith: Custom LLM evaluators with structured output
- KindLM: `judge` assertion with configurable criteria and threshold
- **Status: Done.**

### 6. CI/CD Integration with Exit Codes (HAVE)
Solo devs put this in GitHub Actions. Exit 0 = pass, exit 1 = fail.
- promptfoo: GitHub Action that posts before/after comparison as PR comment
- KindLM: JUnit XML reporter + exit code + `--gate` threshold
- **Gap: No GitHub Action that posts results as PR comment.** This is a significant DX gap vs promptfoo. The JUnit reporter works with generic CI, but the PR comment flow is much more compelling.
- **Status: Core works. GitHub Action with PR comments should be v1.0 or v1.1.**

### 7. Result Caching (PARTIAL)
LLM calls are expensive and slow. Every tool caches results.
- promptfoo: Built-in filesystem cache, cache key includes prompt + vars + provider
- KindLM: **Not confirmed.** The runner has retry logic but caching is not evident in the engine.
- **Status: Must verify. If missing, add before v1.0. This is a money-saver for solo devs iterating.**

### 8. Multiple Runs / Statistical Aggregation (HAVE)
LLMs are non-deterministic. Running N times and aggregating is standard.
- promptfoo: `repeat` field in config
- KindLM: `repeat` in config, aggregator with mean/p50/p95
- **Status: Done.**

### 9. Pretty Terminal Output (HAVE)
The default output must look good in a terminal. Color-coded pass/fail, summary stats.
- KindLM: chalk-based pretty reporter
- **Status: Done.**

### 10. Side-by-Side Model Comparison (HAVE)
Run same test across multiple models, see results side by side.
- promptfoo: Matrix view (prompts x providers) in web UI
- KindLM: Config supports multiple models per test, but display is per-test not matrix
- **Gap: No matrix/comparison view in terminal or dashboard.** promptfoo's matrix view is iconic.
- **Status: Data is there. Matrix display is v2 dashboard feature.**

---

## KindLM's Differentiators (Unique Angle)

These are features where KindLM has a clear lead or unique positioning. Double down on these.

### 1. Native Tool Call Assertions (STRONG LEAD)
**This is KindLM's killer feature.** No competitor has first-class tool call testing.
- `tool_called` with arg matching
- `tool_not_called` (negative assertion)
- `tool_order` (sequence verification)
- Tool simulation (mock tool responses to test multi-turn flows)

In promptfoo, you'd write custom JavaScript: `output.tool_calls.some(tc => tc.function.name === 'lookup_order')`. In LangSmith, you'd write a custom evaluator function. KindLM makes this declarative in YAML.

**Why this matters:** AI agents are defined by their tool use. The industry is moving from chatbots to agents. Testing tool calls is the behavioral equivalent of testing API contracts.

**Recommendation:** Make tool call assertions the hero of all marketing. "Test what your agent DOES, not what it SAYS."

### 2. EU AI Act Compliance Reports (UNIQUE)
No competitor generates compliance documentation. promptfoo has red teaming for security, but no regulatory compliance output.
- SHA-256 hash for tamper evidence
- Maps test results to Annex IV articles
- Markdown (free) + PDF (paid Cloud)

**Why this matters:** EU AI Act enforcement begins 2026. Companies deploying AI agents in EU need documentation. This is a wedge into enterprise.

**Recommendation:** Keep as differentiator but don't lead with it for solo devs. It's an enterprise upsell.

### 3. Baseline/Drift Detection (MODERATE LEAD)
KindLM has native drift detection with three methods: judge, embedding, field-diff. Braintrust and LangSmith have experiment comparison, but not automatic drift scoring.

**Recommendation:** Good for regression testing narrative. Keep, but it's not the hero feature.

### 4. PII Detection (MINOR LEAD)
Built-in `no_pii` assertion with regex patterns for SSN, CC, email, phone, IBAN. promptfoo has a `moderation` assertion but no PII-specific detection.

**Recommendation:** Keep. Useful for compliance angle.

### 5. OTLP Trace Ingestion (EMERGING)
The `kindlm trace` command accepts OpenTelemetry traces. This is a lightweight bridge to observability without building a full tracing platform.

**Recommendation:** Interesting but early. Don't oversell. The real value is: "run your agent, collect its traces, assert against them."

---

## Features to Build for v1.0 (Gaps to Close)

Priority-ordered by impact on solo dev adoption.

### P0 — Must ship with v1.0

| Feature | Effort | Rationale |
|---|---|---|
| Result caching | S | Solo devs iterate; without caching every run costs money. Verify if exists, add if not. |
| `--watch` mode | M | promptfoo has live reload. Solo devs want tight edit-run-review loop. |
| Verify E2E flow works | M | `npx init` -> `kindlm test` -> see results. Must be bulletproof. |

### P1 — Ship within 2 weeks of v1.0

| Feature | Effort | Rationale |
|---|---|---|
| GitHub Action with PR comments | M | promptfoo's killer CI feature. Posts eval comparison on every PR. |
| Generic HTTP provider | S | Escape hatch for unsupported APIs. Any REST endpoint becomes a provider. |
| `contains` / `equals` assertions | S | Basic string assertions. promptfoo has them; users expect them for simple checks. |

### P2 — v1.1-v1.2

| Feature | Effort | Rationale |
|---|---|---|
| Matrix comparison view (dashboard) | L | promptfoo's iconic feature. Needs dashboard work. |
| Dataset management (import/export) | M | Golden test sets beyond YAML. CSV import at minimum. |
| Custom assertion functions (JS) | M | promptfoo's `javascript:` and `python:` assertions are heavily used. Let users write custom logic. |
| Variable/template expansion | S | `{{env.API_KEY}}`, `{{file:prompt.md}}` — KindLM has interpolation but verify completeness. |

---

## Features to NOT Build (Anti-Features)

These are features competitors have that KindLM should deliberately avoid. They either conflict with KindLM's positioning, dilute focus, or are better served by specialized tools.

### 1. Full Observability/Tracing Platform
**Who has it:** Braintrust, LangSmith, Arize Phoenix (it's their core product)
**Why not:** Building a tracing platform requires massive investment in data ingestion, storage, search, and visualization. KindLM's OTLP ingest is a good lightweight bridge. Don't compete with Datadog/Grafana.
**Instead:** Keep `kindlm trace` as a testing entry point. Let users use their existing observability stack.

### 2. Prompt Management / Playground
**Who has it:** Humanloop (core), LangSmith, Braintrust
**Why not:** Prompt management is a separate product category. KindLM tests agents, not prompts. Users bring their own prompt files.
**Instead:** Support `system_prompt_file: ./prompts/refund.md` references. Don't version/store prompts.

### 3. Red Teaming / Security Scanning
**Who has it:** promptfoo (acquired by OpenAI specifically for this)
**Why not:** Red teaming requires maintaining adversarial prompt databases, vulnerability taxonomies, and attack strategies. promptfoo (now OpenAI) will dominate this. KindLM's compliance angle is different — it's about documentation, not adversarial testing.
**Instead:** Complement red teaming tools. "Use promptfoo for red teaming, KindLM for behavioral regression testing."

### 4. Human Annotation Queues
**Who has it:** LangSmith, Braintrust
**Why not:** Annotation queues are a team feature requiring complex UI for review workflows, consensus scoring, and queue management. Solo devs don't annotate. Teams that need annotation are already on LangSmith/Braintrust.
**Instead:** Keep `kindlm baseline set` for golden answers. Don't build a review workflow.

### 5. Online/Production Evaluation
**Who has it:** LangSmith, Braintrust (scoring production traces in real-time)
**Why not:** Production scoring requires always-on infrastructure, real-time data pipelines, and alerting. KindLM is a testing tool, not a monitoring tool.
**Instead:** Focus on pre-deployment CI testing. "Catch behavioral regressions before they ship."

### 6. Native Python SDK as Primary Interface
**Who has it:** LangSmith, Braintrust, Arize Phoenix
**Why not:** KindLM's differentiation is YAML-first, no-code test definition. Adding a Python SDK as equal citizen dilutes the message and doubles API surface to maintain.
**Instead:** Keep TypeScript SDK for programmatic use. Node.js library for advanced users. Don't build a Python SDK for v1.

### 7. Multi-Modal Evaluation (Image/Audio/Video)
**Who has it:** Braintrust (image attachments), promptfoo (basic multimodal)
**Why not:** AI agent testing is about tool calls and structured behavior. Multi-modal eval is a research area, not a v1 need.
**Instead:** Support text-in/text-out + tool calls. Add multimodal when agent frameworks support it natively.

### 8. Model Fine-Tuning Integration
**Who has it:** None directly, but Humanloop has prompt optimization
**Why not:** Completely different product category. Testing tells you IF something is broken; fine-tuning fixes it. Different user, different workflow.

---

## Positioning Matrix

Where KindLM fits in the market:

```
                    Observability-first          Testing-first
                    (production monitoring)       (pre-deployment CI)
                    ─────────────────────────────────────────────
Platform/SaaS  │    LangSmith                    Braintrust
(team-first)   │    Arize Phoenix                Humanloop
               │
               │
CLI/OSS        │    (gap)                        promptfoo ← general eval
(dev-first)    │                                 KindLM    ← agent behavioral
               │
```

**KindLM's positioning:** CLI-first, agent-behavioral testing for solo devs. The only tool with first-class tool call assertions and compliance documentation. Complements (not replaces) observability platforms and red teaming tools.

**Tagline candidates:**
- "Behavioral regression tests for AI agents"
- "Test what your agent does, not what it says"
- "CI/CD for AI agent behavior"

---

## Competitor Deep Dives

### promptfoo
- **Acquired by OpenAI (2026).** This changes the competitive landscape significantly.
- **Strengths:** 50+ providers, 30+ assertion types, matrix comparison view, GitHub Action, red teaming, massive community (16k+ GitHub stars)
- **Weaknesses:** General-purpose (not agent-specific), no tool call assertions, no compliance, no cloud dashboard for teams, red-teaming focus may shift under OpenAI
- **Threat to KindLM:** High for general eval. Low for agent-specific behavioral testing.
- **Co-existence:** "Use promptfoo for prompt quality. Use KindLM for agent behavior."

### Braintrust
- **Strengths:** Full eval + observability platform, datasets/experiments UI, playgrounds, online scoring, strong TS/Python SDK, good docs
- **Weaknesses:** Not CLI-first, no YAML config, requires account creation, heavier setup, closed-source core
- **Threat to KindLM:** Medium. Different audience (teams with budget vs solo devs).
- **KindLM advantage:** Zero-setup CLI, YAML config, tool call assertions, free tier with full CLI features.

### LangSmith
- **Strengths:** Deep LangChain integration, production tracing, annotation queues, prompt management, massive user base
- **Weaknesses:** LangChain-centric perception (even though framework-agnostic), complex setup, expensive at scale, no CLI-first workflow
- **Threat to KindLM:** Low for CLI users. High for LangChain users.
- **KindLM advantage:** Framework-agnostic, zero lock-in, tool call assertions, compliance.

### Arize Phoenix
- **Strengths:** Open source, self-hostable, strong tracing/observability, LLM-as-judge templates, good notebook integration
- **Weaknesses:** Python-only, observability-first (eval is secondary), no CI/CD integration, no tool call testing
- **Threat to KindLM:** Low. Different category (observability vs testing).
- **Co-existence:** "Use Phoenix for tracing. Use KindLM for testing."

### Humanloop
- **Strengths:** Prompt management, eval workflows, versioning, team collaboration
- **Weaknesses:** Closed source, expensive, prompt-management-first (eval is secondary), limited documentation publicly available
- **Threat to KindLM:** Low. Prompt management is not KindLM's market.

---

## v1.0 Feature Checklist (Go/No-Go)

Based on this research, here is what v1.0 needs:

**Must have (blocking release):**
- [x] `npx @kindlm/cli init` -> working kindlm.yaml
- [x] `kindlm test` runs all suites, exit 0/1
- [x] OpenAI + Anthropic + Ollama providers working
- [x] tool_called, tool_not_called, tool_order assertions
- [x] schema (JSON Schema via AJV) assertion
- [x] judge (LLM-as-judge) assertion
- [x] no_pii assertion
- [x] keywords_present, keywords_absent assertions
- [x] Pretty terminal reporter with pass/fail colors
- [x] JUnit XML for CI
- [x] `--gate` threshold for CI pass/fail
- [x] Multiple runs with aggregation (repeat + mean/p50/p95)
- [ ] Result caching (verify exists, add if missing)
- [ ] E2E flow verified on clean machine
- [ ] Cloud API actually responding

**Should have (ship week of v1.0 if possible):**
- [ ] `--watch` mode for local development
- [ ] GitHub Action with PR comment
- [ ] Generic HTTP provider adapter

**Nice to have (v1.1):**
- [ ] CSV dataset import
- [ ] Custom JS assertion functions
- [ ] Matrix comparison view in dashboard
- [ ] `contains` / `equals` string assertions

---

## Key Insight

The market is splitting into two categories:
1. **Observability platforms** (LangSmith, Braintrust, Phoenix) that add eval as a feature
2. **Testing tools** (promptfoo, KindLM) that are developer-workflow-first

promptfoo dominates general eval but is now absorbed into OpenAI, creating uncertainty. KindLM's opportunity: **own the agent behavioral testing niche** before the observability platforms build it or another OSS tool emerges. The tool call assertion system is genuinely unique and maps perfectly to the agent-first future of LLM apps.

**The v1.0 success metric:** A solo dev can go from zero to behavioral tests in CI in under 10 minutes, testing tool calls their agent makes, with no account required.
