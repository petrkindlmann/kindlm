# Testing Strategy — KindLM Monorepo

## Test Framework: Vitest

### Setup
- Framework: **Vitest** (modern, ESM-native, TypeScript-first)
- Configuration: `vitest.config.ts` in each package
- Environment: Node.js (`environment: "node"`)
- Globals enabled: `describe`, `it`, `expect` available without imports

### Vitest Configuration

#### Core Package (`packages/core/vitest.config.ts`)
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### CLI Package (`packages/cli/vitest.config.ts`)
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

#### Cloud Package (`packages/cloud/vitest.config.ts`)
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

### Packages Without Tests
- Package has `vitest.config.ts` with `passWithNoTests: true`
- Prevents test suite from failing if no `.test.ts` files exist

## Test File Locations & Naming

### Co-location Pattern
- Tests live **next to source code**, not in separate `tests/` directory
- Naming: `*.test.ts` suffix
- Example structure:
  ```
  packages/core/src/
  ├── config/
  │   ├── parser.ts
  │   ├── parser.test.ts        ← Co-located
  │   ├── schema.ts
  │   ├── schema.test.ts        ← Co-located
  │   └── interpolation.test.ts
  ├── providers/
  │   ├── openai.ts
  │   ├── openai.test.ts        ← Co-located
  │   ├── openai.resilience.test.ts
  │   └── retry.test.ts
  └── types/
      ├── result.ts
      └── result.test.ts         ← Co-located
  ```

## Test Categories

### 1. Unit Tests (`.test.ts`)
- Test single function in isolation
- Mock external dependencies (providers, file I/O)
- Fast (< 100ms per test)
- Example from `packages/core/src/config/parser.test.ts`:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { parseConfig } from "./parser.js";
  import { ok, err } from "../types/result.js";

  describe("parseConfig", () => {
    it("parses valid YAML into a typed config", () => {
      const result = parseConfig(VALID_YAML, { configDir: "/tmp" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project).toBe("test-project");
      }
    });

    it("returns CONFIG_PARSE_ERROR for invalid YAML syntax", () => {
      const result = parseConfig("key: [unterminated", { configDir: "/tmp" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFIG_PARSE_ERROR");
      }
    });

    it("returns CONFIG_VALIDATION_ERROR for invalid schema", () => {
      const result = parseConfig("kindlm: 2\nproject: test\n", {
        configDir: "/tmp",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
      }
    });
  });
  ```

### 2. Resilience Tests (`.resilience.test.ts`)
- Test retry behavior, timeouts, and error recovery
- Simulate API failures (rate limits, timeouts, network errors)
- Verify backoff exponential behavior
- Examples:
  - `packages/core/src/providers/openai.resilience.test.ts`
  - `packages/core/src/providers/gemini.resilience.test.ts`
  - `packages/core/src/providers/ollama.resilience.test.ts`
- Test pattern:
  ```typescript
  describe("withRetry", () => {
    it("retries on transient failure then succeeds", async () => {
      let attempt = 0;
      const fn = async () => {
        attempt++;
        if (attempt < 3) throw new Error("ECONNREFUSED");
        return { success: true };
      };

      const result = await withRetry(fn, { maxRetries: 3, initialDelay: 10 });
      expect(result.success).toBe(true);
      expect(attempt).toBe(3);
    });

    it("respects exponential backoff timing", async () => {
      const timestamps: number[] = [];
      const fn = async () => {
        timestamps.push(Date.now());
        throw new Error("transient");
      };

      const start = Date.now();
      await withRetry(fn, { maxRetries: 3, initialDelay: 100 });
      const elapsed = Date.now() - start;

      // Total backoff: 100 + 200 + 400 = 700ms (plus tolerance)
      expect(elapsed).toBeGreaterThan(600);
    });
  });
  ```

### 3. Fuzz Tests (`.fuzz.test.ts`)
- Property-based testing with random inputs
- Verify robustness against malformed input
- Examples:
  - `packages/core/src/config/parser.fuzz.test.ts`
  - `packages/core/src/providers/openai.fuzz.test.ts`
- Test pattern using `@fast-check/vitest`:
  ```typescript
  describe("parseConfig fuzz", () => {
    it("never crashes on arbitrary YAML input", () => {
      fc.assert(
        fc.property(fc.string(), (yaml) => {
          const result = parseConfig(yaml, { configDir: "/tmp" });
          // Should always return a Result, never throw
          expect(result.success === true || result.success === false).toBe(true);
        }),
      );
    });
  });
  ```

### 4. Integration Tests (CLI only)
- Test CLI commands end-to-end
- Create real files, call commands, verify output/exit codes
- Located in `packages/cli/tests/integration/` (separate from src)
- Example: `packages/cli/tests/integration/kindlm.test.ts`
  ```typescript
  describe("kindlm CLI", () => {
    it("kindlm init creates kindlm.yaml", async () => {
      const { exitCode, stdout } = await exec("kindlm init --project my-project");
      expect(exitCode).toBe(0);
      expect(fs.existsSync("kindlm.yaml")).toBe(true);
    });

    it("kindlm validate checks config without running tests", async () => {
      const { exitCode } = await exec("kindlm validate");
      expect(exitCode).toBe(0); // Config is valid
    });

    it("kindlm test fails when assertions fail", async () => {
      const { exitCode } = await exec("kindlm test");
      expect(exitCode).toBe(1); // At least one test failed
    });
  });
  ```

### 5. E2E Tests (Future)
- Test full workflow: init → configure → test → upload to Cloud
- Not yet implemented (Phase 2)

## Mocking Patterns

### Using `vi.mock()`
- Mock entire modules or specific functions
- Pattern from `packages/core/src/providers/openai.test.ts`:
  ```typescript
  import { vi } from "vitest";

  vi.mock("./http-client.js", () => ({
    createHttpClient: () => ({
      request: vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ choices: [{ message: { content: "Hello" } }] }),
      }),
    }),
  }));
  ```

### Using `vi.fn()` for Function Spies
- Create spy functions to track calls and return values
  ```typescript
  const mockHttpClient: HttpClient = {
    request: vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({ choices: [{ text: "response" }] }),
    }),
  };

  const adapter = createOpenAIAdapter(mockHttpClient);
  const result = await adapter.complete(request);

  expect(mockHttpClient.request).toHaveBeenCalledWith(
    "https://api.openai.com/v1/chat/completions",
    expect.any(Object),
  );
  ```

### Mocking API Responses
- Mock HTTP responses to simulate provider behavior
  ```typescript
  const mockResponse: ProviderResponse = {
    text: "I'll process your refund.",
    tool_calls: [
      { name: "process_refund", arguments: { order_id: "12345" } },
    ],
    usage: { prompt_tokens: 50, completion_tokens: 25 },
    latency_ms: 250,
    raw: { /* original API response */ },
  };
  ```

### Partial Mocks with `vi.importActual()`
- Use real implementation for some parts, mock others
  ```typescript
  vi.mock("./retry.js", async () => {
    const actual = await vi.importActual("./retry.js");
    return {
      ...actual,
      withRetry: vi.fn(actual.withRetry), // Spy on real function
    };
  });
  ```

## Assertion Patterns

### Result Type Assertions
- Tests check Result success/failure explicitly:
  ```typescript
  const result = parseConfig(yaml, { configDir: "/tmp" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.project).toBe("test-project");
    expect(result.data.models).toHaveLength(1);
  }
  ```

### Error Code Assertions
  ```typescript
  const result = parseConfig("invalid: yaml: [", { configDir: "/tmp" });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.code).toBe("CONFIG_PARSE_ERROR");
    expect(result.error.message).toContain("YAML");
  }
  ```

### Async/Await in Tests
  ```typescript
  it("handles async provider calls", async () => {
    const adapter = createOpenAIAdapter(httpClient);
    const result = await adapter.complete(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.text).toBeTruthy();
    }
  });
  ```

## Running Tests

### Run All Tests
  ```bash
  npm run test          # Run all tests in all packages
  npm test -- --watch  # Watch mode
  npm test -- --ui     # UI mode (browser)
  ```

### Run Tests in Single Package
  ```bash
  cd packages/core
  npm test
  ```

### Run Specific Test File
  ```bash
  npm test -- parser.test.ts
  npm test -- config/     # All tests in config/
  ```

### Run with Coverage
  ```bash
  npm test -- --coverage
  ```

### Run Specific Test Name
  ```bash
  npm test -- --grep "parseConfig"
  npm test -- -t "returns CONFIG_PARSE_ERROR"
  ```

## Coverage Status

### Current Coverage (Phase 4 Completion)
- Core logic: ~95% (all assertion types, providers, config parser)
- CLI commands: ~85% (all commands tested, edge cases remain)
- Cloud API: ~90% (routes, auth, uploads)
- Dashboard: ~60% (UI components partially tested)

### Coverage Goals
- Core: 95%+ (stricter for business logic)
- CLI: 85%+ (integration tests cover gaps)
- Cloud: 90%+ (Workers API critical)
- Dashboard: 70%+ (visual tests via Storybook)

## Test Execution Workflow

### Local Development
  ```bash
  npm run dev:cli       # Watch mode for CLI changes
  npm test              # Full test run
  npm run lint          # ESLint + Prettier
  npm run typecheck     # TypeScript check
  ```

### Pre-Commit (via Git Hook)
  1. `npm run lint` — ESLint + Prettier
  2. `npm run typecheck` — TypeScript compilation
  3. `npm run test` — All tests pass

### CI (GitHub Actions)
  1. Install dependencies
  2. Typecheck: `npm run typecheck`
  3. Lint: `npm run lint`
  4. Test: `npm test`
  5. Build: `npm run build`
  6. Coverage report (if coverage drops > 5%)

## Debugging Tests

### Debug Single Test
  ```bash
  npm test -- parser.test.ts --reporter=verbose
  ```

### VS Code Debugger
- Add breakpoint in `.test.ts` file
- Run: `npm test -- --inspect-brk parser.test.ts`
- Open `chrome://inspect` in browser

### Print Debug Info
- Vitest doesn't capture `console.log` by default
- To debug: `console.error()` or use `--reporter=verbose`

## Test Data & Fixtures

### Shared Fixtures
- Located in `packages/core/src/**/__fixtures__/` (if needed)
- Or defined inline in test files (preferred for simplicity)

### Config File Fixtures
- Example YAML in test constants:
  ```typescript
  const VALID_YAML = `
  kindlm: 1
  project: "test-project"
  suite:
    name: "test-suite"
  models:
    - id: "gpt-4o"
      provider: "openai"
      model: "gpt-4o"
  tests:
    - name: "test-1"
      prompt: "greeting"
      expect: {}
  `;
  ```

## Testing Philosophy

### What to Test
1. **Happy path**: Normal usage with valid inputs
2. **Error cases**: Invalid inputs, missing files, API errors
3. **Edge cases**: Empty input, max length, special characters
4. **Resilience**: Retries, timeouts, network failures (resilience tests)
5. **Integration**: CLI commands work end-to-end

### What NOT to Test
1. Third-party library internals (axios, zod, etc.)
2. Environment-specific behavior (only on CI)
3. UI pixel-perfect rendering (use visual regression instead)
4. Performance benchmarks (separate benchmarks suite)

## Key Files to Know

- `/Users/petr/projects/kindlm/packages/core/vitest.config.ts` — Core test config
- `/Users/petr/projects/kindlm/packages/cli/vitest.config.ts` — CLI test config
- `/Users/petr/projects/kindlm/packages/core/src/config/parser.test.ts` — Example unit tests
- `/Users/petr/projects/kindlm/packages/core/src/providers/openai.resilience.test.ts` — Resilience tests
- `/Users/petr/projects/kindlm/packages/cli/tests/integration/` — Integration test directory

---

Last updated: 2026-03-27
