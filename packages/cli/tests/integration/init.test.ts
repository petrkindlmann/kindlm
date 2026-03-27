import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, runCLI } from "./helpers.js";

describe("kindlm init", () => {
  let cleanup: () => void;
  let dir: string;

  afterEach(() => {
    cleanup?.();
  });

  it("creates kindlm.yaml in current directory", async () => {
    ({ dir, cleanup } = createTempDir());
    const result = await runCLI(["init"], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(dir, "kindlm.yaml"))).toBe(true);
    expect(result.stdout).toContain("Created kindlm.yaml");
  });

  it("fails if kindlm.yaml already exists", async () => {
    ({ dir, cleanup } = createTempDir());
    await runCLI(["init"], { cwd: dir });
    const result = await runCLI(["init"], { cwd: dir });

    expect(result.exitCode).toBe(1);
  });

  it("overwrites with --force flag", async () => {
    ({ dir, cleanup } = createTempDir());
    await runCLI(["init"], { cwd: dir });
    const result = await runCLI(["init", "--force"], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created kindlm.yaml");
  });

  it("generated YAML contains required fields", async () => {
    ({ dir, cleanup } = createTempDir());
    const result = await runCLI(["init"], { cwd: dir });

    expect(result.exitCode).toBe(0);
    const content = readFileSync(join(dir, "kindlm.yaml"), "utf-8");
    expect(content).toContain("kindlm: 1");
    expect(content).toContain("providers:");
    expect(content).toContain("models:");
    expect(content).toContain("tests:");
    expect(content).toContain("suite:");
  });
});
