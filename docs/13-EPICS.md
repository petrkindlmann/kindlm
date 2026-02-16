# KindLM — Epics & User Stories

**Format:** Each epic represents a slice of user value. Stories use `As a [role], I want [action], so that [benefit]` format. Acceptance criteria are testable. Estimates are T-shirt sizes: S (1–2 days), M (3–5 days), L (1–2 weeks), XL (2–4 weeks).

---

## Epic 1: First Test in 10 Minutes

**Goal:** A developer can install KindLM, write a test, and see results in under 10 minutes.  
**Phase:** 1 (MVP)  
**Priority:** P0 — Nothing else matters if this doesn't work.

### Story 1.1: Install and scaffold
**As a** developer, **I want to** run `npm i -g @kindlm/cli && kindlm init` and get a working config file, **so that** I don't have to write YAML from scratch.

**Acceptance criteria:**
- `npm i -g @kindlm/cli` completes in < 30 seconds
- `kindlm init` creates `kindlm.yaml` with a commented, runnable example
- `kindlm init --template agent` creates an agent-focused template with tool definitions
- `kindlm init --template compliance` creates a template with compliance section
- Created config passes `kindlm validate` without edits
- `.kindlm/` directory created and added to `.gitignore` suggestion

**Size:** M

### Story 1.2: Validate config without running
**As a** developer, **I want to** run `kindlm validate` and see if my config is valid before burning API credits, **so that** I catch YAML mistakes early.

**Acceptance criteria:**
- Validates YAML syntax, Zod schema, file references (system_prompt_file, schemaFile)
- Lists all suites and test counts on valid config
- Shows line-specific error messages on invalid config (e.g., "line 23: unknown assertion type 'tool_caled'")
- Exit code 0 (valid) / 1 (invalid)
- Runs in < 1 second (no API calls)

**Size:** M

### Story 1.3: Run tests and see results
**As a** developer, **I want to** run `kindlm test` and see colored pass/fail output in my terminal, **so that** I know which tests passed and why failures happened.

**Acceptance criteria:**
- Reads `kindlm.yaml` (or specified file), executes all suites
- Shows progress indicator during execution
- Terminal output shows: suite name, test name, pass/fail, assertion details, timing
- Failed assertions show specific reason ("Expected tool `lookup_order` to be called, but agent called `process_refund`")
- Summary line: pass rate, total tests, total time, total cost
- Exit code 0 (all pass) / 1 (any fail)

**Size:** L

### Story 1.4: Filter test execution
**As a** developer, **I want to** run a single suite or test without running everything, **so that** I can iterate quickly on a specific test.

**Acceptance criteria:**
- `kindlm test -s refund-agent` runs only that suite
- `kindlm test -s refund-agent -t happy-path` runs only that test
- `kindlm test --grep "refund"` matches by pattern
- Invalid suite/test name shows helpful error with available options

**Size:** S

---

## Epic 2: Assert on Agent Behavior

**Goal:** Tests can verify what tools an agent calls, with what arguments, in what order — not just the text it outputs.  
**Phase:** 1 (MVP)  
**Priority:** P0 — This is the core differentiator.

### Story 2.1: Tool call assertions
**As a** developer, **I want to** assert that my agent called `lookup_order` with `order_id: "123"`, **so that** I catch when prompt changes break tool routing.

**Acceptance criteria:**
- `tool_called` assertion verifies tool name and optionally partial arg match
- `tool_not_called` asserts a tool was NOT invoked
- `tool_order` asserts tools were called in a specific sequence
- Supports nested argument matching (`args.filters.status: "active"`)
- Supports wildcard args (`args.order_id: "*"` — just check it was passed)
- Failure message shows what was actually called vs expected

**Size:** L

### Story 2.2: Multi-turn tool simulation
**As a** developer, **I want to** define simulated tool responses in YAML, **so that** my tests run without calling real APIs.

**Acceptance criteria:**
- Tools section in YAML defines: tool name, conditional responses (`when`/`then`), default response
- Engine runs multi-turn loop: prompt → model response → if tool call, inject sim response → continue
- Loop terminates when model produces final text (no more tool calls) or max turns reached
- Supports multiple tool calls in a single turn
- Timeout per turn (configurable, default 30s)

**Size:** L

### Story 2.3: Schema validation
**As a** developer, **I want to** validate that my agent's structured output matches a JSON Schema, **so that** downstream systems don't break on malformed responses.

**Acceptance criteria:**
- `schema` assertion validates response text as JSON against a `.json` schema file (AJV)
- Handles non-JSON response gracefully (fails assertion, not crashes)
- Failure message shows which schema fields failed and why
- Supports `$ref` in schemas

**Size:** M

### Story 2.4: LLM-as-judge
**As a** developer, **I want to** evaluate subjective quality ("Is this response empathetic?") using an LLM judge, **so that** I can catch tone and quality regressions.

**Acceptance criteria:**
- `judge` assertion sends response + criteria to a configurable judge model
- Returns score 0.0–1.0 with explanation
- Configurable threshold (default 0.7)
- Judge model can differ from test model (e.g., test with GPT-4o, judge with Claude)
- Score and explanation included in report
- Retry on judge API failure (up to 2 retries)

**Size:** M

### Story 2.5: PII detection
**As a** developer, **I want to** automatically fail tests where the agent leaks personal data, **so that** I catch privacy violations before production.

**Acceptance criteria:**
- `no_pii` assertion detects: SSN, credit card numbers, email addresses, phone numbers, IBAN
- Supports custom regex patterns via config
- Zero tolerance by default (any match = fail)
- Failure message identifies which PII type and position in output
- Configurable allowlist (e.g., allow test email `test@example.com`)

**Size:** M

### Story 2.6: Keyword guardrails
**As a** developer, **I want to** ensure my agent never says certain phrases and always includes others, **so that** brand and safety guidelines are enforced.

**Acceptance criteria:**
- `keywords_absent` fails if any denied phrase appears (case-insensitive)
- `keywords_present` fails if any required phrase is missing
- Supports regex patterns, not just literal strings
- Failure message shows the matched/missing keyword and context

**Size:** S

### Story 2.7: Latency and cost assertions
**As a** developer, **I want to** fail tests where the agent is too slow or too expensive, **so that** I catch performance regressions.

**Acceptance criteria:**
- `latency` assertion fails if response time exceeds threshold (ms)
- `cost` assertion fails if token cost exceeds threshold (USD)
- Cost calculated from token usage × provider pricing
- Works with multi-run aggregation (p95 latency, mean cost)

**Size:** S

---

## Epic 3: CI Pipeline Integration

**Goal:** KindLM runs in CI with zero configuration beyond what's already in the repo.  
**Phase:** 1 (MVP)  
**Priority:** P0

### Story 3.1: JUnit XML output
**As a** QA engineer, **I want to** get JUnit XML from KindLM, **so that** my CI system (GitHub Actions, GitLab CI) shows test results in its native reporting UI.

**Acceptance criteria:**
- `kindlm test --reporter junit` writes standard JUnit XML
- Each test case is a `<testcase>` element; failures include assertion detail
- Output file path configurable (`--junit report.xml`)
- Compatible with GitHub Actions test reporter and GitLab JUnit artifacts

**Size:** M

### Story 3.2: JSON report
**As a** developer, **I want to** get a structured JSON report, **so that** I can process results programmatically.

**Acceptance criteria:**
- `kindlm test --reporter json` writes full report to file
- Contains: config hash, git info, all suites, all tests, all assertion results, timing, cost
- Schema is stable and documented
- Usable as input to `kindlm upload` and `kindlm baseline set`

**Size:** M

### Story 3.3: Exit codes for CI gating
**As a** CI engineer, **I want** KindLM to exit with code 0 on pass and 1 on fail, **so that** I can gate deployments on test results.

**Acceptance criteria:**
- Exit 0 = all gates passed
- Exit 1 = any gate failed OR any unhandled error
- `--gate 90` sets minimum pass rate (overrides config)
- Git commit SHA and branch name included in report (auto-detected)
- CI environment auto-detected (GitHub Actions, GitLab CI, Jenkins, CircleCI)

**Size:** S

### Story 3.4: GitHub Actions workflow example
**As a** developer, **I want** a copy-paste GitHub Actions workflow, **so that** I can add KindLM to my CI in < 2 minutes.

**Acceptance criteria:**
- `.github/workflows/kindlm.yml` template in docs
- Uses `npx @kindlm/cli test` (no global install needed)
- API key from secrets
- JUnit XML uploaded as artifact
- Optional: upload to KindLM Cloud

**Size:** S

---

## Epic 4: Drift Detection

**Goal:** Developers can save a "known good" baseline and detect when agent behavior drifts from it.  
**Phase:** 1 (MVP)  
**Priority:** P1

### Story 4.1: Save baseline
**As a** developer, **I want to** save current test results as a baseline, **so that** future runs can compare against a known-good state.

**Acceptance criteria:**
- `kindlm baseline set` saves latest JSON report to `.kindlm/baselines/`
- Optional label: `kindlm baseline set --label "v2.0-release"`
- Baseline contains: response texts, tool calls, scores, timing
- Stored as JSON, human-readable

**Size:** S

### Story 4.2: Compare against baseline
**As a** developer, **I want to** see what changed between current results and baseline, **so that** I catch unintended regressions.

**Acceptance criteria:**
- `kindlm baseline compare` or `kindlm test --baseline latest`
- `drift` assertion uses LLM-as-judge to score semantic similarity (0.0–1.0)
- Field-level diff available (tool calls changed, score dropped, new PII)
- Summary table: metric, baseline value, current value, delta
- Configurable drift threshold (default 0.1 = 10% change triggers warning)

**Size:** L

### Story 4.3: List baselines
**As a** developer, **I want to** see all saved baselines, **so that** I can compare against a specific historical snapshot.

**Acceptance criteria:**
- `kindlm baseline list` shows: label, date, test count, pass rate
- `kindlm baseline compare --label "v2.0-release"` compares against specific baseline

**Size:** S

---

## Epic 5: Compliance Documentation

**Goal:** Running `kindlm test --compliance` generates audit-ready documentation for EU AI Act.  
**Phase:** 1 (MVP)  
**Priority:** P1

### Story 5.1: Compliance config section
**As a** CTO, **I want to** add compliance metadata to my existing kindlm.yaml, **so that** reports include system name, risk level, and operator info.

**Acceptance criteria:**
- `compliance` section in YAML: framework, metadata (systemName, riskLevel, operator, version)
- Validates risk level against allowed values (minimal, limited, high, unacceptable)
- Optional `outputDir` for report files (default: `./compliance-reports/`)

**Size:** S

### Story 5.2: Generate compliance report
**As a** compliance officer, **I want** a markdown document mapping test results to EU AI Act articles, **so that** I can include it in our compliance package.

**Acceptance criteria:**
- `kindlm test --compliance` generates markdown report
- Report structure: system description, test methodology, results per article, artifact hashes
- Maps assertions to Annex IV sections (see `06-COMPLIANCE_SPEC.md`)
- Includes SHA-256 hash of config file, JSON report, and the compliance document itself
- Timestamp in ISO 8601
- Human-readable without technical knowledge

**Size:** L

### Story 5.3: Compliance PDF export (Cloud)
**As an** enterprise customer, **I want** branded PDF compliance reports stored in the cloud, **so that** auditors can access them without engineering involvement.

**Acceptance criteria:**
- Cloud Team/Enterprise plan: PDF export from dashboard
- Company logo, name, date on cover page
- Stored with retention per plan (90 days Team, unlimited Enterprise)
- Accessible via shareable link (with auth)
- Enterprise: digitally signed with org key

**Size:** XL (Phase 2)

---

## Epic 6: Multi-Model Comparison

**Goal:** Run the same tests against multiple models and compare quality, cost, and latency.  
**Phase:** 1 (MVP)  
**Priority:** P2

### Story 6.1: Multiple providers in config
**As a** developer, **I want to** test the same suite against Claude and GPT-4o, **so that** I can compare which model works better for my use case.

**Acceptance criteria:**
- `models` section lists multiple provider:model combos
- All tests run against all listed models
- Report shows side-by-side comparison: pass rate, judge scores, latency, cost per model
- Each model's results independent (one model failing doesn't skip others)

**Size:** M

---

## Epic 7: Cloud Dashboard

**Goal:** Teams can see test history, trends, and collaborate on results via a web dashboard.  
**Phase:** 2 (Cloud)  
**Priority:** P1

### Story 7.1: Upload results
**As a** developer, **I want to** upload test results to KindLM Cloud from CLI, **so that** my team can see them in a dashboard.

**Acceptance criteria:**
- `kindlm login` authenticates via GitHub OAuth
- `kindlm test --upload` or `kindlm upload report.json`
- Results stored in D1, associated with project and git metadata
- Confirmation message with dashboard URL

**Size:** M

### Story 7.2: Test history view
**As an** engineering lead, **I want to** see all test runs for a project over time, **so that** I can spot trends and regressions.

**Acceptance criteria:**
- Dashboard shows: list of runs, pass rate chart over time, latest run detail
- Filter by branch, date range, suite
- Click into run for full assertion breakdown
- Retention per plan (7d free, 90d team, unlimited enterprise)

**Size:** XL

### Story 7.3: Team management
**As an** engineering lead, **I want to** invite team members to my org, **so that** they can view and upload test results.

**Acceptance criteria:**
- Invite by GitHub username or email
- Roles: owner, admin, member (member = read + upload, admin = manage projects, owner = billing)
- Member limits per plan (1 free, 10 team, unlimited enterprise)

**Size:** L

### Story 7.4: Slack notifications
**As a** team lead, **I want to** get a Slack message when tests fail in CI, **so that** I don't have to check the dashboard constantly.

**Acceptance criteria:**
- Webhook URL configured per project in dashboard
- Notification on: test run uploaded with failures, gate failed, drift threshold exceeded
- Slack-formatted message with: project, suite, pass rate, link to run

**Size:** M

---

## Epic 8: Enterprise Compliance

**Goal:** Regulated companies get audit-grade features for EU AI Act compliance.  
**Phase:** 3 (Enterprise)  
**Priority:** P2

### Story 8.1: SSO / SAML
**As an** enterprise IT admin, **I want** SSO integration, **so that** our team authenticates through our identity provider.

**Acceptance criteria:**
- SAML 2.0 support (Okta, Azure AD, OneLogin)
- Auto-provisioning of users from SSO
- Configurable in dashboard settings

**Size:** XL

### Story 8.2: Audit log API
**As a** compliance officer, **I want** a queryable audit log, **so that** I can prove to auditors exactly which tests were run when.

**Acceptance criteria:**
- `GET /v1/audit-log` with filters: date range, actor, event type
- Events logged: run uploaded, report viewed, report exported, baseline set, member added/removed
- Immutable (cannot be deleted by org members)
- Enterprise plan only

**Size:** L

### Story 8.3: Signed compliance reports
**As a** compliance officer, **I want** digitally signed reports, **so that** auditors can verify the report hasn't been tampered with.

**Acceptance criteria:**
- Org generates a signing key pair in dashboard
- Compliance reports include digital signature
- Verification endpoint: `GET /v1/reports/:id/verify`
- Public key downloadable for offline verification

**Size:** L

---

## Epic 9: Billing & Plans

**Goal:** Self-serve plan management with Stripe.  
**Phase:** 3 (Enterprise)  
**Priority:** P1

### Story 9.1: Stripe subscription
**As a** team lead, **I want to** upgrade to Team plan with my credit card, **so that** I don't need to talk to sales.

**Acceptance criteria:**
- Stripe Checkout for Team plan ($49/mo)
- Plan change reflected immediately (feature gates update)
- Card management in dashboard
- Invoices available for download

**Size:** L

### Story 9.2: Enterprise contact flow
**As an** enterprise buyer, **I want to** request an Enterprise plan via a contact form, **so that** I can discuss custom terms.

**Acceptance criteria:**
- "Contact us" button on pricing → contact form
- Form fields: company, name, email, team size, use case
- Notification to founder (Slack + email)
- Manual setup via admin dashboard

**Size:** S
