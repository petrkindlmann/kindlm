# Contributing to KindLM

Thank you for considering contributing to KindLM. This document covers how to set up your development environment, the coding standards we follow, and how to submit changes.

---

## Quick Start

```bash
# Clone
git clone https://github.com/kindlm/kindlm.git
cd kindlm

# Install
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Run the CLI locally
cd packages/cli
npm run dev -- test ../../examples/basic-prompt-test/kindlm.yaml
```

---

## Repository Structure

```
packages/
  core/     # @kindlm/core — shared logic, assertions, engine
  cli/      # @kindlm/cli — CLI entry point
  cloud/    # @kindlm/cloud — Cloudflare Workers API
```

See `01-PROJECT_STRUCTURE.md` for full details on package boundaries.

---

## Development Workflow

### 1. Pick an Issue

- Check the [issue tracker](https://github.com/kindlm/kindlm/issues) for `good first issue` labels
- If you want to work on something that doesn't have an issue, open one first to discuss the approach
- Assign yourself to the issue so others know it's being worked on

### 2. Branch

```bash
git checkout -b feat/your-feature    # for features
git checkout -b fix/your-fix         # for bug fixes
git checkout -b docs/your-docs       # for documentation
```

### 3. Code

- Write code following the standards below
- Add or update tests for any logic changes
- Run `npm run typecheck` and `npm run lint` before committing

### 4. Test

```bash
# Run all tests
npm run test

# Run tests for a specific package
cd packages/core && npx vitest

# Run a specific test file
cd packages/core && npx vitest src/assertions/schema.test.ts
```

### 5. Submit a Pull Request

- Fill out the PR template
- Link the related issue
- Ensure CI passes
- Request review from a maintainer

---

## Coding Standards

### TypeScript

- **Strict mode** — `"strict": true` in tsconfig. No `any` unless absolutely necessary (and documented why).
- **Explicit return types** on exported functions.
- **Prefer `interface` over `type`** for object shapes that might be extended.
- **Prefer `const` over `let`**. Never use `var`.
- **No classes unless needed** — prefer plain functions and objects. Classes are acceptable for adapters (OpenAI, Anthropic) where statefulness makes sense.
- **Named exports only** — no default exports (except in `bin/kindlm.ts`).

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `tool-calls.ts` |
| Functions | camelCase | `evaluateGates()` |
| Interfaces/Types | PascalCase | `AssertionResult` |
| Constants | UPPER_SNAKE_CASE | `MAX_TURNS` |
| Zod schemas | PascalCase + Schema | `ModelSchema` |
| Test files | `*.test.ts` | `schema.test.ts` |

### Error Handling

- Use typed errors (`ProviderError`, `ConfigError`) not generic `Error`
- Always include an error code for programmatic handling
- Include context in error messages: what was expected vs. what happened
- Never swallow errors silently

### Testing

- Use Vitest
- Test files live next to the source file: `schema.ts` → `schema.test.ts`
- Every assertion type needs tests for: pass, fail, edge cases
- Mock provider adapters in engine tests — never call real APIs in unit tests
- Integration tests (in `packages/cli/tests/integration/`) can use fixture configs

```typescript
// Example test
import { describe, it, expect } from "vitest";
import { SchemaAssertion } from "./schema";

describe("SchemaAssertion", () => {
  it("passes when JSON is valid against schema", async () => {
    const assertion = new SchemaAssertion("json", "./fixtures/test.schema.json");
    const results = await assertion.evaluate({
      outputText: '{"name": "test", "value": 42}',
      toolCalls: [],
      configDir: __dirname,
    });
    expect(results).toHaveLength(2); // parse + schema
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("fails with SCHEMA_PARSE_ERROR when output is not JSON", async () => {
    const assertion = new SchemaAssertion("json", "./fixtures/test.schema.json");
    const results = await assertion.evaluate({
      outputText: "not json at all",
      toolCalls: [],
      configDir: __dirname,
    });
    expect(results[0].passed).toBe(false);
    expect(results[0].failureCode).toBe("SCHEMA_PARSE_ERROR");
  });
});
```

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add tool call argument schema validation
fix(cli): correct exit code on provider timeout
docs: update config reference for judge assertions
test(core): add edge case tests for PII detection
chore: update dependencies
```

---

## Adding a New Assertion Type

1. Create `packages/core/src/assertions/your-assertion.ts`
2. Implement the `Assertion` interface
3. Add it to `packages/core/src/assertions/registry.ts`
4. Add the Zod schema for its config to `packages/core/src/config/schema.ts`
5. Write tests in `your-assertion.test.ts`
6. Add documentation to [Assertion Engine](/docs/assertions)
7. Add an example to a template config in `templates/`

---

## Adding a New Provider

1. Create `packages/core/src/providers/your-provider.ts`
2. Implement the `ProviderAdapter` interface
3. Register it in `packages/core/src/providers/registry.ts`
4. Add its config schema to the `ProvidersSchema` in `schema.ts`
5. Add pricing data if available
6. Write tests with mocked HTTP responses
7. Add documentation to [Provider Interface](/docs/providers)

---

## Release Process

We use [Changesets](https://github.com/changesets/changesets) for versioning:

```bash
# After making changes, create a changeset
npx changeset

# Follow the prompts to describe your change and select the bump type
# Commit the changeset file with your PR
```

Releases are automated via GitHub Actions when changesets are merged to `main`.

---

## CI/CD

### CI Workflow

Every push to `main` and every pull request triggers the CI workflow (`.github/workflows/ci.yml`):

1. Checkout + Node.js 20 setup
2. `npm ci` — install dependencies
3. `npx turbo run build` — build all packages
4. `npx turbo run typecheck` — type-check all packages
5. `npx turbo run lint` — lint all packages
6. `npx turbo run test` — run all test suites

The workflow uses concurrency groups to cancel in-progress CI runs for the same branch when a new commit is pushed.

### Release Workflow

Merging changesets to `main` triggers the release workflow (`.github/workflows/release.yml`):

1. If there are pending changesets, the workflow opens/updates a "Version Packages" PR
2. When that PR is merged, the workflow publishes updated packages to npm
3. Uses `changesets/action@v1` for automated version bumping and publishing
4. Requires `NPM_TOKEN` secret to be set in the repository

### Reusable GitHub Action

The project includes a reusable GitHub Action at `.github/kindlm-action/action.yml` for running KindLM in CI:

```yaml
# In your project's CI workflow:
- uses: kindlm/kindlm/.github/kindlm-action@main
  with:
    config: kindlm.yaml      # Path to config file
    reporter: junit           # Output format
    gate: 95                  # Minimum pass rate
    compliance: true          # Generate compliance report
    token: ${{ secrets.KINDLM_TOKEN }}  # Upload to Cloud
```

---

## Code of Conduct

Be kind. Be constructive. Assume good intent. We're building a tool about reliability — let's be reliable collaborators too.

---

## License

KindLM uses a dual-license open-core model:

- **`@kindlm/core` + `@kindlm/cli`** — MIT License. Free forever.
- **`@kindlm/cloud`** — AGPL-3.0. Source available, but commercial use requires a license.

By contributing to `core` or `cli`, you agree that your contributions will be licensed under MIT. Contributions to `cloud` are licensed under AGPL-3.0. This split ensures the CLI remains fully open while the Cloud business model is sustainable.
