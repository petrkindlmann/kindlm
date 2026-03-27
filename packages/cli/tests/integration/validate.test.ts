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

  it("does not require API key environment variables", async () => {
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
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
  - id: claude
    provider: anthropic
    model: claude-sonnet-4-5-20250929
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

    // Run with NO API keys set
    const result = await runCLI(["validate", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: {},
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Config is valid");
    // Verify no error about missing API keys
    expect(result.stderr).not.toContain("API");
    expect(result.stderr).not.toContain("OPENAI_API_KEY");
  });

  it("reports specific validation errors for malformed config", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
models: []
prompts: {}
tests: []
`);

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], { cwd: dir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Validation failed");
  });

  it("exits 1 for missing config file", async () => {
    ({ dir, cleanup } = createTempDir());

    const result = await runCLI(["validate", "-c", "nonexistent.yaml"], { cwd: dir });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
  });
});
