import { describe, it, expect, afterEach } from "vitest";
import { createTempDir, createMockServer, runCLI, writeConfig } from "./helpers.js";

describe("CLI-05: stderr/stdout separation", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
  });

  it("test report goes to stdout only", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
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
          - Hello
`);

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake" },
    });

    expect(result.exitCode).toBe(0);
    // stdout should contain the test report
    expect(result.stdout).toContain("passed");
    // stderr should NOT contain the report text
    expect(result.stderr).not.toContain("passed");
  });

  it("json reporter produces valid JSON on stdout", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
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
          - Hello
`);

    const result = await runCLI(["test", "-c", "kindlm.yaml", "--reporter", "json"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake" },
    });

    expect(result.exitCode).toBe(0);
    // stdout must be parseable JSON (no spinner garbage mixed in)
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toBeDefined();
  });

  it("errors go to stderr, not stdout", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, "kindlm: 999\n");

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
    });

    expect(result.exitCode).toBe(1);
    // Error messages should be on stderr
    expect(result.stderr.length).toBeGreaterThan(0);
    // stdout should be empty or minimal (no error text)
    expect(result.stdout).not.toContain("error");
    expect(result.stdout).not.toContain("failed");
  });

  it("validate success goes to stdout, errors to stderr", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, "kindlm: 999\n");

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], { cwd: dir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Validation failed");
    expect(result.stdout).not.toContain("Validation failed");
  });
});
