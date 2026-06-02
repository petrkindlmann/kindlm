import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import { createCostAssertion } from "./cost.js";

function ctx(costUsd: number | undefined): AssertionContext {
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

  it("fails (does not silently pass) when cost is unknown", async () => {
    // Unpriced models (Mistral/Cohere/HTTP) report undefined cost. A cost gate
    // the user explicitly set must not pass at a fabricated $0.
    const assertion = createCostAssertion({ maxUsd: 0.01 });
    const results = await assertion.evaluate(ctx(undefined));
    expect(results[0]).toMatchObject({ passed: false, failureCode: "COST_UNKNOWN" });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg.toLowerCase()).toContain("unknown");
  });

  it("does not report a fabricated $0 in metadata when cost is unknown", async () => {
    const assertion = createCostAssertion({ maxUsd: 1 });
    const results = await assertion.evaluate(ctx(undefined));
    const meta = (results[0] as { metadata?: { costUsd?: unknown } }).metadata ?? {};
    expect(meta.costUsd).toBeUndefined();
  });
});
