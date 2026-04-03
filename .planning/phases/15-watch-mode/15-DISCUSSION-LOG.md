# Phase 15: Watch Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-02
**Phase:** 15-watch-mode
**Areas discussed:** File watcher upgrade, Process management, Output format, Cost tracking, Signal handling
**Mode:** Auto (--auto)

---

## Critical Finding: Foundation Already Exists

Codebase scout revealed ~60% of watch mode already built:
- `packages/cli/src/utils/watcher.ts` — watchFile() with debounce using node:fs.watch
- `packages/cli/src/commands/test.ts` lines 95-117 — --watch flag wired, watches config, re-runs
- process.exit() already skipped in watch mode (line 241)

This transforms Phase 15 from greenfield to upgrade + completion.

---

## All areas auto-selected with recommended defaults.

| Area | Decision | Rationale |
|------|----------|-----------|
| File watcher | Replace node:fs.watch with chokidar 4.x + awaitWriteFinish | Cross-platform reliability |
| Process management | Boolean abort flag + single queued re-run | No child processes needed |
| Output format | ISO timestamp separator, no terminal clear | Scroll-back preservation |
| Cost tracking | Session-level accumulator from RunResult | Free with existing cost data |
| Signal handling | SIGINT/SIGTERM → close watcher + abort + summary + exit(0) | Clean shutdown |

## Claude's Discretion

- watchFile() signature evolution
- Internal abort state machine design
- Brief summary line before separator

## Deferred Ideas

None.
