import type { ProviderToolCall } from "../types/provider.js";
import type { Result } from "../types/result.js";

// ============================================================
// Command Executor Interface (injected — core has zero I/O)
// ============================================================

export interface CommandExecutor {
  execute(command: string, options: CommandExecuteOptions): Promise<Result<RawCommandOutput>>;
}

export interface CommandExecuteOptions {
  timeoutMs: number;
  env?: Record<string, string>;
  cwd?: string;
}

export interface RawCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// ============================================================
// Parsed Command Result
// ============================================================

export interface CommandResult {
  outputText: string;
  toolCalls: ProviderToolCall[];
  outputJson?: unknown;
  exitCode: number;
  stderr: string;
}

// ============================================================
// Protocol Event Types
// ============================================================

interface KindlmToolCallEvent {
  kindlm: "tool_call";
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface KindlmOutputJsonEvent {
  kindlm: "output_json";
  data: unknown;
}

type KindlmEvent = KindlmToolCallEvent | KindlmOutputJsonEvent;

// ============================================================
// Parser
// ============================================================

export function parseCommandOutput(raw: RawCommandOutput): CommandResult {
  const lines = raw.stdout.split("\n");
  const textLines: string[] = [];
  const toolCalls: ProviderToolCall[] = [];
  let outputJson: unknown = undefined;
  let toolCallCounter = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("{\"kindlm\":")) {
      textLines.push(line);
      continue;
    }

    const event = tryParseEvent(trimmed);
    if (!event) {
      textLines.push(line);
      continue;
    }

    if (event.kindlm === "tool_call") {
      toolCalls.push({
        id: event.id ?? `cmd_tc_${toolCallCounter++}`,
        name: event.name,
        arguments: event.arguments,
        index: 0,
      });
    } else if (event.kindlm === "output_json") {
      outputJson = event.data;
    }
  }

  return {
    outputText: textLines.join("\n").trim(),
    toolCalls,
    outputJson,
    exitCode: raw.exitCode,
    stderr: raw.stderr,
  };
}

function tryParseEvent(line: string): KindlmEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (typeof parsed.kindlm !== "string") return null;

    if (parsed.kindlm === "tool_call") {
      if (typeof parsed.name !== "string") return null;
      return {
        kindlm: "tool_call",
        id: typeof parsed.id === "string" ? parsed.id : undefined,
        name: parsed.name,
        arguments: (typeof parsed.arguments === "object" && parsed.arguments !== null
          ? parsed.arguments
          : {}) as Record<string, unknown>,
      };
    }

    if (parsed.kindlm === "output_json") {
      return {
        kindlm: "output_json",
        data: parsed.data,
      };
    }

    return null;
  } catch {
    return null;
  }
}
