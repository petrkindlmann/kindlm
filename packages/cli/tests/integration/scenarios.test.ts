import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createTempDir,
  createMockServer,
  runCLI,
  writeConfig,
} from "./helpers.js";

// ============================================================
// Helpers
// ============================================================

/** Minimal valid YAML config that hits a mock server on the given port. */
function minimalConfig(port: number, overrides = ""): string {
  return `
kindlm: 1
project: scenario-test
suite:
  name: scenario-suite
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
  default:
    user: "Hello"
tests:
  - name: basic
    prompt: default
    expect:
      output:
        contains:
          - Hello
${overrides}`;
}

function openaiReply(
  text: string,
  toolCalls: unknown[] | null = null,
): string {
  return JSON.stringify({
    choices: [
      {
        message: { content: text, tool_calls: toolCalls },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    model: "gpt-4o-2024-08-06",
  });
}

function makeHandler(
  statusCode: number,
  body: string,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (_req, res) => {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(body);
  };
}

const defaultEnv = { OPENAI_API_KEY: "sk-test-fake-key" };

// ============================================================
// 1a. Config Diversity (~15 tests)
// ============================================================

describe("Scenario: Config Diversity", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
    closeServer = undefined;
  });

  it("minimal config with empty expect runs successfully", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: minimal
suite:
  name: minimal-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  simple:
    user: "Hello"
tests:
  - name: empty-expect
    prompt: simple
    expect: {}
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("all assertion types combined runs without crash", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: all-assertions
suite:
  name: combined
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  combined:
    user: "Do something"
tests:
  - name: combined-assertions
    prompt: combined
    expect:
      output:
        contains:
          - Hello
      guardrails:
        pii:
          enabled: true
        keywords:
          deny:
            - FORBIDDEN_WORD
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("multi-provider config both hit same mock", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        if (req.url?.includes("/v1/messages")) {
          // Anthropic format
          res.end(
            JSON.stringify({
              content: [{ type: "text", text: "Hello from Claude!" }],
              usage: { input_tokens: 20, output_tokens: 10 },
              model: "claude-sonnet-4-5-20250929",
              stop_reason: "end_turn",
            }),
          );
        } else {
          // OpenAI format
          res.end(openaiReply("Hello from GPT!"));
        }
      },
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: multi-provider
suite:
  name: multi
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    baseUrl: "http://127.0.0.1:${port}"
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
  - name: hello-test
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: { ...defaultEnv, ANTHROPIC_API_KEY: "sk-ant-test-fake" },
    });
    expect(result.exitCode).toBe(0);
  });

  it("unicode project name works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port).replace("project: scenario-test", 'project: "测试项目"'));

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("unicode test name works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port).replace("name: basic", 'name: "テスト一"'));

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("large prompt variable (5KB) works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    const bigValue = "A".repeat(5120);
    writeConfig(
      dir,
      `
kindlm: 1
project: big-vars
suite:
  name: big
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  tmpl:
    user: "Context: {{context}}"
tests:
  - name: big-var
    prompt: tmpl
    vars:
      context: "${bigValue}"
    expect: {}
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("config with inline YAML comments works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
# Top-level comment
kindlm: 1  # version
project: commented  # project name
suite:
  name: comment-suite  # suite comment
providers:
  openai:  # using openai
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  greeting:
    user: "Hello"  # user prompt
tests:
  - name: commented-test  # test comment
    prompt: greeting
    expect: {}
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("test with skip: true is not run", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: skip-test
suite:
  name: skip-suite
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
  - name: should-run
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
  - name: should-skip
    prompt: greeting
    skip: true
    expect:
      output:
        contains:
          - WILL_NEVER_MATCH
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("2 pass + 1 fail → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: mixed-results
suite:
  name: mixed
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
  - name: pass-1
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
  - name: pass-2
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
  - name: fail-1
    prompt: greeting
    expect:
      output:
        contains:
          - NONEXISTENT_WORD
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("missing prompt reference → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());

    writeConfig(
      dir,
      `
kindlm: 1
project: bad-ref
suite:
  name: bad
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
  - name: bad-prompt-ref
    prompt: nonexistent_prompt
    expect: {}
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("empty test name → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());

    writeConfig(
      dir,
      `
kindlm: 1
project: empty-name
suite:
  name: bad
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
  - name: ""
    prompt: greeting
    expect: {}
`,
    );

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("test with repeat: 3 runs successfully", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: repeat-test
suite:
  name: repeat
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
  - name: repeated
    prompt: greeting
    repeat: 3
    expect:
      output:
        contains:
          - Hello
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("20 identical tests all pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    const tests = Array.from(
      { length: 20 },
      (_, i) => `
  - name: test-${i}
    prompt: greeting
    expect:
      output:
        contains:
          - Hello`,
    ).join("\n");

    writeConfig(
      dir,
      `
kindlm: 1
project: many-tests
suite:
  name: bulk
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
${tests}
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("test with every optional field works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: full-featured
suite:
  name: full
  description: "A fully-featured suite"
  tags:
    - regression
    - smoke
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0.5
      maxTokens: 2048
      topP: 0.9
prompts:
  tmpl:
    system: "You are a helpful assistant. Context: {{context}}"
    user: "User query: {{query}}"
tests:
  - name: full-options
    prompt: tmpl
    vars:
      context: "test context"
      query: "test query"
    models:
      - gpt-4o
    tags:
      - smoke
    repeat: 2
    expect:
      output:
        contains:
          - Hello
      guardrails:
        keywords:
          deny:
            - BANNED
defaults:
  repeat: 1
  concurrency: 2
  timeoutMs: 30000
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });
});

// ============================================================
// 1b. Workflow Diversity (~8 tests)
// ============================================================

describe("Scenario: Workflow Diversity", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
    closeServer = undefined;
  });

  it("--reporter json produces valid JSON on stdout", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--reporter", "json"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toBeDefined();
  });

  it("--reporter junit produces XML with <testsuites>", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--reporter", "junit"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<testsuites");
  });

  it("--gate 100 on passing suite → exit 0", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--gate", "100"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
  });

  it("--gate 100 on failing suite → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      minimalConfig(port).replace("- Hello", "- NONEXISTENT"),
    );

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--gate", "100"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(1);
  });

  it("--runs 3 override works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--runs", "3"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
  });

  it("validate on valid config → exit 0, no test execution", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("valid");
  });

  it("validate on broken config → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    writeConfig(dir, "kindlm: 999\ninvalid: true\n");

    const result = await runCLI(["validate", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });

    expect(result.exitCode).toBe(1);
  });

  it("--compliance flag produces compliance output", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: compliance-test
suite:
  name: compliance-suite
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
compliance:
  enabled: true
  framework: eu-ai-act
  metadata:
    systemName: "Test System"
    systemVersion: "1.0.0"
`,
    );

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--compliance"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).toContain("compliance");
  });
});

// ============================================================
// 1c. Provider Response Diversity (~10 tests)
// ============================================================

describe("Scenario: Provider Response Diversity", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
    closeServer = undefined;
  });

  it("tool call response + toolCalls assertion → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("I'll look that up.", [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "lookup_order",
              arguments: '{"order_id": "12345"}',
            },
          },
        ]),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: tool-call
suite:
  name: tool-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  order:
    user: "Look up order 12345"
tests:
  - name: tool-called
    prompt: order
    expect:
      toolCalls:
        - tool: lookup_order
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("plain text + shouldNotCall → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: no-tool
suite:
  name: no-tool-suite
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
  - name: no-tool-called
    prompt: greeting
    expect:
      toolCalls:
        - tool: process_refund
          shouldNotCall: true
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("tool called that shouldNotCall → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("Done.", [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "process_refund",
              arguments: "{}",
            },
          },
        ]),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: forbidden-tool
suite:
  name: forbidden-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  refund:
    user: "Process refund"
tests:
  - name: shouldnt-call
    prompt: refund
    expect:
      toolCalls:
        - tool: process_refund
          shouldNotCall: true
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("multi-tool response with assertions → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("Processing your request.", [
          {
            id: "call_1",
            type: "function",
            function: { name: "lookup_order", arguments: '{"id":"1"}' },
          },
          {
            id: "call_2",
            type: "function",
            function: { name: "get_customer", arguments: '{"id":"2"}' },
          },
          {
            id: "call_3",
            type: "function",
            function: { name: "send_email", arguments: '{"to":"a@b.com"}' },
          },
        ]),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: multi-tool
suite:
  name: multi-tool-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  action:
    user: "Process everything"
tests:
  - name: three-tools
    prompt: action
    expect:
      toolCalls:
        - tool: lookup_order
        - tool: get_customer
        - tool: send_email
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("response with SSN + pii assertion → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("Your SSN is 123-45-6789."),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: pii-detect
suite:
  name: pii-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "What is my SSN?"
tests:
  - name: ssn-leak
    prompt: query
    expect:
      guardrails:
        pii:
          enabled: true
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("clean response + pii assertion → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: pii-clean
suite:
  name: pii-clean-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "Hello"
tests:
  - name: no-pii
    prompt: query
    expect:
      guardrails:
        pii:
          enabled: true
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("response with required keywords allow → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(200, openaiReply("I am happy to help you today.")),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: kw-allow
suite:
  name: kw-suite
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
  - name: keywords-allow
    prompt: greeting
    expect:
      guardrails:
        keywords:
          allow:
            - happy
            - help
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("response with denied keywords → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("I cannot help with that, sorry."),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: kw-deny
suite:
  name: kw-deny-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "Do something"
tests:
  - name: keywords-deny
    prompt: query
    expect:
      guardrails:
        keywords:
          deny:
            - cannot
            - sorry
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("empty response + contains assertion → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(200, openaiReply("")),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: empty-response
suite:
  name: empty-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "Say something"
tests:
  - name: empty-check
    prompt: query
    expect:
      output:
        contains:
          - word
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("10KB text response does not crash", async () => {
    ({ dir, cleanup } = createTempDir());
    const bigText = "Lorem ipsum dolor sit amet. ".repeat(400);
    const { port, close } = await createMockServer({
      handler: makeHandler(200, openaiReply(bigText)),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: big-response
suite:
  name: big-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "Tell me a long story"
tests:
  - name: big-output
    prompt: query
    expect:
      output:
        contains:
          - Lorem
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });
});

// ============================================================
// 1d. Edge Cases (~10 tests)
// ============================================================

describe("Scenario: Edge Cases", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
    closeServer = undefined;
  });

  it("provider 429 rate limit → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        429,
        JSON.stringify({
          error: { message: "Rate limit exceeded", type: "rate_limit_error" },
        }),
      ),
    });
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("provider 500 server error → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        500,
        JSON.stringify({
          error: { message: "Internal server error", type: "server_error" },
        }),
      ),
    });
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("provider 401 auth error → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        401,
        JSON.stringify({
          error: {
            message: "Invalid API key",
            type: "authentication_error",
          },
        }),
      ),
    });
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("tool call with argsMatch partial match → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("Looking up.", [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "lookup_order",
              arguments: '{"order_id":"12345","include_details":true}',
            },
          },
        ]),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: args-match
suite:
  name: args-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  order:
    user: "Look up order 12345"
tests:
  - name: partial-args
    prompt: order
    expect:
      toolCalls:
        - tool: lookup_order
          argsMatch:
            order_id: "12345"
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("output.maxLength on long response → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("This is a response that is definitely longer than ten characters."),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: max-length
suite:
  name: maxlen-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  query:
    user: "Say something"
tests:
  - name: too-long
    prompt: query
    expect:
      output:
        maxLength: 10
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("output.format json + schemaFile + valid JSON → pass", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply('{"action":"refund","amount":42.50}'),
      ),
    });
    closeServer = close;

    const schemaPath = join(dir, "order-schema.json");
    writeFileSync(
      schemaPath,
      JSON.stringify({
        type: "object",
        properties: {
          action: { type: "string" },
          amount: { type: "number" },
        },
        required: ["action", "amount"],
      }),
    );

    writeConfig(
      dir,
      `
kindlm: 1
project: json-schema
suite:
  name: schema-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  structured:
    user: "Return a JSON object with action and amount"
tests:
  - name: valid-json
    prompt: structured
    expect:
      output:
        format: json
        schemaFile: ./order-schema.json
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("output.format json + schemaFile + non-JSON → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(200, openaiReply("This is not JSON at all.")),
    });
    closeServer = close;

    const schemaPath = join(dir, "order-schema.json");
    writeFileSync(
      schemaPath,
      JSON.stringify({
        type: "object",
        properties: { action: { type: "string" } },
        required: ["action"],
      }),
    );

    writeConfig(
      dir,
      `
kindlm: 1
project: bad-json
suite:
  name: bad-json-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  structured:
    user: "Return JSON"
tests:
  - name: invalid-json
    prompt: structured
    expect:
      output:
        format: json
        schemaFile: ./order-schema.json
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });

  it("config with gates.passRateMin evaluates gate", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: gate-config
suite:
  name: gate-suite
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
  - name: pass-test
    prompt: greeting
    expect:
      output:
        contains:
          - Hello
gates:
  passRateMin: 0.9
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("very long test name (100 chars) works", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    const longName = "a".repeat(100);
    writeConfig(
      dir,
      minimalConfig(port).replace("name: basic", `name: "${longName}"`),
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("notContains assertion on matching response → exit 1", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: not-contains
suite:
  name: notcontains-suite
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
  - name: forbidden-word
    prompt: greeting
    expect:
      output:
        notContains:
          - Hello
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(1);
  });
});

// ============================================================
// 1e. Real-World Patterns (~5 tests)
// ============================================================

describe("Scenario: Real-World Patterns", () => {
  let cleanup: () => void;
  let dir: string;
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    cleanup?.();
    await closeServer?.();
    closeServer = undefined;
  });

  it("refund agent: tool_called + shouldNotCall + pii + keywords", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply(
          "I found your order. Let me look into that for you. I understand your frustration.",
          [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "lookup_order",
                arguments: '{"order_id":"12345"}',
              },
            },
          ],
        ),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: refund-agent
suite:
  name: refund-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  refund:
    system: "You are a refund agent. Never process refunds without manager approval."
    user: "I want to return order #12345"
tests:
  - name: refund-happy-path
    prompt: refund
    expect:
      toolCalls:
        - tool: lookup_order
        - tool: process_refund
          shouldNotCall: true
      guardrails:
        pii:
          enabled: true
        keywords:
          deny:
            - INTERNAL_ERROR
            - stacktrace
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("support bot: keywords allow + pii", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply(
          "I understand how you feel. Let me help you resolve this issue right away.",
        ),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: support-bot
suite:
  name: support-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  support:
    system: "You are an empathetic support agent."
    user: "My order arrived damaged"
tests:
  - name: empathetic-response
    prompt: support
    expect:
      guardrails:
        pii:
          enabled: true
        keywords:
          allow:
            - understand
            - help
            - resolve
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("structured output API: JSON schema validation", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply(
          '{"ticket_id":"TK-001","priority":"high","category":"billing","summary":"Customer charged twice"}',
        ),
      ),
    });
    closeServer = close;

    const schemaPath = join(dir, "ticket-schema.json");
    writeFileSync(
      schemaPath,
      JSON.stringify({
        type: "object",
        properties: {
          ticket_id: { type: "string", pattern: "^TK-\\d+" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          category: { type: "string" },
          summary: { type: "string" },
        },
        required: ["ticket_id", "priority", "category", "summary"],
        additionalProperties: false,
      }),
    );

    writeConfig(
      dir,
      `
kindlm: 1
project: structured-api
suite:
  name: structured-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  classify:
    system: "Classify the support ticket into a JSON object."
    user: "I was charged twice for my subscription"
tests:
  - name: json-output
    prompt: classify
    expect:
      output:
        format: json
        schemaFile: ./ticket-schema.json
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("multi-turn tool agent with defaultResponse + assertions", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer({
      handler: makeHandler(
        200,
        openaiReply("Based on the order, here is your status.", [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "get_order_status",
              arguments: '{"order_id":"ORD-789"}',
            },
          },
        ]),
      ),
    });
    closeServer = close;

    writeConfig(
      dir,
      `
kindlm: 1
project: tool-agent
suite:
  name: tool-agent-suite
providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: "http://127.0.0.1:${port}/v1"
models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
prompts:
  status:
    system: "You are an order status agent."
    user: "What's the status of ORD-789?"
tests:
  - name: tool-agent-test
    prompt: status
    tools:
      - name: get_order_status
        description: "Get order status by ID"
        parameters:
          type: object
          properties:
            order_id:
              type: string
          required:
            - order_id
        defaultResponse:
          status: shipped
          eta: "2026-02-20"
    expect:
      toolCalls:
        - tool: get_order_status
          argsMatch:
            order_id: "ORD-789"
`,
    );

    const result = await runCLI(["test", "-c", "kindlm.yaml"], {
      cwd: dir,
      env: defaultEnv,
    });
    expect(result.exitCode).toBe(0);
  });

  it("CI pipeline: --reporter junit --gate 90 → JUnit XML + gate", async () => {
    ({ dir, cleanup } = createTempDir());
    const { port, close } = await createMockServer();
    closeServer = close;

    writeConfig(dir, minimalConfig(port));

    const result = await runCLI(
      ["test", "-c", "kindlm.yaml", "--reporter", "junit", "--gate", "90"],
      { cwd: dir, env: defaultEnv },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("<testsuites");
  });
});
