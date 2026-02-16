# KindLM — Architecture Decision Records

Each ADR documents a significant technical decision, the alternatives considered, and why we chose what we chose. ADRs are immutable once accepted — if we reverse a decision, we add a new ADR that supersedes the old one.

---

## ADR-001: YAML for Configuration

**Status:** Accepted  
**Date:** February 2026

### Context
KindLM needs a configuration format for test suites. Users will write and read this file frequently. It needs to support nested structures, comments, and multi-line strings (for prompts).

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **YAML** | Human-readable, supports comments, multi-line strings, familiar to DevOps/CI users | Whitespace-sensitive, parsing edge cases, "YAML hell" reputation |
| JSON | Universal, no ambiguity, schema tools mature | No comments, verbose, painful for multi-line strings |
| TOML | Less ambiguous than YAML, supports comments | Poor nested structure support, unfamiliar to most devs |
| TypeScript config | Type-safe, IDE support, full expressiveness | Requires Node.js runtime to parse, not readable by non-TS users |

### Decision
**YAML.** Despite its quirks, YAML is the standard for CI configuration (GitHub Actions, GitLab CI, Docker Compose, Kubernetes). Our target users already write YAML daily. Multi-line strings for prompts are natural in YAML. Comments allow inline documentation.

### Mitigations
- Zod schema validates all config at parse time with specific error messages
- `kindlm validate` catches mistakes before running (and burning API credits)
- Templates from `kindlm init` provide correct starting points
- Documentation shows correct patterns for every feature

---

## ADR-002: Zod for Schema Validation

**Status:** Accepted  
**Date:** February 2026

### Context
Config files from users are untrusted input. We need runtime validation with clear error messages. We also want TypeScript types derived from the schema (single source of truth).

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Zod** | TypeScript-native, `z.infer<>` for types, excellent error messages, composable | Adds dependency, learning curve for contributors |
| Joi | Mature, widely used | No TypeScript type inference, heavier |
| Yup | Similar to Joi, React ecosystem familiar | Worse TypeScript support than Zod |
| JSON Schema + AJV | Standard format, language-agnostic | Verbose to write, no TypeScript type inference |
| Manual validation | Zero dependencies | Unmaintainable, poor error messages |

### Decision
**Zod.** The `z.infer<typeof schema>` pattern means we define the schema once and get both runtime validation and compile-time types. Error messages are excellent out of the box. Zod is the TypeScript community standard in 2026.

### Notes
We still use AJV for user-defined JSON Schemas in the `schema` assertion type. Zod validates our config; AJV validates user-defined output schemas.

---

## ADR-003: Monorepo with Turborepo

**Status:** Accepted  
**Date:** February 2026

### Context
KindLM has three packages (core, cli, cloud) with shared types and a strict dependency direction. We need a build system that handles cross-package dependencies and caching.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Turborepo** | Fast caching, npm workspaces native, minimal config, Vercel-backed | Less mature than Nx |
| Nx | Feature-rich, project graph visualization | Heavy, complex config, overkill for 3 packages |
| Lerna | Established, known | Maintenance concerns, slower than Turbo |
| npm workspaces (no orchestrator) | Zero config | No build caching, no parallelism, manual dependency ordering |
| Separate repos | Full isolation | Painful cross-package development, version drift |

### Decision
**Turborepo with npm workspaces.** Three packages is small enough that Turbo's simplicity wins. Caching is meaningful because `core` doesn't change every commit — cli and cloud rebuilds skip it. Vercel actively maintains Turbo.

---

## ADR-004: Hono for Cloud API Router

**Status:** Accepted  
**Date:** February 2026

### Context
The Cloud API runs on Cloudflare Workers. We need an HTTP router that's Workers-compatible (no Node.js APIs), lightweight, and TypeScript-first.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Hono** | Built for Workers/edge, < 14KB, TypeScript-first, middleware ecosystem, fast | Smaller community than Express |
| Express | Huge ecosystem, universally known | Not Workers-compatible without polyfills, heavy |
| Fastify | Fast, schema validation built-in | Not Workers-compatible |
| itty-router | Ultra-minimal, Workers-native | Too minimal — no middleware, no validation helpers |
| No framework (raw Worker) | Zero overhead | Unmaintainable routing, no middleware |

### Decision
**Hono.** It's the de facto standard for Cloudflare Workers in 2026. TypeScript types are excellent. The middleware system (cors, auth, rate-limit) maps cleanly to our needs. Sub-14KB means fast cold starts.

---

## ADR-005: Cloudflare D1 for Cloud Database

**Status:** Accepted  
**Date:** February 2026

### Context
The Cloud tier needs persistent storage for test runs, results, organizations, and compliance reports. The database runs alongside the Workers API.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Cloudflare D1** | SQLite semantics, global replication, zero config, Workers-native, free tier generous | Relatively new, SQLite limitations (no JSON operators in some versions), eventual consistency on reads |
| Neon (serverless Postgres) | Full Postgres power, mature | External dependency, latency to DB, paid sooner |
| PlanetScale (MySQL) | Proven at scale, branching model | MySQL semantics, pricing, external |
| Supabase (Postgres) | Full platform, auth included | Heavyweight, opinionated, external |
| Turso (libSQL) | SQLite-compatible, edge-native | Less Cloudflare-integrated than D1 |
| KV/Durable Objects | Cloudflare-native, very fast | Not a relational database, complex queries impossible |

### Decision
**Cloudflare D1.** We're already on Cloudflare Workers — D1 is zero-latency from our API handlers. SQLite is more than sufficient for our query patterns (simple CRUD, list with pagination, aggregate counts). The free tier supports early growth. If we outgrow D1, migration to Turso or Neon is straightforward since our queries are simple.

---

## ADR-006: Provider Adapter Pattern

**Status:** Accepted  
**Date:** February 2026

### Context
KindLM needs to call multiple LLM providers (OpenAI, Anthropic, Ollama, future additions). Each has a different API shape for completions, tool calls, and token counting.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Adapter pattern (interface + implementations)** | Clean separation, easy to add new providers, testable with mocks | More files, some boilerplate |
| Direct API calls per provider | Simpler initially | Duplicated logic, hard to test, painful to add providers |
| LiteLLM / universal proxy | One API for all providers | External dependency, version lag, limited tool call support |
| Vercel AI SDK | Provider abstraction built-in | Heavy dependency, may not match our tool call needs exactly |

### Decision
**Adapter pattern.** Each provider implements a `ProviderAdapter` interface with a single `complete()` method. The registry maps strings like `"openai:gpt-4o"` to adapter instances. This is testable (mock the interface), extensible (add a new file), and avoids external dependencies for critical path logic.

### Interface
```typescript
interface ProviderAdapter {
  id: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}
```

Community contributors can add providers by implementing this interface and registering it.

---

## ADR-007: MIT License for CLI/Core, AGPL for Cloud

**Status:** Accepted  
**Date:** February 2026

### Context
KindLM is open-core. The CLI and core library should be maximally open. The Cloud source should be available (for transparency and contributions) but protected from SaaS competitors hosting our code.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **MIT (cli/core) + AGPL (cloud)** | Maximum freedom for CLI users, SaaS protection for cloud | AGPL is controversial in some enterprise orgs |
| MIT everywhere | Maximum adoption, no licensing confusion | Anyone can host our Cloud as a competing SaaS |
| BSL (Business Source License) | Time-delayed open source, SaaS protection | Not OSI-approved, confusing for contributors |
| SSPL (Server Side Public License) | Strong SaaS protection (MongoDB model) | Not OSI-approved, Linux distros won't package it |
| Apache 2.0 + CLA | Patent protection, contributor agreement | CLA friction reduces contributions |

### Decision
**MIT for cli/core, AGPL-3.0 for cloud.** MIT is the gold standard for developer tools — zero friction for adoption. AGPL for the cloud means the source is available and auditable, but anyone hosting it as a SaaS must open-source their modifications. This is the same model as GitLab, Grafana, and n8n. Enterprise customers who need a non-AGPL cloud license can get one through the Enterprise plan.

### Risk
Some enterprises have blanket AGPL policies. This only affects the cloud package — the CLI and core are MIT and unaffected. Enterprise license available on request.

---

## ADR-008: Result Types Over Exceptions

**Status:** Accepted  
**Date:** February 2026

### Context
Functions in `core` can fail for many reasons: invalid config, provider API errors, timeout, assertion logic errors. We need a consistent error handling pattern.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Result types** (`{ success: true, data } \| { success: false, error }`) | Explicit, compiler-checked, no hidden control flow | Verbose, requires unwrapping |
| Throw exceptions | Familiar, less code at call site | Hidden control flow, easy to forget try/catch, hard to test |
| Either/Option monads (fp-ts) | Mathematically sound, composable | Heavy dependency, unfamiliar to most TS devs |
| Error codes (C-style) | Simple | No type safety, no error details |

### Decision
**Result types.** Every function in `core` that can fail returns a discriminated union. The CLI layer catches these and converts to user-facing messages + exit codes. This makes error paths explicit and testable. TypeScript's type narrowing makes the unwrapping ergonomic:

```typescript
const result = parseConfig(yaml);
if (!result.success) {
  console.error(result.error.message);
  process.exit(1);
}
// result.data is typed here
```

### Exception
Provider adapters may throw on network errors. The engine wraps provider calls in try/catch and converts to Result types at the boundary.

---

## ADR-009: Multi-Run Aggregation Default

**Status:** Accepted  
**Date:** February 2026

### Context
LLM outputs are non-deterministic. A single test run may pass or fail by chance. Running multiple times and aggregating reduces noise.

### Options Considered

| Option | Default runs | Tradeoff |
|--------|-------------|----------|
| 1 run | Fast, cheap | High false positive/negative rate |
| **3 runs** | Balanced speed/reliability | 3x API cost |
| 5 runs | More reliable | 5x cost, slow |

### Decision
**Default 3 runs per test.** At temperature 0, most tests are deterministic and 3 runs confirm consistency. At higher temperatures, 3 runs catch intermittent failures without excessive cost. Configurable via `runs` in YAML or `--runs` CLI flag. Gate evaluation uses aggregated pass rate (e.g., 2/3 = 66.7%).

---

## ADR-010: No Telemetry Without Opt-In

**Status:** Accepted  
**Date:** February 2026

### Context
Usage telemetry helps us understand adoption and prioritize features. But developer tools with telemetry face backlash (Homebrew, Gatsby incidents).

### Decision
**No telemetry by default.** If we add anonymous usage stats later, it requires explicit opt-in via `kindlm config set telemetry true`. No data is collected or sent without the user actively choosing to enable it. The CLI will never phone home by default.

---

## ADR-011: tsup for Bundling

**Status:** Accepted  
**Date:** February 2026

### Context
The CLI and core packages need to be published to npm. We need a bundler that produces ESM + CJS dual-format output and handles TypeScript.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **tsup** | Zero-config for TS libraries, ESM+CJS dual output, fast (esbuild) | Less control than Rollup |
| Rollup | Maximum control, tree-shaking | Complex config, plugin management |
| esbuild (direct) | Fastest | No declaration files, manual config |
| tsc only | No external tool | No bundling, no CJS output from ESM source |
| Vite library mode | Good DX | More suited for frontend libraries |

### Decision
**tsup.** One-line config per package produces ESM + CJS + `.d.ts` declaration files. Built on esbuild for speed. Standard in the TS library ecosystem.

---

## ADR-012: Commander.js for CLI Framework

**Status:** Accepted  
**Date:** February 2026

### Context
The CLI needs argument parsing, subcommands, help text, and flag handling.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Commander.js** | De facto standard, huge ecosystem, TypeScript types, subcommand support | Slightly older API design |
| yargs | Powerful, auto-generated help | Heavier, more complex |
| clipanion (Yarn's CLI) | Modern, class-based | Smaller community |
| cac | Lightweight, modern | Less mature |
| oclif (Salesforce) | Full framework, plugin system | Very heavy, enterprise-oriented |

### Decision
**Commander.js.** It's the most widely understood CLI framework in the Node.js ecosystem. Contributors will immediately recognize the patterns. The API is simple and our CLI only has 6 commands — we don't need a framework.
