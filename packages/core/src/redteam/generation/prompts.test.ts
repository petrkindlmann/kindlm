import { describe, expect, it } from "vitest";
import type { RedTeamPluginContext } from "../types.js";
import type { ProviderAdapter } from "../../providers/interface.js";
import { BUILTIN_PLUGIN_IDS } from "../plugins/registry.js";
import {
  buildAttackSystemPrompt,
  buildAttackUserPrompt,
} from "./prompts.js";

// A no-op stub adapter — the prompt builders never touch it, but the
// context type requires one so we satisfy TypeScript without spinning
// up a real provider.
const stubAdapter: ProviderAdapter = {
  name: "stub",
  async initialize() {
    /* no-op */
  },
  async complete() {
    throw new Error("stub adapter should not be called from prompt tests");
  },
  estimateCost() {
    return null;
  },
  supportsTools() {
    return false;
  },
};

function makeContext(
  overrides: Partial<RedTeamPluginContext> = {},
): RedTeamPluginContext {
  return {
    purpose: "Customer-support chatbot for a SaaS company.",
    targetModel: "gpt-4o-mini",
    targetPrompt: "You are a helpful support agent.",
    targetAdapter: stubAdapter,
    judgeAdapter: undefined,
    judgeModel: undefined,
    betaJudge: false,
    pluginConfig: undefined,
    numTests: 5,
    severity: "high",
    ...overrides,
  };
}

describe("buildAttackSystemPrompt", () => {
  // One assertion per built-in plugin id ensures the switch covers
  // every plugin the registry knows how to instantiate.
  it.each(BUILTIN_PLUGIN_IDS.map((id) => [id]))(
    "returns a non-empty system prompt for plugin id %s",
    (pluginId) => {
      const prompt = buildAttackSystemPrompt(pluginId);
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(100);
      // Every prompt must instruct the model to emit a JSON array of
      // the exact draft shape — otherwise the parser will always fail.
      expect(prompt).toContain("JSON array");
      expect(prompt).toContain('"label"');
      expect(prompt).toContain('"prompt"');
    },
  );

  it("returns distinct prompts for every plugin id (no accidental sharing)", () => {
    const seen = new Set<string>();
    for (const id of BUILTIN_PLUGIN_IDS) {
      const prompt = buildAttackSystemPrompt(id);
      expect(seen.has(prompt)).toBe(false);
      seen.add(prompt);
    }
  });

  it("throws on an unknown plugin id", () => {
    expect(() => buildAttackSystemPrompt("does-not-exist")).toThrow(
      /unknown plugin id/,
    );
  });

  it("surfaces OWASP LLM01 framing for prompt-injection", () => {
    expect(buildAttackSystemPrompt("prompt-injection")).toContain("LLM01");
  });

  it("surfaces OWASP LLM02 framing for pii-disclosure", () => {
    expect(buildAttackSystemPrompt("pii-disclosure")).toContain("LLM02");
  });
});

describe("buildAttackUserPrompt", () => {
  it("includes the stated purpose and numTests verbatim", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({
        purpose: "Pizza-ordering assistant.",
        numTests: 7,
      }),
    );
    expect(prompt).toContain("Pizza-ordering assistant.");
    expect(prompt).toContain("7");
  });

  it("includes the target production prompt when set", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({
        targetPrompt: "You are PizzaBot. Only talk about pizza.",
      }),
    );
    expect(prompt).toContain("You are PizzaBot. Only talk about pizza.");
    expect(prompt).toContain("system prompt");
  });

  it("omits the target-prompt section when targetPrompt is unset", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({ targetPrompt: undefined }),
    );
    expect(prompt.toLowerCase()).not.toContain("target system prompt");
  });

  it("omits the target-prompt section when targetPrompt is only whitespace", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({ targetPrompt: "   " }),
    );
    expect(prompt.toLowerCase()).not.toContain("target system prompt");
  });

  it("injects the policy text for the policy plugin when pluginConfig.policy is set", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({
        pluginConfig: { policy: "Never recommend competitor products." },
      }),
    );
    expect(prompt).toContain("Never recommend competitor products.");
    expect(prompt.toLowerCase()).toContain("policy");
  });

  it("omits the policy section when pluginConfig is undefined", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({ pluginConfig: undefined }),
    );
    expect(prompt).not.toContain("Policy to violate");
  });

  it("omits the policy section when pluginConfig.policy is an empty string", () => {
    const prompt = buildAttackUserPrompt(
      makeContext({ pluginConfig: { policy: "" } }),
    );
    expect(prompt).not.toContain("Policy to violate");
  });

  it("surfaces numTests: 50 when the boundary value is requested", () => {
    const prompt = buildAttackUserPrompt(makeContext({ numTests: 50 }));
    expect(prompt).toContain("50");
  });

  it("surfaces numTests: 1 for the single-attack boundary", () => {
    const prompt = buildAttackUserPrompt(makeContext({ numTests: 1 }));
    expect(prompt).toContain("1");
  });
});
