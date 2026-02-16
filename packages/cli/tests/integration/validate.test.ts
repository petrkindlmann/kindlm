import { describe, it, expect, afterEach } from "vitest";
import { createTempDir, runCLI, writeConfig } from "./helpers.js";

describe("kindlm validate", () => {
  let cleanup: () => void;
  let dir: string;

  afterEach(() => {
    cleanup?.();
  });

  it("exits 0 for valid config", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(
      dir,
      `
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
    expect:
      output:
        contains:
          - hello
`,
    );

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], { cwd: dir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Config is valid");
  });

  it("exits 1 for invalid config", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, "kindlm: 999\n");

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], { cwd: dir });
    expect(result.exitCode).toBe(1);
  });
});
