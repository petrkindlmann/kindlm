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
});
