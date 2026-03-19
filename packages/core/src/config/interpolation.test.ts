import { describe, it, expect } from "vitest";
import { interpolate, findMissingVars } from "./interpolation.js";

describe("interpolate", () => {
  it("substitutes a single variable", () => {
    const result = interpolate("Hello {{name}}", { name: "World" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Hello World");
    }
  });

  it("substitutes multiple variables", () => {
    const result = interpolate("{{greeting}} {{name}}!", {
      greeting: "Hi",
      name: "Alice",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Hi Alice!");
    }
  });

  it("substitutes repeated occurrences of the same variable", () => {
    const result = interpolate("{{x}} and {{x}}", { x: "ok" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("ok and ok");
    }
  });

  it("returns error on missing variable", () => {
    const result = interpolate("Hello {{name}}", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("name");
    }
  });

  it("returns the template unchanged when no placeholders", () => {
    const result = interpolate("no vars here", {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("no vars here");
    }
  });

  it("handles empty template", () => {
    const result = interpolate("", { name: "unused" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("");
    }
  });

  it("returns error listing all missing variables", () => {
    const result = interpolate("{{a}} {{b}} {{c}}", { a: "ok" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("b");
      expect(result.error.message).toContain("c");
    }
  });
});

describe("findMissingVars", () => {
  it("returns missing variable names", () => {
    expect(findMissingVars("{{a}} {{b}}", { a: "ok" })).toEqual(["b"]);
  });

  it("returns empty array when all vars present", () => {
    expect(
      findMissingVars("{{x}}", { x: "val" }),
    ).toEqual([]);
  });

  it("deduplicates repeated missing vars", () => {
    expect(
      findMissingVars("{{x}} {{x}}", {}),
    ).toEqual(["x"]);
  });

  it("returns empty array for template with no placeholders", () => {
    expect(findMissingVars("hello", {})).toEqual([]);
  });

  it("does not report env vars as missing", () => {
    expect(findMissingVars("{{env.FOO}}", {})).toEqual([]);
  });
});

describe("env interpolation", () => {
  it("substitutes {{env.FOO}} from env parameter", () => {
    const result = interpolate("key={{env.FOO}}", {}, { FOO: "bar" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("key=bar");
    }
  });

  it("leaves {{env.MISSING}} as raw placeholder when env var is undefined", () => {
    const result = interpolate("key={{env.MISSING}}", {}, { OTHER: "val" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("key={{env.MISSING}}");
    }
  });

  it("leaves {{env.FOO}} as raw placeholder when no env parameter provided", () => {
    const result = interpolate("key={{env.FOO}}", {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("key={{env.FOO}}");
    }
  });

  it("substitutes both regular vars and env vars in same template", () => {
    const result = interpolate(
      "Hello {{name}}, key={{env.API_KEY}}",
      { name: "Alice" },
      { API_KEY: "sk-123" },
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Hello Alice, key=sk-123");
    }
  });

  it("handles env vars with underscores and numbers", () => {
    const result = interpolate("{{env.MY_VAR_2}}", {}, { MY_VAR_2: "val" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("val");
    }
  });

  it("still errors on missing regular vars even when env vars are present", () => {
    const result = interpolate(
      "{{missing}} {{env.FOO}}",
      {},
      { FOO: "bar" },
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("missing");
    }
  });
});
