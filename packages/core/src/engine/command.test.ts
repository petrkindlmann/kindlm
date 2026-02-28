import { describe, it, expect } from "vitest";
import { parseCommandOutput } from "./command.js";
import type { RawCommandOutput } from "./command.js";

describe("parseCommandOutput", () => {
  it("parses plain text output", () => {
    const raw: RawCommandOutput = {
      stdout: "Hello world\nSecond line",
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe("Hello world\nSecond line");
    expect(result.toolCalls).toEqual([]);
    expect(result.outputJson).toBeUndefined();
    expect(result.exitCode).toBe(0);
  });

  it("extracts tool_call protocol events", () => {
    const raw: RawCommandOutput = {
      stdout: [
        "Starting...",
        '{"kindlm":"tool_call","name":"lookup_order","arguments":{"order_id":"12345"}}',
        "Done.",
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe("Starting...\nDone.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toEqual({
      id: "cmd_tc_0",
      name: "lookup_order",
      arguments: { order_id: "12345" },
    });
  });

  it("uses custom id when provided in tool_call event", () => {
    const raw: RawCommandOutput = {
      stdout: '{"kindlm":"tool_call","id":"custom-id","name":"my_tool","arguments":{}}',
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.toolCalls[0]?.id).toBe("custom-id");
  });

  it("extracts output_json protocol events", () => {
    const raw: RawCommandOutput = {
      stdout: [
        "Processing...",
        '{"kindlm":"output_json","data":{"result":"success","count":42}}',
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe("Processing...");
    expect(result.outputJson).toEqual({ result: "success", count: 42 });
  });

  it("handles multiple tool calls with auto-incrementing IDs", () => {
    const raw: RawCommandOutput = {
      stdout: [
        '{"kindlm":"tool_call","name":"tool_a","arguments":{"x":1}}',
        '{"kindlm":"tool_call","name":"tool_b","arguments":{"y":2}}',
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]?.id).toBe("cmd_tc_0");
    expect(result.toolCalls[1]?.id).toBe("cmd_tc_1");
  });

  it("treats malformed JSON as plain text", () => {
    const raw: RawCommandOutput = {
      stdout: '{"kindlm": not valid json}',
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe('{"kindlm": not valid json}');
    expect(result.toolCalls).toEqual([]);
  });

  it("treats JSON without kindlm field as plain text", () => {
    const raw: RawCommandOutput = {
      stdout: '{"hello":"world"}',
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe('{"hello":"world"}');
  });

  it("treats unknown kindlm event types as plain text", () => {
    const raw: RawCommandOutput = {
      stdout: '{"kindlm":"unknown_event","data":"something"}',
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe('{"kindlm":"unknown_event","data":"something"}');
  });

  it("preserves stderr", () => {
    const raw: RawCommandOutput = {
      stdout: "output",
      stderr: "warning: something happened",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.stderr).toBe("warning: something happened");
  });

  it("preserves exit code", () => {
    const raw: RawCommandOutput = {
      stdout: "error output",
      stderr: "fatal error",
      exitCode: 1,
    };

    const result = parseCommandOutput(raw);
    expect(result.exitCode).toBe(1);
  });

  it("handles empty stdout", () => {
    const raw: RawCommandOutput = {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    expect(result.outputText).toBe("");
    expect(result.toolCalls).toEqual([]);
  });

  it("handles tool_call missing name gracefully", () => {
    const raw: RawCommandOutput = {
      stdout: '{"kindlm":"tool_call","arguments":{"x":1}}',
      stderr: "",
      exitCode: 0,
    };

    const result = parseCommandOutput(raw);
    // Missing name → invalid event → treated as plain text
    expect(result.outputText).toBe('{"kindlm":"tool_call","arguments":{"x":1}}');
    expect(result.toolCalls).toEqual([]);
  });
});
