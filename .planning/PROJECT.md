# KindLM Launch Ops

## What This Is

Operational tasks to fully deploy KindLM v2 — push code, run migrations, deploy services, publish releases.

## Core Value

Get everything live so users can install v2.0.0 and all cloud features work in production.

## Constraints

- Some items need Petr's credentials (Stripe dashboard, VS Code PAT, Sentry project)
- D1 migrations must run in order
- Version Packages PR must be merged after push

## Current State

- Phase 1 complete — v2.0.0 deployed, CI fixed, Worker live, D1 migrations applied
- Phase 2 complete — Append-only run artifacts + versioned baselines implemented and verified

---
*Last updated: 2026-04-01*
