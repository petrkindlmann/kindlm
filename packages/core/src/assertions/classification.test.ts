import { describe, it, expect } from "vitest";
import { classifyAssertion, isDeterministic, isProbabilistic } from "./classification.js";

describe("classifyAssertion", () => {
  it("classifies deterministic assertion types", () => {
    const deterministicTypes = [
      "tool_called",
      "tool_not_called",
      "tool_order",
      "schema",
      "pii",
      "keywords_present",
      "keywords_absent",
      "contains",
      "not_contains",
      "max_length",
      "latency",
      "cost",
    ];

    for (const type of deterministicTypes) {
      expect(classifyAssertion(type)).toBe("deterministic");
    }
  });

  it("classifies probabilistic assertion types", () => {
    expect(classifyAssertion("judge")).toBe("probabilistic");
    expect(classifyAssertion("drift")).toBe("probabilistic");
  });

  it("defaults unknown types to deterministic", () => {
    expect(classifyAssertion("unknown_type")).toBe("deterministic");
    expect(classifyAssertion("custom")).toBe("deterministic");
  });
});

describe("isDeterministic", () => {
  it("returns true for deterministic types", () => {
    expect(isDeterministic("schema")).toBe(true);
    expect(isDeterministic("tool_called")).toBe(true);
  });

  it("returns false for probabilistic types", () => {
    expect(isDeterministic("judge")).toBe(false);
    expect(isDeterministic("drift")).toBe(false);
  });
});

describe("isProbabilistic", () => {
  it("returns true for probabilistic types", () => {
    expect(isProbabilistic("judge")).toBe(true);
    expect(isProbabilistic("drift")).toBe(true);
  });

  it("returns false for deterministic types", () => {
    expect(isProbabilistic("schema")).toBe(false);
    expect(isProbabilistic("latency")).toBe(false);
  });
});
