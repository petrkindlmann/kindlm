import { describe, it, expect, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createTempDir, createMockServer, runCLI, writeConfig } from "./helpers.js";

describe("CLI-03: exit code contract", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
  });

  it("exits 0 when all tests pass", async () => {
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
  });

  it("exits 1 when a test fails", async () => {
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
  - name: should-fail
    prompt: greeting
    expect:
      output:
        contains:
          - NONEXISTENT_STRING_THAT_WONT_APPEAR
`);

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake" },
    });
    expect(result.exitCode).toBe(1);
  });

  it("exits 1 on invalid YAML config", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, "kindlm: 999\ninvalid: true\n");

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake" },
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("validation failed");
  });

  it("exits 1 when config file is missing", async () => {
    ({ dir, cleanup } = createTempDir());

    const result = await runCLI(["test", "-c", "nonexistent.yaml"], {
      cwd: dir,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
  });

  it("exits 1 when API key env var is missing", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, `
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
          - Hello
`);

    // Deliberately do NOT set OPENAI_API_KEY
    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: {},
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("OPENAI_API_KEY");
  });

  it("exits 1 when provider is unreachable", async () => {
    ({ dir, cleanup } = createTempDir());
    // Point to a port that nothing listens on
    writeConfig(dir, `
kindlm: 1
project: test-project
suite:
  name: test-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:1/v1"
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
defaults:
  timeoutMs: 5000
`);

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake" },
    });
    expect(result.exitCode).toBe(1);
  });

  it("exits 1 when provider returns 401", async () => {
    ({ dir, cleanup } = createTempDir());
    const handler = (_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Invalid API key" } }));
    };
    const { port, close } = await createMockServer({ handler });
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
      env: { OPENAI_API_KEY: "sk-bad-key" },
    });
    expect(result.exitCode).toBe(1);
  });
});
