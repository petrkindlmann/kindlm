# KindLM — Error Handling Specification

**Principle:** Errors are data, not surprises. Every function that can fail returns a Result type. The CLI is the only layer that converts errors to human-readable messages and exit codes. Core never prints to stdout. Core never calls `process.exit()`.

---

## 1. Result Type

All `core` functions that can fail return this discriminated union:

```typescript
type Result<T, E = KindlmError> =
  | { success: true; data: T }
  | { success: false; error: E };
```

### KindlmError

```typescript
interface KindlmError {
  code: ErrorCode;
  message: string;          // Human-readable, shown to user
  details?: Record<string, unknown>;  // Machine-readable context
  cause?: Error;            // Original error (for stack traces in debug mode)
}

type ErrorCode =
  // Config errors (1xx)
  | 'CONFIG_NOT_FOUND'       // 100 — kindlm.yaml doesn't exist
  | 'CONFIG_PARSE_ERROR'     // 101 — YAML syntax error
  | 'CONFIG_VALIDATION_ERROR'// 102 — Zod validation failed
  | 'CONFIG_FILE_REF_ERROR'  // 103 — Referenced file doesn't exist (schemaFile, system_prompt_file)
  
  // Provider errors (2xx)
  | 'PROVIDER_NOT_FOUND'     // 200 — Unknown provider string
  | 'PROVIDER_AUTH_ERROR'    // 201 — API key missing or invalid
  | 'PROVIDER_RATE_LIMIT'    // 202 — 429 from provider
  | 'PROVIDER_TIMEOUT'       // 203 — Request timed out
  | 'PROVIDER_API_ERROR'     // 204 — Non-retryable API error (400, 500)
  | 'PROVIDER_NETWORK_ERROR' // 205 — DNS, connection refused, etc.
  
  // Assertion errors (3xx)
  | 'ASSERTION_EVAL_ERROR'   // 300 — Assertion logic failed unexpectedly
  | 'SCHEMA_FILE_ERROR'      // 301 — JSON Schema file invalid or not found
  | 'JUDGE_EVAL_ERROR'       // 302 — Judge model failed to return a score
  
  // Engine errors (4xx)
  | 'ENGINE_MAX_TURNS'       // 400 — Multi-turn loop hit max iterations
  | 'ENGINE_EMPTY_RESPONSE'  // 401 — Provider returned empty content
  
  // Baseline errors (5xx)
  | 'BASELINE_NOT_FOUND'     // 500 — No baseline saved
  | 'BASELINE_CORRUPT'       // 501 — Baseline JSON can't be parsed
  | 'BASELINE_VERSION_MISMATCH' // 502 — Baseline from incompatible version
  
  // Cloud errors (6xx)
  | 'CLOUD_AUTH_ERROR'       // 600 — Not logged in or token expired
  | 'CLOUD_UPLOAD_ERROR'     // 601 — Upload failed
  | 'CLOUD_PLAN_LIMIT'       // 602 — Feature requires higher plan
  | 'CLOUD_RATE_LIMIT'       // 603 — Cloud API rate limited
  
  // System errors (9xx)
  | 'UNKNOWN_ERROR';         // 999 — Unexpected error
```

---

## 2. Error Flow

```
Provider API → ProviderAdapter → Engine → Reporter → CLI → User
     ↓              ↓              ↓          ↓         ↓
  HTTP error    Result type    Result type  Result   Exit code
  (thrown)      (caught at     (propagated) (propagated) + message
                 boundary)
```

### Layer responsibilities:

| Layer | Catches | Returns | Allowed to print |
|-------|---------|---------|-----------------|
| Provider adapter | HTTP errors, JSON parse errors | `Result<ProviderResponse>` | No |
| Assertion handler | Evaluation errors | `Result<AssertionResult>` | No |
| Engine | Nothing — propagates Results | `Result<RunResult>` | No |
| Reporter | Nothing — receives RunResult | `Result<string>` (formatted output) | No |
| CLI | Unwraps all Results | Exit code + stderr/stdout | Yes |

---

## 3. Provider Error Handling

Provider adapters are the boundary between external HTTP APIs and our code. They're the only place where try/catch is used in core.

```typescript
// packages/core/src/providers/openai.ts
async complete(request: ProviderRequest): Promise<Result<ProviderResponse>> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toOpenAIFormat(request)),
      signal: AbortSignal.timeout(request.timeout ?? 30_000),
    });

    if (response.status === 401) {
      return {
        success: false,
        error: {
          code: 'PROVIDER_AUTH_ERROR',
          message: `OpenAI API key is invalid or missing. Set OPENAI_API_KEY environment variable.`,
        }
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      return {
        success: false,
        error: {
          code: 'PROVIDER_RATE_LIMIT',
          message: `OpenAI rate limit hit. Retry after ${retryAfter ?? 'unknown'} seconds.`,
          details: { retryAfter, provider: 'openai' },
        }
      };
    }

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: {
          code: 'PROVIDER_API_ERROR',
          message: `OpenAI returned ${response.status}: ${body.slice(0, 200)}`,
          details: { status: response.status, body },
        }
      };
    }

    const data = await response.json();
    return { success: true, data: fromOpenAIFormat(data) };

  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'PROVIDER_TIMEOUT',
          message: `OpenAI request timed out after ${request.timeout ?? 30_000}ms`,
          cause: err as Error,
        }
      };
    }

    return {
      success: false,
      error: {
        code: 'PROVIDER_NETWORK_ERROR',
        message: `Failed to connect to OpenAI: ${(err as Error).message}`,
        cause: err as Error,
      }
    };
  }
}
```

### Retry logic

Retries happen in the engine, not in adapters. Adapters are stateless — they make one request and return one Result.

```typescript
// packages/core/src/engine/retry.ts
const RETRYABLE_CODES: ErrorCode[] = [
  'PROVIDER_RATE_LIMIT',
  'PROVIDER_TIMEOUT',
  'PROVIDER_NETWORK_ERROR',
];

async function withRetry<T>(
  fn: () => Promise<Result<T>>,
  maxRetries: number = 2,
  backoffMs: number = 1000,
): Promise<Result<T>> {
  let lastResult: Result<T>;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await fn();
    
    if (lastResult.success) return lastResult;
    if (!RETRYABLE_CODES.includes(lastResult.error.code)) return lastResult;
    if (attempt < maxRetries) {
      await sleep(backoffMs * Math.pow(2, attempt)); // Exponential backoff
    }
  }
  
  return lastResult!;
}
```

---

## 4. Assertion Error Handling

Assertions should never crash the test run. A failing assertion is a test result, not an error.

```typescript
// Assertion returns Result, not throw
function evaluateToolCalled(
  response: ProviderResponse,
  config: ToolCalledConfig,
): Result<AssertionResult> {
  // This is a test failure, NOT an error:
  if (!response.toolCalls?.length) {
    return {
      success: true, // Result succeeded (we got a result)
      data: {
        pass: false, // But the assertion failed
        message: `Expected tool "${config.tool}" to be called, but no tools were called`,
        score: 0,
      }
    };
  }
  
  // This IS an error (something went wrong evaluating):
  // Only happens if our own code has a bug
}
```

**Key distinction:**

| Scenario | Result.success | AssertionResult.pass | Meaning |
|----------|---------------|---------------------|---------|
| Tool was called correctly | `true` | `true` | Test passed |
| Tool was not called | `true` | `false` | Test failed (expected outcome) |
| Assertion code crashed | `false` | N/A | Error in KindLM itself |

---

## 5. Engine Error Handling

The engine orchestrates test execution. It collects Results from providers and assertions and produces a RunResult.

### Test-level errors

If a provider call fails for a single test, that test is marked as errored (not failed). Remaining tests continue.

```typescript
interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'errored' | 'skipped';
  assertions: AssertionResult[];
  error?: KindlmError;  // Only set when status === 'errored'
  latencyMs: number;
  costUsd: number;
}
```

### Suite-level errors

If config parsing fails, the entire suite is skipped with an error message. Other suites still run.

### Run-level errors

Only fatal errors (config file not found, no valid suites) stop the entire run.

```
Run
├── Suite A (3 tests)
│   ├── Test 1: passed
│   ├── Test 2: failed (assertion failed — expected behavior)
│   └── Test 3: errored (provider timeout — infrastructure issue)
├── Suite B (2 tests) — skipped (invalid config reference)
│   └── Error: system_prompt_file "prompts/missing.txt" not found
└── Suite C (2 tests)
    ├── Test 1: passed
    └── Test 2: passed

Summary: 3 passed, 1 failed, 1 errored, 2 skipped (Suite B)
Exit code: 1
```

---

## 6. CLI Error Messages

The CLI is responsible for converting error codes to user-friendly messages.

### Formatting rules:

1. Error message on first line (bold red in terminal)
2. Actionable fix on second line
3. Debug details only with `--verbose`

```
Examples:

✗ Config error: Unknown assertion type "tool_caled" at line 23
  Did you mean "tool_called"? See: https://kindlm.com/docs/assertions

✗ OpenAI API key is invalid or missing
  Set OPENAI_API_KEY in your environment or .env file

✗ OpenAI rate limit hit. Retry after 30 seconds.
  Reduce concurrency with --concurrency 1 or add retry config

✗ Schema file not found: schemas/order.json
  Referenced in suite "order-agent", test "happy-path"

✗ Baseline not found for suite "refund-agent"
  Run: kindlm baseline set
```

### Exit codes:

| Code | Meaning |
|------|---------|
| 0 | All tests passed, all gates passed |
| 1 | Tests failed OR gate failed OR error occurred |

We intentionally keep it simple — 0 or 1. CI systems only need pass/fail.

### `--verbose` flag:

Adds stack traces, full provider response bodies, timing per assertion, and retry attempts to output.

---

## 7. Cloud API Error Responses

All Cloud API errors return consistent JSON:

```json
{
  "error": "plan_required",
  "message": "This feature requires a Team or Enterprise plan. Current plan: free",
  "details": {
    "required_plan": "team",
    "current_plan": "free",
    "feature": "pdf_export",
    "upgrade_url": "https://cloud.kindlm.com/settings/billing"
  }
}
```

### HTTP status mapping:

| Error Code | HTTP Status | When |
|-----------|-------------|------|
| `CLOUD_AUTH_ERROR` | 401 | Missing/invalid/expired token |
| `CLOUD_PLAN_LIMIT` | 403 | Feature needs higher plan |
| `not_found` | 404 | Resource doesn't exist or not in user's org |
| `conflict` | 409 | Duplicate project name |
| `validation_error` | 422 | Invalid request body (Zod error details included) |
| `CLOUD_RATE_LIMIT` | 429 | Rate limit exceeded |
| `payload_too_large` | 413 | Upload > 5MB |
| `UNKNOWN_ERROR` | 500 | Unexpected server error (logged, not exposed to user) |

---

## 8. Logging

### CLI logging levels:

```
kindlm test              → Only errors and summary
kindlm test --verbose    → Errors, warnings, info, debug details
DEBUG=kindlm* kindlm test → Full debug output (Node.js debug module)
```

### Cloud logging:

Cloudflare Workers logs via `console.log` → Cloudflare dashboard + optional Logpush to external service.

Log format (structured JSON):

```json
{
  "level": "error",
  "code": "PROVIDER_TIMEOUT",
  "message": "OpenAI request timed out after 30000ms",
  "org_id": "org_a1b2c3",
  "run_id": "run_x1y2z3",
  "timestamp": "2026-02-15T10:30:00Z"
}
```

**Never log:** API keys, user prompts/responses (PII risk), full provider response bodies in production.

---

## 9. Graceful Degradation

| Failure | Behavior |
|---------|----------|
| One provider fails, others succeed | Failed provider's tests marked as errored, others complete |
| Judge model unavailable | Judge assertions marked as errored with suggestion to retry |
| Cloud upload fails | CLI warns but exits based on test results (not upload status) |
| Baseline file corrupted | Compare fails gracefully with "baseline corrupt" error, tests still run |
| Disk full (can't write report) | Stderr warning, test results still shown in terminal |
| SIGINT (Ctrl+C) | Graceful shutdown — print partial results, exit 1 |
