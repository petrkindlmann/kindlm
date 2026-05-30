import { describe, it, expect } from "vitest";
import { parseConfig, safePath, suggestClosest } from "./parser.js";
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

  it("default repeat is 3 when config omits the defaults block", () => {
    const result = parseConfig(VALID_YAML, { configDir: "/tmp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults.repeat).toBe(3);
    }
  });

  it("default repeat is preserved when explicitly set to 1", () => {
    const yaml = VALID_YAML.trimEnd() + "\ndefaults:\n  repeat: 1\n";
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults.repeat).toBe(1);
    }
  });

  it("default repeat is preserved when explicitly set to 5", () => {
    const yaml = VALID_YAML.trimEnd() + "\ndefaults:\n  repeat: 5\n";
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults.repeat).toBe(5);
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

describe("suggestClosest", () => {
  it("returns the closest match for a typo", () => {
    expect(suggestClosest("greting", ["greeting", "system-prompt"])).toBe("greeting");
  });

  it("returns close match with hyphen difference", () => {
    expect(suggestClosest("gpt4o", ["gpt-4o", "claude-3"])).toBe("gpt-4o");
  });

  it("returns null when no candidate is close enough", () => {
    expect(suggestClosest("xyz", ["greeting", "system-prompt"])).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(suggestClosest("openAI", ["openai", "anthropic"])).toBe("openai");
  });

  it("returns null for empty input", () => {
    expect(suggestClosest("", ["greeting"])).toBeNull();
  });

  it("returns null for empty candidates", () => {
    expect(suggestClosest("hello", [])).toBeNull();
  });
});

describe("parseConfig — Did you mean suggestions", () => {
  it("suggests closest prompt name when typo is close", () => {
    const yaml = VALID_YAML.replace('prompt: "greeting"', 'prompt: "greting"');
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      expect(errors[0]).toContain('Did you mean: "greeting"');
    }
  });

  it("lists available prompts when no close match exists", () => {
    const yaml = VALID_YAML.replace('prompt: "greeting"', 'prompt: "zzz-nope"');
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      expect(errors[0]).toContain("Available prompts:");
    }
  });

  it("suggests closest model ID when typo is close", () => {
    const yaml =
      VALID_YAML.trimEnd() +
      `
  - name: "test-typo"
    prompt: "greeting"
    models: ["gpt4o"]
    expect: {}
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      expect(errors[0]).toContain('Did you mean: "gpt-4o"');
    }
  });

  it("lists available models when no close match exists", () => {
    const yaml =
      VALID_YAML.trimEnd() +
      `
  - name: "test-unknown"
    prompt: "greeting"
    models: ["zzz-unknown"]
    expect: {}
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      expect(errors[0]).toContain("Available models:");
    }
  });

  it("lists available providers when provider not configured", () => {
    // "anthropic" is a valid enum value but not in the providers block — triggers cross-ref error
    const yaml = VALID_YAML.replace('provider: "openai"', 'provider: "anthropic"');
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      // No close match between "anthropic" and ["openai"], so lists available
      expect(errors[0]).toContain("Available providers:");
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

describe("parseConfig — redteam cross-reference validation", () => {
  // Multi-model base config so the "close match" suggestions have a real
  // candidate pool. Uses the same explicit-YAML pattern as other cases in
  // this file rather than JSON fixtures.
  const MULTI_MODEL_YAML = `
kindlm: 1
project: "rt-project"
suite:
  name: "rt-suite"
providers:
  openai:
    apiKeyEnv: "OPENAI_API_KEY"
  anthropic:
    apiKeyEnv: "ANTHROPIC_API_KEY"
models:
  - id: "gpt-4o"
    provider: "openai"
    model: "gpt-4o"
  - id: "claude-sonnet-4-5"
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
prompts:
  greeting:
    user: "Hello"
tests:
  - name: "t1"
    prompt: "greeting"
    expect: {}
`;

  it("fails with a Levenshtein 'did you mean' hint when redteam.target.model is a close typo", () => {
    const yaml =
      MULTI_MODEL_YAML.trimEnd() +
      `
redteam:
  purpose: "Banking support assistant"
  target:
    model: "gpt-4oo"
  plugins:
    - id: "prompt-injection"
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
      const errors = getErrors(result.error.details);
      const targetError = errors.find((e) =>
        e.includes("redteam.target.model"),
      );
      expect(targetError).toBeDefined();
      expect(targetError).toContain('"gpt-4oo"');
      expect(targetError).toContain('Did you mean: "gpt-4o"');
    }
  });

  it("fails with a suggestion when an unknown plugin id is close to a known one", () => {
    // "prompt-injecton" is distance 1 from "prompt-injection".
    // (Per registry tests: threshold = max(2, floor(0.4*len)), so "prompt-inj"
    // at length 10 has budget 4 but distance 6 and gets NO hint — use a
    // single-char typo here so we stay safely under the suggester threshold.)
    const yaml =
      MULTI_MODEL_YAML.trimEnd() +
      `
redteam:
  purpose: "Banking support assistant"
  target:
    model: "gpt-4o"
  plugins:
    - id: "prompt-injecton"
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
      const errors = getErrors(result.error.details);
      const pluginError = errors.find((e) =>
        e.includes("Unknown red team plugin"),
      );
      expect(pluginError).toBeDefined();
      expect(pluginError).toContain('"prompt-injecton"');
      expect(pluginError).toContain('Did you mean: "prompt-injection"');
      // Registry errors are prefixed with `redteam.` in the parser fold
      expect(pluginError).toMatch(/^redteam\./);
    }
  });

  it("accepts a full redteam config with judge model and multiple policy plugins end-to-end", () => {
    const yaml =
      MULTI_MODEL_YAML.trimEnd() +
      `
redteam:
  purpose: "Financial advisor that must never discuss competitors or recommend specific stocks"
  target:
    model: "gpt-4o"
    prompt: "You are a careful financial assistant."
  judge:
    model: "claude-sonnet-4-5"
  plugins:
    - id: "prompt-injection"
      numTests: 3
    - id: "pii-disclosure"
      severity: "high"
    - id: "policy"
      config:
        policy: "Never recommend specific stocks by ticker."
    - id: "policy"
      config:
        policy: "Never discuss competitor brokerages by name."
  strategy:
    concurrency: 2
    maxBudgetUsd: 5.00
  gates:
    maxCriticalFailures: 0
    maxHighFailures: 1
    minOverallPassRate: 0.85
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.redteam).toBeDefined();
      expect(result.data.redteam?.target.model).toBe("gpt-4o");
      expect(result.data.redteam?.judge?.model).toBe("claude-sonnet-4-5");
      expect(result.data.redteam?.plugins).toHaveLength(4);
      expect(result.data.redteam?.strategy.concurrency).toBe(2);
      expect(result.data.redteam?.gates.maxHighFailures).toBe(1);
      // Both policy plugins coexist — the registry keys them by id#index
      const policyPlugins = result.data.redteam?.plugins.filter(
        (p) => p.id === "policy",
      );
      expect(policyPlugins).toHaveLength(2);
    }
  });

  it("fails when redteam.judge.model references an unknown model id", () => {
    const yaml =
      MULTI_MODEL_YAML.trimEnd() +
      `
redteam:
  purpose: "Banking support assistant"
  target:
    model: "gpt-4o"
  judge:
    model: "claude-nope"
  plugins:
    - id: "prompt-injection"
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      const judgeError = errors.find((e) =>
        e.includes("redteam.judge.model"),
      );
      expect(judgeError).toBeDefined();
      expect(judgeError).toContain('"claude-nope"');
    }
  });

  it("aggregates main-config and redteam errors in a single parse pass", () => {
    // Both a top-level error (duplicate test name) and a redteam error
    // should surface together — the cross-ref pass must not short-circuit.
    const yaml =
      MULTI_MODEL_YAML.trimEnd() +
      `
  - name: "t1"
    prompt: "greeting"
    expect: {}
redteam:
  purpose: "Banking support assistant"
  target:
    model: "nonexistent-model"
  plugins:
    - id: "prompt-injection"
`;
    const result = parseConfig(yaml, { configDir: "/tmp" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = getErrors(result.error.details);
      expect(errors.some((e) => e.includes("Duplicate test name"))).toBe(true);
      expect(
        errors.some((e) => e.includes("redteam.target.model")),
      ).toBe(true);
    }
  });
});
