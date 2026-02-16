import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import { createCostAssertion } from "./cost.js";

function ctx(costUsd: number): AssertionContext {
  return { outputText: "", toolCalls: [], configDir: "/tmp", costUsd };
}

describe("createCostAssertion", () => {
  it("passes when cost is within budget", async () => {
    const assertion = createCostAssertion({ maxUsd: 0.5 });
    const results = await assertion.evaluate(ctx(0.1));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("fails when cost exceeds budget", async () => {
    const assertion = createCostAssertion({ maxUsd: 0.01 });
    const results = await assertion.evaluate(ctx(0.05));
    expect(results[0]).toMatchObject({ passed: false });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("$0.0500");
  });

  it("passes at exact budget", async () => {
    const assertion = createCostAssertion({ maxUsd: 0.25 });
    const results = await assertion.evaluate(ctx(0.25));
    expect(results[0]).toMatchObject({ passed: true });
  });
});
