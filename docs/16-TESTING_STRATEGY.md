# KindLM — Testing Strategy

**Principle:** KindLM is a testing tool. If our own tests are bad, nobody will trust us. Every package has clear testing boundaries, and we mock at provider boundaries — never deeper.

---

## 1. Test Pyramid

```
         ╱╲
        ╱  ╲       E2E Tests (5%)
       ╱    ╲      Real CLI → real API → real output
      ╱──────╲
     ╱        ╲    Integration Tests (25%)
    ╱          ╲   Module boundaries, config → engine → report
   ╱────────────╲
  ╱              ╲  Unit Tests (70%)
 ╱                ╲ Pure functions, parsers, assertion logic
╱──────────────────╲
```

Target coverage: **90%+ on `core`**, 80%+ on `cli`, 70%+ on `cloud`. Measured with `vitest --coverage`.

---

## 2. Framework and Tooling

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner for all packages. Fast, ESM-native, Jest-compatible API. |
| **@vitest/coverage-v8** | Code coverage via V8 engine |
| **msw** (Mock Service Worker) | HTTP-level mocking for provider API calls |
| **miniflare** | Local Cloudflare Workers runtime for cloud package tests |
| **supertest** | HTTP assertions for cloud API integration tests |

### Why Vitest (Not Jest)

- Native ESM support (our codebase is ESM-first)
- Faster startup (no transform overhead)
- Compatible API (easy for Jest users)
- Built-in TypeScript support via esbuild
- Workspace support for monorepo

---

## 3. Testing by Package

### 3.1 `packages/core` — Unit + Integration

Core is pure logic with zero side effects. Every function takes input and returns a Result type. This makes it highly testable.

**Unit tests** (`packages/core/src/__tests__/`):

| Module | What to test | Example |
|--------|-------------|---------|
| `config/parser.ts` | Valid YAML → typed config, invalid YAML → specific errors | `"unknown assertion type 'tool_caled'" error` |
| `config/schema.ts` | Zod validation edge cases | Optional fields, nested defaults, string coercion |
| `assertions/tool-called.ts` | Match/no-match with various arg patterns | Partial args, nested args, wildcards, wrong tool |
| `assertions/tool-order.ts` | Sequence matching with extras allowed | `[A, B, C]` matches `[A, X, B, C]` |
| `assertions/schema.ts` | AJV validation with various schemas | Valid JSON, invalid JSON, non-JSON response, `$ref` |
| `assertions/judge.ts` | Score parsing, threshold comparison | Score 0.8 vs threshold 0.7 = pass |
| `assertions/no-pii.ts` | Regex detection per PII type | SSN, CC, email, phone, IBAN, custom patterns |
| `assertions/keywords.ts` | Present/absent, case sensitivity, regex | Substring match, whole word, regex pattern |
| `assertions/drift.ts` | Similarity scoring, threshold comparison | Identical = 1.0, different = low score |
| `assertions/latency.ts` | Threshold comparison | 500ms vs 1000ms limit = pass |
| `assertions/cost.ts` | Token cost calculation | 1000 tokens × $0.01/1K = $0.01 |
| `providers/registry.ts` | Provider string parsing, lookup | `"openai:gpt-4o"` → OpenAI adapter |
| `engine/runner.ts` | Test execution flow, multi-run aggregation | 3 runs, 2 pass = 66.7% rate |
| `engine/gate.ts` | Pass/fail gate evaluation | 92% vs 90% threshold = pass |
| `reporters/terminal.ts` | Output formatting | Colors, alignment, summary line |
| `reporters/json.ts` | Complete report structure | All fields present, valid JSON |
| `reporters/junit.ts` | Valid JUnit XML | Parseable by CI systems |
| `reporters/compliance.ts` | Annex IV section mapping | Each assertion type maps to correct article |
| `baseline/manager.ts` | Save, load, compare, list | File I/O, JSON round-trip, diff calculation |

**Integration tests** (`packages/core/src/__tests__/integration/`):

| Test | What it covers |
|------|---------------|
| `config-to-engine.test.ts` | Parse YAML config → create engine → run with mock provider → get results |
| `multi-provider.test.ts` | Same suite against two mock providers → comparison report |
| `compliance-flow.test.ts` | Config with compliance section → run → compliance markdown generated |
| `baseline-flow.test.ts` | Run → save baseline → run again → compare → drift detected |
| `multi-turn-tools.test.ts` | Multi-turn tool simulation: prompt → tool call → sim response → final answer |

### 3.2 `packages/cli` — Integration + Snapshot

CLI tests verify that commands produce correct output and exit codes. We test the CLI as a user would experience it.

**Integration tests** (`packages/cli/src/__tests__/`):

| Test | How |
|------|-----|
| `init.test.ts` | Run `kindlm init` in temp dir → verify `kindlm.yaml` created and valid |
| `validate-valid.test.ts` | Run `kindlm validate` on valid config → exit 0, lists suites |
| `validate-invalid.test.ts` | Run `kindlm validate` on broken config → exit 1, shows line-specific error |
| `test-pass.test.ts` | Run `kindlm test` with mock provider → exit 0, output contains "PASS" |
| `test-fail.test.ts` | Run `kindlm test` with failing assertions → exit 1, output contains failure details |
| `test-filter.test.ts` | Run `kindlm test -s suite-name` → only that suite executes |
| `reporters.test.ts` | Run with `--reporter json` → valid JSON file; `--reporter junit` → valid XML |
| `baseline-commands.test.ts` | `baseline set` → `baseline list` → `baseline compare` flow |

**Snapshot tests:**

Terminal output snapshots for consistent formatting. Update with `vitest --update` when output intentionally changes.

```typescript
it('shows pass summary', async () => {
  const output = await runCLI(['test', '-c', 'fixtures/passing.yaml']);
  expect(output.stdout).toMatchSnapshot();
  expect(output.exitCode).toBe(0);
});
```

**CLI test helper:**

```typescript
// test-utils/run-cli.ts
export async function runCLI(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  // Spawns CLI as child process with mock env vars
  // Captures stdout/stderr
  // Returns exit code
}
```

### 3.3 `packages/cloud` — Integration with Miniflare

Cloud tests run against a local Workers runtime with an in-memory D1 database.

**Integration tests** (`packages/cloud/src/__tests__/`):

| Test | What it covers |
|------|---------------|
| `auth.test.ts` | GitHub OAuth flow mock, token generation, token verification |
| `projects-crud.test.ts` | Create, list, get, delete projects |
| `runs-upload.test.ts` | Upload JSON report → stored in D1 → retrievable |
| `runs-list.test.ts` | Pagination, branch filter, date range filter |
| `runs-compare.test.ts` | Compare two runs → deltas calculated correctly |
| `baselines.test.ts` | Set baseline from run, list baselines, compare against baseline |
| `plan-gating.test.ts` | Free plan hits project limit → 403; Team plan allows 5 projects |
| `rate-limiting.test.ts` | Exceed rate limit → 429 with Retry-After header |
| `audit-log.test.ts` | Actions create audit entries; query with filters; Enterprise-only gate |
| `data-retention.test.ts` | Cron deletes runs older than plan retention period |

**Miniflare setup:**

```typescript
// test-utils/worker-env.ts
import { Miniflare } from 'miniflare';

export async function createTestEnv() {
  const mf = new Miniflare({
    modules: true,
    script: '', // loaded from built worker
    d1Databases: ['DB'],
    kvNamespaces: ['RATE_LIMITS'],
  });
  
  // Run migrations
  const db = await mf.getD1Database('DB');
  await db.exec(MIGRATIONS_SQL);
  
  return { mf, db };
}
```

---

## 4. Mocking Strategy

### Rule: Mock at the HTTP boundary, never deeper.

Provider adapters make HTTP requests. We mock the HTTP responses, not the adapter internals. This means our tests verify that our code correctly handles real-shaped API responses.

**msw handlers for providers:**

```typescript
// test-utils/handlers.ts
import { http, HttpResponse } from 'msw';

export const openaiHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Test response',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'lookup_order',
              arguments: '{"order_id": "123"}'
            }
          }]
        }
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    });
  })
];

export const anthropicHandlers = [
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json({
      content: [
        { type: 'text', text: 'Test response' },
        { type: 'tool_use', id: 'tu_1', name: 'lookup_order', input: { order_id: '123' } }
      ],
      usage: { input_tokens: 100, output_tokens: 50 }
    });
  })
];
```

**What we mock vs what we don't:**

| Layer | Mock? | Why |
|-------|-------|-----|
| Provider HTTP APIs (OpenAI, Anthropic, Ollama) | Yes (msw) | Expensive, rate-limited, non-deterministic |
| LLM-as-judge calls | Yes (msw) | Same reasons — return fixed scores in tests |
| File system (baselines, reports) | No — use temp dirs | File I/O is fast and deterministic |
| YAML parsing | No | Pure function, deterministic |
| Zod validation | No | Pure function, deterministic |
| AJV schema validation | No | Pure function, deterministic |
| D1 database (cloud) | No — use Miniflare in-memory D1 | Tests real SQL queries |
| GitHub OAuth | Yes (msw) | External service |
| Stripe | Yes (msw) | External service |

---

## 5. Test Fixtures

All test fixtures live in `packages/*/src/__tests__/fixtures/`.

### Config fixtures:

```
fixtures/
├── configs/
│   ├── minimal.yaml          # Bare minimum valid config
│   ├── full-featured.yaml    # Every option used
│   ├── multi-provider.yaml   # Multiple models
│   ├── compliance.yaml       # With compliance section
│   ├── invalid-syntax.yaml   # YAML parse error
│   ├── invalid-schema.yaml   # Valid YAML, fails Zod
│   └── missing-provider.yaml # References non-existent provider
├── schemas/
│   ├── order-response.json   # For schema assertion tests
│   └── ticket-response.json
├── baselines/
│   └── sample-baseline.json  # Stored baseline for compare tests
└── reports/
    ├── passing-report.json   # Full passing report
    └── failing-report.json   # Report with failures
```

### Provider response fixtures:

```
fixtures/providers/
├── openai/
│   ├── text-response.json       # Simple text completion
│   ├── tool-call-response.json  # Response with tool calls
│   ├── multi-tool-response.json # Multiple tool calls
│   ├── error-429.json           # Rate limit error
│   └── error-500.json           # Server error
├── anthropic/
│   ├── text-response.json
│   ├── tool-use-response.json
│   └── error-overloaded.json
└── ollama/
    ├── text-response.json
    └── tool-call-response.json
```

---

## 6. CI Pipeline Testing

Tests run on every PR and every push to `main`.

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npx turbo test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: packages/*/coverage/lcov.info

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo lint
      - run: npx turbo typecheck
```

### E2E tests (nightly):

Run against real provider APIs with a dedicated test API key. Small budget ($5/day cap). Tests a curated subset of 5 test cases against live OpenAI and Anthropic APIs.

```yaml
# .github/workflows/e2e-nightly.yml
name: E2E Nightly
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC daily

jobs:
  e2e:
    runs-on: ubuntu-latest
    environment: e2e
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npx turbo build
      - run: npx vitest run --project e2e
        env:
          OPENAI_API_KEY: ${{ secrets.E2E_OPENAI_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.E2E_ANTHROPIC_KEY }}
```

---

## 7. Coverage Requirements

| Package | Minimum Coverage | Enforced |
|---------|-----------------|----------|
| `core` | 90% lines, 85% branches | CI blocks merge below threshold |
| `cli` | 80% lines | CI warns, doesn't block |
| `cloud` | 70% lines | CI warns, doesn't block |

```typescript
// vitest.config.ts (root)
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        'packages/core/src': { lines: 90, branches: 85 },
        'packages/cli/src': { lines: 80 },
        'packages/cloud/src': { lines: 70 },
      }
    }
  }
});
```

---

## 8. Test Naming Convention

```
[module].[behavior].[expected result]

Examples:
  config.parser.returns-error-on-invalid-yaml
  assertion.tool-called.passes-when-tool-matches
  assertion.tool-called.fails-when-tool-not-invoked
  assertion.no-pii.detects-credit-card-number
  engine.runner.aggregates-3-runs-correctly
  cli.test-command.exits-1-on-failure
  cloud.runs.upload-creates-run-in-d1
  cloud.plan-gate.blocks-6th-project-on-team-plan
```

Files: `[module].test.ts` in `__tests__/` directory adjacent to source.

---

## 9. Performance Benchmarks

Track in CI to catch regressions:

| Operation | Target | Measured How |
|-----------|--------|-------------|
| Config parse (full-featured.yaml) | < 50ms | `performance.now()` in test |
| Single assertion evaluation | < 5ms | Benchmark suite |
| Report generation (50 tests) | < 100ms | Benchmark suite |
| CLI cold start (`kindlm --help`) | < 500ms | Wall clock in CI |

Benchmarks run weekly via separate CI job. Regression = > 20% slower than baseline.
