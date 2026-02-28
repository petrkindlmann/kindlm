# Command Tests

## Overview

Command tests let you run shell commands as test inputs instead of sending prompts to LLM providers. The command's stdout is captured, parsed for KindLM protocol events, and assertions are evaluated against the output — just like prompt-based tests.

Use command tests to:
- Test real agent scripts and pipelines end-to-end
- Validate CLI tools that wrap LLM calls
- Run pre-built test harnesses and assert on their output
- Test non-LLM components in the same suite as LLM tests

## Configuration

Use `command:` instead of `prompt:` in a test case. Exactly one must be set.

```yaml
tests:
  - name: "agent-script-test"
    command: "python run_agent.py --input '{{query}}'"
    vars:
      query: "What is the refund policy?"
    expect:
      output:
        contains: ["refund", "policy"]
      guardrails:
        pii:
          enabled: true
      toolCalls:
        - tool: lookup_order
          argsMatch:
            order_id: "12345"
```

### Key differences from prompt tests

| Aspect | Prompt tests | Command tests |
|--------|-------------|---------------|
| Input | `prompt:` referencing prompts section | `command:` with shell command |
| Model multiplication | Runs once per model × repeat | Runs once per repeat only |
| Model ID in reports | The configured model ID | `"command"` |
| Provider required | Yes | No (but needed for judge assertions) |
| Token/cost tracking | From provider response | Not available (always 0) |

### Variable interpolation

Template variables (`{{var}}`) work in command strings, same as in prompts:

```yaml
tests:
  - name: "parameterized-command"
    command: "node test-agent.js --user {{user_id}} --action {{action}}"
    vars:
      user_id: "u-12345"
      action: "refund"
    expect:
      output:
        contains: ["processed"]
```

## KindLM Protocol Events

By default, all stdout is captured as plain text output. To report structured data (tool calls, JSON output), your command can emit **protocol events** — JSON lines starting with `{"kindlm":`.

### `tool_call` event

Report that a tool was called:

```
{"kindlm":"tool_call","name":"lookup_order","arguments":{"order_id":"12345"}}
```

Optional `id` field:

```
{"kindlm":"tool_call","id":"custom-id","name":"search","arguments":{"query":"test"}}
```

If `id` is omitted, auto-generated IDs are assigned (`cmd_tc_0`, `cmd_tc_1`, ...).

### `output_json` event

Report structured JSON output (available as `outputJson` in assertion context):

```
{"kindlm":"output_json","data":{"result":"success","items":["a","b"]}}
```

### Example script output

```
Starting agent pipeline...
{"kindlm":"tool_call","name":"lookup_order","arguments":{"order_id":"12345"}}
Order found: #12345, status: delivered
{"kindlm":"tool_call","name":"check_refund_eligibility","arguments":{"order_id":"12345"}}
{"kindlm":"output_json","data":{"eligible":true,"reason":"within_30_days"}}
Refund approved for order #12345.
```

KindLM parses this into:
- **outputText:** `"Starting agent pipeline...\nOrder found: #12345, status: delivered\nRefund approved for order #12345."`
- **toolCalls:** `[{name: "lookup_order", ...}, {name: "check_refund_eligibility", ...}]`
- **outputJson:** `{eligible: true, reason: "within_30_days"}`

Lines that look like JSON but aren't valid protocol events are treated as plain text.

## Execution Details

### Timeout

Command tests respect `defaults.timeoutMs` from the config. If a command exceeds the timeout, it receives `SIGTERM` followed by `SIGKILL` after 1 second.

### Working directory

Commands run in the config file's directory (`configDir`).

### Environment

Commands inherit the current process environment. Additional variables can be set via the command string itself.

### Exit codes

A non-zero exit code from the command does **not** automatically fail the test. Assertions are evaluated against whatever stdout was produced. This allows testing error-handling paths.

## Architecture

Command test support follows KindLM's zero-I/O core principle:

- **`packages/core/src/engine/command.ts`** — Pure `CommandExecutor` interface and `parseCommandOutput()` function. No Node.js dependencies.
- **`packages/cli/src/utils/command-executor.ts`** — `createNodeCommandExecutor()` implementation using `child_process.spawn`.
- **`packages/core/src/engine/runner.ts`** — `executeCommandUnit()` handles the command execution path; command tests get `modelId: "command"` and skip model multiplication.

The `CommandExecutor` interface is injected into the runner via `RunnerDeps`, keeping core testable without actual process spawning.
