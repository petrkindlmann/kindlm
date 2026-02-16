import { describe, it, expect } from "vitest";
import { parseConfig, safePath } from "./parser.js";
import type { FileReader } from "./parser.js";
import { ok, err } from "../types/result.js";

function getErrors(details: Record<string, unknown> | undefined): string[] {
  return (details?.errors ?? []) as string[];
}

const VALID_YAML = `
kindlm: 1
project: "test-project"
suite:
  name: "test-suite"
providers:
  openai:
    apiKeyEnv: "OPENAI_API_KEY"
models:
  - id: "gpt-4o"
    provider: "openai"
    model: "gpt-4o"
prompts:
  greeting:
    user: "Hello {{name}}"
tests:
  - name: "test-1"
    prompt: "greeting"
    vars:
      name: "World"
    expect: {}
`;

describe("parseConfig", () => {
  it("parses valid YAML into a typed config", () => {
    const result = parseConfig(VALID_YAML, { configDir: "/tmp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project).toBe("test-project");
      expect(result.data.models[0]?.id).toBe("gpt-4o");
    }
  });

  it("returns CONFIG_PARSE_ERROR for invalid YAML syntax", () => {
    const result = parseConfig("key: [unterminated", { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_PARSE_ERROR");
    }
  });

  it("returns CONFIG_VALIDATION_ERROR for valid YAML but invalid schema", () => {
    const result = parseConfig("kindlm: 2\nproject: test\n", {
      configDir: "/tmp",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
    }
  });

  it("detects missing prompt reference", () => {
    const yaml = VALID_YAML.replace(
      'prompt: "greeting"',
      'prompt: "nonexistent"',
    );
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("cross-reference");
      expect(getErrors(result.error.details)[0]).toContain("nonexistent");
    }
  });

  it("detects missing model reference in test", () => {
    const yaml =
      VALID_YAML.trimEnd() +
      `
  - name: "test-2"
    prompt: "greeting"
    models: ["nonexistent-model"]
    expect: {}
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain(
        "nonexistent-model",
      );
    }
  });

  it("detects missing provider reference in model", () => {
    const yaml = VALID_YAML.replace(
      'provider: "openai"',
      'provider: "anthropic"',
    );
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain("anthropic");
    }
  });

  it("detects invalid judgeModel reference", () => {
    const yaml =
      VALID_YAML.trimEnd() +
      `
defaults:
  judgeModel: "nonexistent-model"
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain("judgeModel");
    }
  });

  it("detects duplicate model IDs", () => {
    const yaml = `
kindlm: 1
project: "test"
suite:
  name: "s"
providers:
  openai:
    apiKeyEnv: "KEY"
models:
  - id: "dup"
    provider: "openai"
    model: "gpt-4o"
  - id: "dup"
    provider: "openai"
    model: "gpt-4o-mini"
prompts:
  p:
    user: "hi"
tests:
  - name: "t"
    prompt: "p"
    expect: {}
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain(
        'Duplicate model ID "dup"',
      );
    }
  });

  it("detects duplicate test names", () => {
    const yaml = `
kindlm: 1
project: "test"
suite:
  name: "s"
providers:
  openai:
    apiKeyEnv: "KEY"
models:
  - id: "m1"
    provider: "openai"
    model: "gpt-4o"
prompts:
  p:
    user: "hi"
tests:
  - name: "dup"
    prompt: "p"
    expect: {}
  - name: "dup"
    prompt: "p"
    expect: {}
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain(
        'Duplicate test name "dup"',
      );
    }
  });

  it("validates schemaFile with FileReader", () => {
    const yaml = `
kindlm: 1
project: "test"
suite:
  name: "s"
providers:
  openai:
    apiKeyEnv: "KEY"
models:
  - id: "m1"
    provider: "openai"
    model: "gpt-4o"
prompts:
  p:
    user: "hi"
tests:
  - name: "t"
    prompt: "p"
    expect:
      output:
        format: "json"
        schemaFile: "./schema.json"
`;
    const reader: FileReader = {
      readFile: (path: string) =>
        path.endsWith("schema.json")
          ? ok("{}")
          : err({
              code: "CONFIG_FILE_REF_ERROR",
              message: "Not found",
            }),
    };
    const result = parseConfig(yaml, {
      configDir: "/project",
      fileReader: reader,
    });
    expect(result.success).toBe(true);
  });

  it("reports missing schemaFile via FileReader", () => {
    const yaml = `
kindlm: 1
project: "test"
suite:
  name: "s"
providers:
  openai:
    apiKeyEnv: "KEY"
models:
  - id: "m1"
    provider: "openai"
    model: "gpt-4o"
prompts:
  p:
    user: "hi"
tests:
  - name: "t"
    prompt: "p"
    expect:
      output:
        format: "json"
        schemaFile: "./missing.json"
`;
    const reader: FileReader = {
      readFile: () =>
        err({ code: "CONFIG_FILE_REF_ERROR", message: "Not found" }),
    };
    const result = parseConfig(yaml, {
      configDir: "/project",
      fileReader: reader,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getErrors(result.error.details)[0]).toContain("missing.json");
    }
  });

  it("skips file ref validation when no FileReader provided", () => {
    const yaml = `
kindlm: 1
project: "test"
suite:
  name: "s"
providers:
  openai:
    apiKeyEnv: "KEY"
models:
  - id: "m1"
    provider: "openai"
    model: "gpt-4o"
prompts:
  p:
    user: "hi"
tests:
  - name: "t"
    prompt: "p"
    expect:
      output:
        format: "json"
        schemaFile: "./whatever.json"
`;
    const result = parseConfig(yaml, { configDir: "/project" });
    expect(result.success).toBe(true);
  });

  it("rejects config larger than 1MB", () => {
    const huge = "a: " + "x".repeat(1_048_577);
    const result = parseConfig(huge, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_TOO_LARGE");
    }
  });

  it("accepts config exactly at 1MB limit", () => {
    // Just under 1MB — will fail schema validation but NOT size limit
    const yaml = "a: " + "x".repeat(1_048_570);
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should fail for schema reasons, not size
      expect(result.error.code).not.toBe("CONFIG_TOO_LARGE");
    }
  });
});

describe("safePath", () => {
  it("allows relative paths within config dir", () => {
    const result = safePath("/project", "schemas/test.json");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("/project/schemas/test.json");
    }
  });

  it("blocks absolute paths", () => {
    const result = safePath("/project", "/etc/passwd");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("blocks path traversal with ..", () => {
    const result = safePath("/project", "../../etc/passwd");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("allows .. that stays within config dir", () => {
    const result = safePath("/project", "sub/../schema.json");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("/project/schema.json");
    }
  });

  it("blocks Windows absolute paths", () => {
    const result = safePath("/project", "C:\\Windows\\system32");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });

  it("blocks backslash-prefixed paths", () => {
    const result = safePath("/project", "\\Windows\\system32");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PATH_TRAVERSAL");
    }
  });
});
