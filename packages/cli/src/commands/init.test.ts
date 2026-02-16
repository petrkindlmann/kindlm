import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerInitCommand } from "./init.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import { existsSync, writeFileSync } from "node:fs";
const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

describe("init command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerInitCommand(program);

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

  it("creates kindlm.yaml when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "init"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, content] = mockWriteFileSync.mock.calls[0]!;
    expect(content).toContain("kindlm: 1");

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm.yaml");
  });

  it("fails when kindlm.yaml already exists without --force", async () => {
    mockExistsSync.mockReturnValue(true);

    try {
      await program.parseAsync(["node", "kindlm", "init"]);
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

    await program.parseAsync(["node", "kindlm", "init", "--force"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm.yaml");
  });

  it("template contains expected config keys", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "init"]);

    const [, content] = mockWriteFileSync.mock.calls[0]!;
    const yaml = content as string;
    expect(yaml).toContain("kindlm: 1");
    expect(yaml).toContain("suite:");
    expect(yaml).toContain("providers:");
    expect(yaml).toContain("models:");
    expect(yaml).toContain("tests:");
    expect(yaml).toContain("defaults:");
  });

  it("prints next steps after creation", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "init"]);

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Next steps");
    expect(allOutput).toContain("kindlm test");
  });
});
