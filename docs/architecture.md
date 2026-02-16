# Architecture

## Data Flow

```
kindlm.yaml → Config Parser → Test Runner → Provider → Assertions → Reporter
                   │                │             │           │          │
                   ▼                ▼             ▼           ▼          ▼
              Zod validation   Parallel/seq   API call    Pass/Fail   Console
              Schema check     execution     + tool sim   + reasons   JUnit XML
              Env resolution   Retry logic                Judge       JSON
                                                          Drift       Markdown
                                                          PII         Compliance
```

## Config Parser (`packages/cli/src/config/`)

1. Read YAML file (js-yaml)
2. Validate against Zod schema (see `packages/shared/src/schemas/`)
3. Resolve environment variables (`apiKeyEnv` → `process.env[value]`)
4. Resolve file references (`schemaFile` → read and parse JSON schema)
5. Expand model matrix (if test lists multiple models, create test instances)
6. Return typed `KindlmConfig` object

**Key types:**
```typescript
interface KindlmConfig {
  kindlm: 1;
  project: string;
  providers: Record<string, ProviderConfig>;
  models: ModelConfig[];
  prompts: Record<string, PromptConfig>;
  tests: TestCase[];
  gates?: GateConfig;
  compliance?: ComplianceConfig;
}
```

## Test Runner (`packages/cli/src/runner/`)

The runner executes test cases and collects results.

1. **Build test matrix:** For each test × each model = one test instance
2. **Execute instances:** Sequential by default, `--parallel N` for concurrent
3. **For each instance:**
   a. Build messages from prompt template + vars
   b. Call provider with messages and tool definitions
   c. Intercept tool calls, return configured responses
   d. Collect final response
   e. Run all assertions against the response
   f. Record timing, cost, token counts
4. **Evaluate gates:** Check pass rate, max failures, etc.
5. **Return `TestRunResult`** with all instances, gate status, timing

**Tool simulation:** Tests define tool responses in YAML. The runner creates a tool-use loop:
```
Provider call → model wants to call tool_x(args)
  → Runner matches tool_x in test config
  → Runner returns configured response
  → Provider continues with tool result in context
  → Repeat until model produces final text response
```

## Provider Interface (`packages/cli/src/providers/`)

Each provider implements:
```typescript
interface Provider {
  id: string;
  call(params: ProviderCallParams): Promise<ProviderResponse>;
  estimateCost(usage: TokenUsage): number;
}

interface ProviderCallParams {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  params?: Record<string, unknown>; // temperature, maxTokens, etc.
}

interface ProviderResponse {
  output: string;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  latencyMs: number;
  raw: unknown; // Original API response for debugging
}
```

Providers to implement:
- `anthropic.ts` — Anthropic Messages API (P0)
- `openai.ts` — OpenAI Chat Completions (P0)
- `google.ts` — Google Gemini (P1)
- `azure.ts` — Azure OpenAI (P1)
- `local.ts` — OpenAI-compatible endpoint for local models (P1)

## Assertion Engine (`packages/cli/src/assertions/`)

Each assertion type is a pure function:
```typescript
type AssertionFn = (
  response: ProviderResponse,
  expected: AssertionConfig,
  context: AssertionContext
) => AssertionResult;

interface AssertionResult {
  passed: boolean;
  assertion: string;   // e.g., "toolCall:lookup_order"
  expected: string;    // What was expected
  actual: string;      // What happened
  reason?: string;     // Human-readable explanation
}
```

Assertion types:
- `toolCalls.ts` — tool name, args, ordering, shouldNotCall
- `judge.ts` — LLM-as-judge scoring against criteria
- `schema.ts` — JSON schema validation of output
- `drift.ts` — Semantic similarity against baseline
- `pii.ts` — Regex + heuristic PII detection
- `keywords.ts` — Allow/deny keyword lists
- `regex.ts` — Custom regex patterns

## Reporters (`packages/cli/src/reporters/`)

All reporters implement:
```typescript
interface Reporter {
  report(result: TestRunResult): void | Promise<void>;
}
```

- `console.ts` — Chalk-colored terminal output (default)
- `junit.ts` — JUnit XML for CI systems
- `json.ts` — Machine-readable JSON
- `markdown.ts` — Human-readable markdown summary
- `compliance.ts` — EU AI Act Annex IV mapped report

## Cloud API (`packages/cloud/`)

Cloudflare Workers + D1. RESTful JSON API.

Key endpoints:
```
POST   /v1/runs              Upload test run results
GET    /v1/runs              List runs (paginated, filtered)
GET    /v1/runs/:id          Get single run with details
GET    /v1/runs/:id/report   Get compliance report for a run
POST   /v1/baselines         Save baseline
GET    /v1/baselines/latest  Get latest baseline
GET    /v1/projects          List projects
POST   /v1/projects          Create project
GET    /v1/trends            Aggregated metrics over time
POST   /v1/alerts            Configure Slack/webhook alerts
```

Auth: Bearer token (API key hashed with SHA-256 in D1).

## Dashboard (`packages/dashboard/`)

Next.js 14 with App Router. Pages:

- `/` — Overview: recent runs, pass rate trend, active alerts
- `/runs` — Run list with filters (project, model, status, date range)
- `/runs/[id]` — Run detail: every test instance, assertions, judge output
- `/trends` — Charts: pass rate over time, cost per run, latency, drift
- `/baselines` — Baseline management
- `/compliance` — Compliance reports with export to PDF
- `/settings` — Team management, API keys, Slack integration, billing
