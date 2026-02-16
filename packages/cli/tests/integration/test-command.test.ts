import { describe, it, expect, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTempDir, createMockServer, runCLI, writeConfig } from "./helpers.js";

describe("kindlm test", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
  });

  it("runs tests against mock OpenAI server", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

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
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
prompts:
  greeting:
    user: "Hello, how are you?"
tests:
  - name: basic-greeting
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake-key" },
    });

    expect(result.exitCode).toBe(0);
  });

  it("creates .kindlm/last-run.json after test", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

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
`,
    );

    await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake-key" },
    });

    expect(existsSync(join(dir, ".kindlm", "last-run.json"))).toBe(true);
  });

  it("exits 1 when gate fails", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

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
          - NONEXISTENT_STRING_THAT_WONT_MATCH
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml", "--gate", "100"], {
      cwd: dir,
      env: { OPENAI_API_KEY: "sk-test-fake-key" },
    });

    expect(result.exitCode).toBe(1);
  });
});
