import { describe, it, expect } from "vitest";
import { ok, err } from "./result.js";
import type { Result, KindlmError } from "./result.js";

describe("Result type", () => {
  it("creates a success result", () => {
    const result = ok(42);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(42);
    }
  });

  it("creates a failure result", () => {
    const error: KindlmError = {
      code: "CONFIG_NOT_FOUND",
      message: "kindlm.yaml not found",
    };
    const result = err(error);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_NOT_FOUND");
      expect(result.error.message).toBe("kindlm.yaml not found");
    }
  });

  it("narrows types via discriminated union", () => {
    const result: Result<string> = ok("hello");
    if (result.success) {
      const value: string = result.data;
      expect(value).toBe("hello");
    }
  });
});
