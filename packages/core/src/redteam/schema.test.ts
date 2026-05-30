import { describe, it, expect } from "vitest";
import { validateRedTeamConfig, RedTeamConfigSchema } from "./schema.js";

function minimalRedTeam(overrides: Record<string, unknown> = {}) {
  return {
    purpose: "Customer-support chatbot that answers billing questions.",
    target: { model: "gpt-4o" },
    plugins: [{ id: "prompt-injection" }],
    ...overrides,
  };
}

describe("validateRedTeamConfig", () => {
  it("accepts a valid minimal red team config", () => {
    const result = validateRedTeamConfig(minimalRedTeam());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.purpose).toContain("Customer-support");
      expect(result.data.plugins).toHaveLength(1);
      // Defaults are populated
      expect(result.data.plugins[0]!.numTests).toBe(5);
      expect(result.data.strategy.concurrency).toBe(4);
      expect(result.data.gates.maxCriticalFailures).toBe(0);
      expect(result.data.gates.maxHighFailures).toBe(0);
    }
  });

  it("accepts a valid full red team config with policy plugin", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        target: {
          model: "gpt-4o",
          prompt: "You are a helpful billing assistant.",
        },
        judge: { model: "gpt-4o", betaJudge: true },
        plugins: [
          { id: "prompt-injection", numTests: 10, severity: "critical" },
          { id: "pii-disclosure", numTests: 3 },
          {
            id: "policy",
            numTests: 2,
            config: { policy: "Never recommend competitor products." },
          },
        ],
        strategy: { concurrency: 8, maxBudgetUsd: 25 },
        gates: {
          maxCriticalFailures: 0,
          maxHighFailures: 2,
          minOverallPassRate: 0.9,
        },
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plugins).toHaveLength(3);
      expect(result.data.strategy.concurrency).toBe(8);
      expect(result.data.judge?.betaJudge).toBe(true);
    }
  });

  it("rejects config missing 'purpose'", () => {
    const invalid = { ...minimalRedTeam() } as Record<string, unknown>;
    delete invalid.purpose;
    const result = validateRedTeamConfig(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
      const errors = result.error.details?.errors as string[];
      expect(errors.some((e) => e.includes("purpose"))).toBe(true);
    }
  });

  it("rejects config with missing plugins array", () => {
    const invalid = { ...minimalRedTeam() } as Record<string, unknown>;
    delete invalid.plugins;
    const result = validateRedTeamConfig(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(errors.some((e) => e.includes("plugins"))).toBe(true);
    }
  });

  it("rejects empty plugins array", () => {
    const result = validateRedTeamConfig(minimalRedTeam({ plugins: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(
        errors.some((e) => e.toLowerCase().includes("at least one")),
      ).toBe(true);
    }
  });

  it("rejects numTests > 50", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [{ id: "prompt-injection", numTests: 51 }],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(
        errors.some((e) => e.includes("plugins[0].numTests")),
      ).toBe(true);
    }
  });

  it("rejects numTests < 1", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [{ id: "prompt-injection", numTests: 0 }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects policy plugin without config.policy", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [{ id: "policy", numTests: 3 }],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(
        errors.some(
          (e) =>
            e.includes("plugins[0].config.policy") &&
            e.toLowerCase().includes("policy"),
        ),
      ).toBe(true);
    }
  });

  it("rejects policy plugin with empty config.policy string", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [
          { id: "policy", numTests: 3, config: { policy: "   " } },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(
        errors.some((e) => e.includes("plugins[0].config.policy")),
      ).toBe(true);
    }
  });

  it("accepts policy plugin with non-empty config.policy", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [
          {
            id: "policy",
            numTests: 3,
            config: { policy: "Never give legal advice." },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects strategy.concurrency > 16", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        strategy: { concurrency: 17 },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.details?.errors as string[];
      expect(
        errors.some((e) => e.includes("strategy.concurrency")),
      ).toBe(true);
    }
  });

  it("rejects strategy.concurrency < 1", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        strategy: { concurrency: 0 },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid severity enum value", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        plugins: [{ id: "prompt-injection", severity: "extreme" }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects gates.minOverallPassRate outside 0..1", () => {
    const result = validateRedTeamConfig(
      minimalRedTeam({
        gates: { minOverallPassRate: 1.5 },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("schema parses identically via direct safeParse and helper", () => {
    const input = minimalRedTeam();
    const viaHelper = validateRedTeamConfig(input);
    const viaDirect = RedTeamConfigSchema.safeParse(input);
    expect(viaHelper.success).toBe(true);
    expect(viaDirect.success).toBe(true);
  });
});
