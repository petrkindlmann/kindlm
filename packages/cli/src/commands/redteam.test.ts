import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerRedTeamCommand } from "./redteam.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, writeFileSync } from "node:fs";
const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe("redteam init command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerRedTeamCommand(program);

    logs = [];
    errors = [];
    exitCode = undefined;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  it("creates kindlm-redteam.yaml when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const call = mockWriteFileSync.mock.calls[0];
    const path = call?.[0];
    const content = call?.[1];
    expect(String(path)).toContain("kindlm-redteam.yaml");
    expect(content).toContain("redteam:");

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm-redteam.yaml");
  });

  it("fails when kindlm-redteam.yaml already exists without --force", async () => {
    mockExistsSync.mockReturnValue(true);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "init"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("already exists");
  });

  it("overwrites when --force is provided", async () => {
    mockExistsSync.mockReturnValue(true);

    await program.parseAsync(["node", "kindlm", "redteam", "init", "--force"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm-redteam.yaml");
  });

  it("template contains expected red team config keys", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    const call = mockWriteFileSync.mock.calls[0];
    const content = call?.[1];
    const yaml = content as string;
    expect(yaml).toContain("redteam:");
    expect(yaml).toContain("target:");
    expect(yaml).toContain("plugins:");
    expect(yaml).toContain("purpose:");
    expect(yaml).toContain("prompt-injection");
    expect(yaml).toContain("policy:");
  });

  it("prints next steps after creation", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Next steps");
    expect(allOutput).toContain("kindlm redteam run");
  });
});
