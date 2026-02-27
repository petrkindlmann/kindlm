# KindLM — Task Backlog

Prioritized list of implementation tasks. Work top-to-bottom.

## Phase 1: MVP (Ship in 4–6 weeks)

### 1.1 Core Foundation
- [ ] Set up monorepo: root package.json, turbo.json, tsconfig.base.json
- [ ] Create packages/core scaffold with src/ directories
- [ ] Implement Zod config schema (kindlm.yaml validation)
- [ ] Implement YAML parser + validator (yaml → Zod → typed config)
- [ ] Implement template interpolation ({{env.VAR}}, {{vars.name}})
- [ ] Write unit tests for config parsing (valid configs, edge cases, error messages)

### 1.2 Provider Adapters
- [ ] Define ProviderAdapter interface + ProviderResponse type
- [ ] Implement OpenAI adapter (chat completions + tool use)
- [ ] Implement Anthropic adapter (messages API + tool use)
- [ ] Implement provider registry (string → adapter factory)
- [ ] Write unit tests with mocked HTTP responses
- [ ] Handle rate limiting + retries with exponential backoff

### 1.3 Assertion Engine
- [ ] Define AssertionHandler interface + AssertionResult type
- [ ] Implement tool_called assertion (tool name + args matching)
- [ ] Implement tool_not_called assertion
- [ ] Implement tool_order assertion (sequence validation)
- [ ] Implement schema assertion (AJV JSON Schema validation)
- [ ] Implement no_pii assertion (SSN, CC, email, phone, IBAN patterns)
- [ ] Implement keywords_present / keywords_absent assertions
- [ ] Implement judge assertion (LLM-as-judge with configurable criteria)
- [ ] Implement latency assertion
- [ ] Implement cost assertion
- [ ] Implement assertion registry (type string → handler)
- [ ] Write tests for each assertion type with pass/fail cases

### 1.4 Test Runner
- [ ] Implement test execution engine (sequential by default)
- [ ] Support multiple runs per test (configurable, default 3)
- [ ] Implement multi-turn tool loop (prompt → tool call → sim response → repeat)
- [ ] Implement run aggregation (mean scores, pass rates)
- [ ] Implement gate evaluation (passRateMin, schemaFailuresMax)
- [ ] Support timeout per test
- [ ] Handle provider errors gracefully (retry vs fail)

### 1.5 Reporters
- [ ] Implement pretty terminal reporter (chalk, table layout)
- [ ] Implement JSON reporter (full structured output)
- [ ] Implement JUnit XML reporter (for CI systems)
- [ ] Implement compliance markdown reporter (EU AI Act Annex IV)

### 1.6 CLI Commands
- [ ] Set up Commander.js program structure
- [ ] Implement `kindlm init` (scaffold template files)
- [ ] Implement `kindlm validate` (config check without running)
- [ ] Implement `kindlm test` (main test runner)
- [ ] Add --suite, --reporter, --runs, --gate, --compliance flags
- [ ] Add --verbose and --quiet modes
- [ ] Implement proper exit codes (0 pass, 1 fail)
- [ ] Add git info detection (commit, branch, dirty state)

### 1.7 Baseline System
- [ ] Implement local baseline storage (.kindlm/baselines/)
- [ ] Implement `kindlm baseline set` command
- [ ] Implement `kindlm baseline compare` command
- [ ] Implement `kindlm baseline list` command
- [ ] Implement drift assertion using stored baselines

### 1.8 Build & Publish
- [ ] Configure tsup for core + cli bundling
- [ ] Set up npm publish workflow (GitHub Actions + Changesets)
- [ ] Test global install: `npm i -g @kindlm/cli`
- [ ] Verify `npx @kindlm/cli` works

## Phase 2: Cloud (Months 4–6)

### 2.1 Cloud API
- [ ] Set up Cloudflare Workers project with Hono
- [ ] Create D1 schema (orgs, tokens, projects, runs, results)
- [ ] Implement auth middleware (Bearer token validation)
- [ ] Implement rate limiting middleware
- [ ] Implement plan-gate middleware (free/team/enterprise limits)
- [ ] CRUD routes: projects, suites, runs, results
- [ ] Compare endpoint (run vs baseline or run vs run)
- [ ] GitHub OAuth flow for `kindlm login`

### 2.2 CLI Cloud Integration
- [ ] Implement `kindlm login` (OAuth + token storage)
- [ ] Implement `kindlm upload` (push results to cloud)
- [ ] Add --upload flag to `kindlm test`
- [ ] Implement cloud client with retry logic

### 2.3 Dashboard (Next.js)
- [ ] Project list + overview
- [ ] Run history with trend charts
- [ ] Run detail view (assertions, diffs)
- [ ] Team management
- [ ] Settings + API token management

## Phase 3: Enterprise (Month 7+)

### 3.1 Billing
- [ ] Stripe integration (subscriptions)
- [ ] Plan upgrade/downgrade flows
- [ ] Usage metering

### 3.2 Enterprise Features
- [ ] SSO / SAML integration
- [ ] Audit log API
- [ ] Signed compliance reports (org key signing)
- [ ] Compliance PDF export
- [ ] Webhook / Slack notifications
- [ ] Data retention enforcement (cron worker)
