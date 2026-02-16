import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import { createLatencyAssertion } from "./latency.js";

function ctx(latencyMs: number): AssertionContext {
  return { outputText: "", toolCalls: [], configDir: "/tmp", latencyMs };
}

describe("createLatencyAssertion", () => {
  it("passes when latency is within limit", async () => {
    const assertion = createLatencyAssertion({ maxMs: 5000 });
    const results = await assertion.evaluate(ctx(3000));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("fails when latency exceeds limit", async () => {
    const assertion = createLatencyAssertion({ maxMs: 1000 });
    const results = await assertion.evaluate(ctx(2500));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "PROVIDER_TIMEOUT",
    });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("2500");
  });

  it("passes at exact limit", async () => {
    const assertion = createLatencyAssertion({ maxMs: 1000 });
    const results = await assertion.evaluate(ctx(1000));
    expect(results[0]).toMatchObject({ passed: true });
  });
});
