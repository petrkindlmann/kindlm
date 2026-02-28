# KindLM

Behavioral regression testing for AI agents. Test what your agents **do** — not just what they say.

KindLM is an open-source CLI that runs structured tests against AI agents: tool calls, decisions, schema compliance, PII detection, and EU AI Act Annex IV documentation.

## Quick start

```bash
npm install -g @kindlm/cli
kindlm init
kindlm test
```

## Repository layout

```
packages/
  core/       @kindlm/core  — Business logic, zero I/O dependencies
  cli/        @kindlm/cli   — CLI entry point, thin wrapper around core
  cloud/      @kindlm/cloud — Cloudflare Workers API + D1 database
docs/         Technical specs and documentation
site/         Documentation website (Next.js)
```

## Documentation

Full documentation lives in [`docs/`](./docs/). Start with [00-README.md](./docs/00-README.md).

## License

MIT (core + CLI) | AGPL (cloud)
