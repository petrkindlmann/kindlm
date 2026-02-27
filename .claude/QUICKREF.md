# Quick Reference

## Key Files

| What | Where |
|------|-------|
| Project architecture | `.claude/claude.md` |
| Prioritized backlog | `.claude/TASKS.md` |
| Config schema | `docs/02-CONFIG_SCHEMA.md` |
| Provider interfaces | `docs/03-PROVIDER_INTERFACE.md` |
| Assertion engine | `docs/04-ASSERTION_ENGINE.md` |
| Cloud API schema | `docs/05-CLOUD_API.md` |
| EU AI Act mapping | `docs/06-COMPLIANCE_SPEC.md` |
| CLI commands | `docs/08-CLI_REFERENCE.md` |
| Pricing model | `docs/11-PRICING.md` |

## Commands Cheat Sheet

```bash
npm install              # Install all workspace deps
npm run build            # Build core → cli → cloud
npm run test             # Run all Vitest suites
npm run typecheck        # TypeScript strict check
npm run lint             # ESLint all packages
npm run dev:cli          # Watch mode for CLI dev
npm run dev:cloud        # Wrangler dev for Cloud
```

## Key Decisions

- **YAML config, not JSON** — users write YAML
- **Zod for validation** — all external input validated
- **Result types, not exceptions** — return `{ success, data } | { success, error }`
- **No `any`** — use `unknown` + type narrowing
- **Pure functions in core** — no I/O, no side effects
- **MIT for CLI/core, AGPL for cloud** — open-core boundary
- **Exit code 0 = pass, 1 = fail** — critical for CI
- **Provider keys are user's** — never stored or proxied

## Package Dependency Direction

```
cli → core ← cloud (types only)
```

core has zero external deps (except zod, ajv, yaml, uuid).
