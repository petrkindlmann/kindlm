# Code Conventions — KindLM Monorepo

## Overview

The KindLM monorepo follows strict functional programming principles with a focus on type safety, explicit error handling, and clean dependency boundaries. This document covers style, structure, and architectural patterns.

## Code Style

### No Classes
- Never use ES6 `class` syntax, except for error types
- Use plain functions and factory patterns instead
- Error types are exceptions: `export class ProviderError extends Error`

### Factory Functions
- Pattern: `createXxxAdapter()`, `createXxxAssertion()`, `createXxxReporter()`
- Example from `packages/core/src/providers/registry.ts`:
  ```typescript
  const PROVIDER_FACTORIES: Record<string, (httpClient: HttpClient) => ProviderAdapter> = {
    openai: createOpenAIAdapter,
    anthropic: createAnthropicAdapter,
    ollama: createOllamaAdapter,
    gemini: createGeminiAdapter,
    mistral: createMistralAdapter,
    cohere: createCohereAdapter,
  };

  export function createProvider(
    name: string,
    httpClient: HttpClient,
  ): ProviderAdapter {
    const factory = PROVIDER_FACTORIES[name];
    if (!factory) {
      const supported = Object.keys(PROVIDER_FACTORIES).join(", ");
      throw new Error(`Unknown provider: "${name}". Supported: ${supported}`);
    }
    return factory(httpClient);
  }
  ```

### Pure Functions in Core
- `@kindlm/core` must have **zero I/O dependencies**
- No `fs`, `fetch`, `console.log` in core
- All I/O is **injected as interfaces** (Dependency Injection)
- Example interface pattern from `packages/core/src/providers/interface.ts`:
  ```typescript
  export interface HttpClient {
    request(url: string, init?: HttpRequestInit): Promise<HttpResponse>;
  }

  export interface ProviderAdapter {
    id: string;
    complete(request: ProviderRequest): Promise<ProviderResponse>;
  }
  ```

### Result Types Over Exceptions
- All fallible operations return `Result<T, E>` from `packages/core/src/types/result.ts`
- Pattern: `{ success: true; data: T } | { success: false; error: E }`
- Never throw from core functions (except during config validation with Zod)
- Helper functions:
  ```typescript
  export function ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  export function err<E = KindlmError>(error: E): Result<never, E> {
    return { success: false, error };
  }
  ```
- Usage in tests:
  ```typescript
  const result = parseConfig(VALID_YAML, { configDir: "/tmp" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.project).toBe("test-project");
  }
  ```

### One File Per Concern
- Each assertion type gets its own file: `tool-calls.ts`, `schema.ts`, `pii.ts`, `judge.ts`
- Factories, registries, and interfaces are separate
- Co-locate tests with source files (`.test.ts` suffix)

### Descriptive Naming
- Function names describe behavior, not implementation
- Examples: `evaluateToolCallAssertion()`, `createSchemaValidator()`, `withRetry()`
- Avoid abbreviations in exported names

## TypeScript Conventions

### Strict Mode
- All packages compile with `strict: true`
- Root `tsconfig.json` at `/Users/petr/projects/kindlm/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "module": "esnext",
      "target": "es2022",
      "lib": ["es2022"]
    }
  }
  ```

### verbatimModuleSyntax
- **Always** use `import type` for type-only imports
- Enforced by `@typescript-eslint/consistent-type-imports` rule
- Correct:
  ```typescript
  import type { FileReader, ParseOptions } from "./parser.js";
  import { parseConfig } from "./parser.js";
  ```
- Incorrect:
  ```typescript
  import { FileReader, parseConfig } from "./parser.js"; // ❌
  ```

### Module Extensions
- **All relative imports must include `.js` extension** (ESM)
- Correct: `import { ok } from "../types/result.js"`
- Incorrect: `import { ok } from "../types/result"` ❌
- This is required for ESM bundling and Workers compatibility

### No `any`
- Use `unknown` instead of `any`
- Narrow with type guards:
  ```typescript
  const data: unknown = getInput();
  if (typeof data === "object" && data !== null) {
    // TypeScript narrows here
  }
  ```

### Type Imports for Distributed Code
- For packages exported to npm, use `import type` for all type-only imports
- Workers compatibility: Cloud package imports only **types** from core (no runtime values)

## Exports & Barrel Files

### Barrel Export Pattern
- Each directory with public API has an `index.ts` that re-exports
- File: `packages/core/src/providers/index.ts`
  ```typescript
  export type {
    HttpClient,
    HttpRequestInit,
    HttpResponse,
    ProviderAdapter,
    ProviderRequest,
    ProviderResponse,
    ProviderToolCall,
  } from "./interface.js";
  export { ProviderError } from "./interface.js";

  export { createOpenAIAdapter } from "./openai.js";
  export { createAnthropicAdapter } from "./anthropic.js";
  export { createOllamaAdapter } from "./ollama.js";
  export { createGeminiAdapter } from "./gemini.js";
  export { createMistralAdapter } from "./mistral.js";
  export { createCohereAdapter } from "./cohere.js";
  export { createProvider } from "./registry.js";
  export { runConversation } from "./conversation.js";
  export { withRetry } from "./retry.js";
  export type { RetryOptions } from "./retry.js";
  export { lookupModelPricing } from "./pricing.js";
  export type { ModelPricing, PricingMatch } from "./pricing.js";
  ```

### Package.json Exports
- TypeScript condition **must come first** in `exports` object
- File: `packages/core/package.json`
  ```json
  {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js",
        "require": "./dist/index.cjs"
      }
    },
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
  ```

## Error Handling

### ErrorCode Union Type
- All KindLM errors use predefined error codes (from `packages/core/src/types/result.ts`)
- Codes are organized by category:
  ```typescript
  type ErrorCode =
    // Config errors
    | "CONFIG_NOT_FOUND"
    | "CONFIG_PARSE_ERROR"
    | "CONFIG_VALIDATION_ERROR"
    | "CONFIG_FILE_REF_ERROR"
    | "PATH_TRAVERSAL"
    // Provider errors
    | "PROVIDER_NOT_FOUND"
    | "PROVIDER_AUTH_ERROR"
    | "PROVIDER_RATE_LIMIT"
    | "PROVIDER_TIMEOUT"
    | "PROVIDER_API_ERROR"
    | "PROVIDER_NETWORK_ERROR"
    // ... more codes
  ```

### KindlmError Interface
  ```typescript
  export interface KindlmError {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>; // Type-specific details
    cause?: Error;                      // Wrapped original error
  }
  ```

### Throwing from Core
- Only during **config validation** using Zod
- Zod throws `ZodError` which is caught and converted to `Result<never, KindlmError>`
- Provider API errors are caught and returned as `Result<never, ProviderError>`

## ESLint & Prettier

### Flat Config
- File: `/Users/petr/projects/kindlm/eslint.config.js`
- Enforces:
  - `@typescript-eslint/no-explicit-any` — `error` (use `unknown`)
  - `@typescript-eslint/consistent-type-imports` — `error` (import type)
  - `@typescript-eslint/no-unused-vars` with `argsIgnorePattern: "^_"` for ignored params
  - `no-console` — `error` (no debug logs in committed code)

### Run Linting
  ```bash
  npm run lint          # Lint all packages
  npm run typecheck     # Type check without emit
  ```

## File Organization

### Core Package Structure
```
packages/core/src/
├── types/
│   ├── result.ts       # Result<T, E> type definition
│   ├── result.test.ts
│   ├── config.ts       # Inferred from Zod schema
│   ├── provider.ts     # ProviderRequest, ProviderResponse
│   ├── index.ts        # Barrel export
│   └── ...
├── config/
│   ├── schema.ts       # Zod schema
│   ├── parser.ts       # YAML parse + validate
│   ├── parser.test.ts
│   ├── interpolation.ts
│   ├── index.ts
│   └── ...
├── providers/
│   ├── interface.ts    # ProviderAdapter interface
│   ├── openai.ts
│   ├── openai.test.ts
│   ├── registry.ts     # Factory registry
│   ├── retry.ts        # Retry wrapper
│   ├── pricing.ts      # Model pricing lookup
│   └── index.ts
├── assertions/
│   ├── interface.ts
│   ├── tool-calls.ts   # tool_called, tool_not_called, tool_order
│   ├── schema.ts       # JSON Schema with AJV
│   ├── pii.ts          # PII regex patterns
│   ├── judge.ts        # LLM-as-judge
│   ├── keywords.ts     # keywords_present/absent
│   ├── registry.ts     # Type → handler mapping
│   └── index.ts
├── engine/
│   ├── runner.ts       # Test execution + concurrency
│   ├── aggregator.ts   # Multi-run stats (mean, p50, p95)
│   ├── gate.ts         # Pass/fail evaluation
│   └── index.ts
└── index.ts            # Public barrel export
```

### CLI Package Structure
```
packages/cli/src/
├── bin/
│   └── kindlm.ts       # Commander entry point
├── commands/
│   ├── init.ts         # kindlm init
│   ├── validate.ts     # kindlm validate
│   ├── test.ts         # kindlm test
│   ├── baseline.ts     # kindlm baseline
│   ├── login.ts        # kindlm login
│   └── upload.ts       # kindlm upload
├── utils/
│   ├── run-tests.ts
│   ├── git.ts
│   ├── env.ts
│   ├── file-reader.ts
│   ├── spinner.ts      # ora spinner
│   └── index.ts
└── index.ts
```

## Comments & Documentation

### When to Comment
- **Always:** Explain "why", not "what"
- Avoid: Comments that just repeat the code
- Good: "Retry with exponential backoff to handle transient API failures"
- Bad: "Add 1 to the counter"

### Type Documentation
- Use JSDoc for exported functions/types:
  ```typescript
  /**
   * Parses kindlm.yaml and validates against schema.
   *
   * @param yaml - Raw YAML string
   * @param options - Parse options (configDir, fileReader)
   * @returns Result<ParsedConfig, KindlmError>
   */
  export function parseConfig(
    yaml: string,
    options: ParseOptions,
  ): Result<ParsedConfig, KindlmError> {
    // ...
  }
  ```

## Build & Bundling

### Package Build
- Tool: `tsup` (TypeScript bundler)
- Each package defines `tsup.config.ts`
- Outputs:
  - ESM: `dist/index.js`
  - CJS: `dist/index.cjs`
  - Types: `dist/index.d.ts`

### CLI Bundling
- Single executable via `@vercel/ncc` or tsup
- Includes `@kindlm/core` as bundled dependency

### Cloud Bundling
- Wrangler + tsup
- No bundling of core (imported as types only at runtime)
- Workers compatibility: no Node.js APIs

## Key Files to Know

- `/Users/petr/projects/kindlm/tsconfig.json` — Root TS config
- `/Users/petr/projects/kindlm/eslint.config.js` — Lint rules
- `/Users/petr/projects/kindlm/packages/core/src/types/result.ts` — Result type
- `/Users/petr/projects/kindlm/packages/core/src/providers/interface.ts` — Provider interface
- `/Users/petr/projects/kindlm/packages/core/src/config/schema.ts` — Zod schema
- `/Users/petr/projects/kindlm/packages/*/package.json` — Workspace deps & exports

## Dependency Rules (STRICT)

1. **Core is pure**: No I/O, no external dependencies except Zod + AJV
2. **CLI wraps core**: All core logic via `@kindlm/core` imports
3. **Cloud imports types only**: `import type` from core, never runtime values
4. **No circular dependencies**: Core → nothing, CLI → Core, Cloud → Core types

---

Last updated: 2026-03-27
