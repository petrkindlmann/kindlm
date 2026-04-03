# Phase 13: Rich Tool Call Failure Output - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 13-rich-tool-call-failure-output
**Areas discussed:** Failure format, Metadata structure, Passing output, Truncation behavior
**Mode:** Auto (--auto)

---

## Failure Format

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered list with arg diff | Show numbered list of all actual tool calls + field-level diff on argsMatch failure | ✓ |
| Flat expected/received string | Keep current format, just add args to the message | |
| Table format | Render as table with columns for tool name, args, match status | |

**User's choice:** [auto] Numbered list with arg diff (recommended default)
**Notes:** Inspired by Vitest's expected/received pattern. Shows the full call sequence on TOOL_CALL_MISSING so the user sees what DID happen.

---

## Metadata Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Structured metadata on AssertionResult | receivedToolCalls, expectedTool, expectedArgs, argDiffs fields in metadata | ✓ |
| Inline in failureMessage | Encode all info as a formatted string in failureMessage | |
| Separate ToolCallFailureDetail type | New dedicated type for tool call failure details | |

**User's choice:** [auto] Structured metadata on AssertionResult (recommended default)
**Notes:** metadata is already Record<string, unknown> — no type changes needed. Reporter reads and formats. Clean assertion/reporter separation.

---

## Passing Output

| Option | Description | Selected |
|--------|-------------|----------|
| Tool name + arg count | `✓ Tool "search" called (3 args)` — compact, dimmed | ✓ |
| Tool name only | `✓ Tool "search" called` — minimal | |
| Tool name + full args | Show all arguments even on pass | |

**User's choice:** [auto] Tool name + arg count (recommended default)
**Notes:** Prevents information overload. Full args available in JSON reporter.

---

## Truncation Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 500 char limit with indicator | Truncate JSON.stringify(args) at 500 chars, append ...(truncated) | ✓ |
| 200 char limit | More aggressive truncation for terminal readability | |
| No truncation | Always show full args, let terminal wrap | |

**User's choice:** [auto] 500 char limit with indicator (recommended default)
**Notes:** Only in pretty reporter. JSON reporter gets full untruncated output.

---

## Claude's Discretion

- Exact indentation and spacing of numbered call sequence
- Color scheme for expected vs received in arg diffs
- Internal structure of computeArgDiffs helper
- Whether argCount is in metadata or computed in reporter

## Deferred Ideas

None.
