import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerValidateCommand } from "./validate.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { readFileSync } from "node:fs";
const mockReadFileSync = vi.mocked(readFileSync);

const VALID_YAML = `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  greeting:
    user: "Hello"
tests:
  - name: basic
    prompt: greeting
    expect: {}
`;

describe("validate command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerValidateCommand(program);

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

  it("prints success for valid config", async () => {
    mockReadFileSync.mockReturnValue(VALID_YAML);

    try {
      await program.parseAsync(["node", "kindlm", "validate"]);
    } catch {
      // process.exit throws
    }

    const allOutput = [...logs, ...errors].join("\n");
    if (exitCode !== undefined) {
      expect(exitCode).toBe(0);
    }
    expect(allOutput).toContain("test-suite");
  });

  it("prints error for invalid YAML", async () => {
    mockReadFileSync.mockReturnValue("{{invalid yaml: [}");

    try {
      await program.parseAsync(["node", "kindlm", "validate"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("failed");
  });

  it("prints error for missing file", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    try {
      await program.parseAsync(["node", "kindlm", "validate"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("not found");
  });

  it("reports cross-reference errors", async () => {
    const badYaml = `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  greeting:
    user: "Hello"
tests:
  - name: basic
    prompt: nonexistent_prompt
    expect: {}
`;
    mockReadFileSync.mockReturnValue(badYaml);

    try {
      await program.parseAsync(["node", "kindlm", "validate"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("nonexistent_prompt");
  });
});
