import { describe, it, expect } from "vitest";
import {
  createRedTeamPluginRegistry,
  resolveSeverity,
  BUILTIN_PLUGIN_IDS,
  type RedTeamPluginConfigInput,
} from "./registry.js";
import { createPromptInjectionPlugin } from "./owasp/prompt-injection.js";
import { createPiiDisclosurePlugin } from "./owasp/pii-disclosure.js";
import { createImproperOutputHandlingPlugin } from "./owasp/improper-output-handling.js";
import { createExcessiveAgencyPlugin } from "./owasp/excessive-agency.js";
import { createSystemPromptLeakagePlugin } from "./owasp/system-prompt-leakage.js";
import { createMisinformationPlugin } from "./owasp/misinformation.js";
import { createUnboundedConsumptionPlugin } from "./owasp/unbounded-consumption.js";
import { createHarmfulContentPlugin } from "./owasp/harmful-content.js";
import { createPolicyPlugin } from "./policy.js";
import type { RedTeamPluginContext, RedTeamCategory, Severity } from "../types.js";

// ------------------------------------------------------------
// Test fixtures
// ------------------------------------------------------------

function makeContext(): RedTeamPluginContext {
  // `grade` stubs (still returning INTERNAL_ERROR until S03) never look
  // at any of these fields. We still supply a realistic shape so the
  // cast stays honest against the interface. Runtime `generate()`
  // behavior is covered in generation/generate.test.ts with a mock
  // adapter, so no adapter is needed here.
  return {
    purpose: "Test purpose",
    targetModel: "gpt-4o",
    // @ts-expect-error — adapters are not exercised by the grade stubs
    targetAdapter: undefined,
    numTests: 5,
    severity: "high",
  };
}

interface StubExpectation {
  id: string;
  category: RedTeamCategory;
  severity: Severity;
}

const OWASP_STUBS: Array<{
  factory: () => ReturnType<typeof createPromptInjectionPlugin>;
  expected: StubExpectation;
}> = [
  {
    factory: createPromptInjectionPlugin,
    expected: {
      id: "prompt-injection",
      category: "LLM01",
      severity: "critical",
    },
  },
  {
    factory: createPiiDisclosurePlugin,
    expected: { id: "pii-disclosure", category: "LLM02", severity: "high" },
  },
  {
    factory: createImproperOutputHandlingPlugin,
    expected: {
      id: "improper-output-handling",
      category: "LLM05",
      severity: "high",
    },
  },
  {
    factory: createExcessiveAgencyPlugin,
    expected: { id: "excessive-agency", category: "LLM06", severity: "high" },
  },
  {
    factory: createSystemPromptLeakagePlugin,
    expected: {
      id: "system-prompt-leakage",
      category: "LLM07",
      severity: "medium",
    },
  },
  {
    factory: createMisinformationPlugin,
    expected: { id: "misinformation", category: "LLM09", severity: "medium" },
  },
  {
    factory: createUnboundedConsumptionPlugin,
    expected: {
      id: "unbounded-consumption",
      category: "LLM10",
      severity: "medium",
    },
  },
  {
    factory: createHarmfulContentPlugin,
    expected: {
      id: "harmful-content",
      category: "HARMFUL_CONTENT",
      severity: "high",
    },
  },
];

// ------------------------------------------------------------
// (a) / (b) — Stub shape and INTERNAL_ERROR wiring
// ------------------------------------------------------------

describe("OWASP plugin stubs", () => {
  for (const { factory, expected } of OWASP_STUBS) {
    describe(`${expected.id}`, () => {
      it("instantiates with the correct id/category/severity", () => {
        const plugin = factory();
        expect(plugin.id).toBe(expected.id);
        expect(plugin.category).toBe(expected.category);
        expect(plugin.defaultSeverity).toBe(expected.severity);
        expect(plugin.description.length).toBeGreaterThan(0);
      });

      it("exposes a function-valued generate (runtime behavior is covered by generation/generate.test.ts)", () => {
        const plugin = factory();
        expect(typeof plugin.generate).toBe("function");
      });

      it("grade returns INTERNAL_ERROR with an 'S03' message", async () => {
        const plugin = factory();
        const result = await plugin.grade(
          {
            pluginId: plugin.id,
            category: plugin.category,
            severity: plugin.defaultSeverity,
            label: "fixture",
            userPrompt: "fixture",
          },
          "fixture-response",
          makeContext(),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("INTERNAL_ERROR");
          expect(result.error.message).toMatch(/not implemented.*S03/i);
        }
      });
    });
  }
});

// ------------------------------------------------------------
// Policy plugin stub
// ------------------------------------------------------------

describe("createPolicyPlugin", () => {
  it("builds a plugin with id='policy' and CUSTOM_POLICY category", () => {
    const plugin = createPolicyPlugin({ policy: "Never recommend competitors." });
    expect(plugin.id).toBe("policy");
    expect(plugin.category).toBe("CUSTOM_POLICY");
    expect(plugin.defaultSeverity).toBe("high");
  });

  it("preserves the policy text in the description", () => {
    const plugin = createPolicyPlugin({
      policy: "Never discuss pricing outside the pricing page.",
    });
    expect(plugin.description).toContain(
      "Never discuss pricing outside the pricing page.",
    );
  });

  it("exposes a function-valued generate and a stubbed grade", async () => {
    const plugin = createPolicyPlugin({ policy: "Dummy policy" });
    expect(typeof plugin.generate).toBe("function");
    const grade = await plugin.grade(
      {
        pluginId: "policy",
        category: "CUSTOM_POLICY",
        severity: "high",
        label: "fixture",
        userPrompt: "fixture",
      },
      "response",
      makeContext(),
    );
    expect(grade.success).toBe(false);
    if (!grade.success) {
      expect(grade.error.code).toBe("INTERNAL_ERROR");
      expect(grade.error.message).toMatch(/not implemented.*S03/i);
    }
  });
});

// ------------------------------------------------------------
// (c) / (d) — Registry full-config + multi-policy keying
// ------------------------------------------------------------

describe("createRedTeamPluginRegistry", () => {
  it("builds all eight OWASP stubs given a full config", () => {
    const configs: RedTeamPluginConfigInput[] = OWASP_STUBS.map(
      ({ expected }) => ({ id: expected.id }),
    );

    const result = createRedTeamPluginRegistry(configs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.size).toBe(OWASP_STUBS.length);

    for (const [index, { expected }] of OWASP_STUBS.entries()) {
      const key = `${expected.id}#${index}`;
      const plugin = result.data.get(key);
      expect(plugin, `missing plugin at key ${key}`).toBeDefined();
      expect(plugin?.id).toBe(expected.id);
      expect(plugin?.category).toBe(expected.category);
      expect(plugin?.defaultSeverity).toBe(expected.severity);
    }
  });

  it("keys multiple policy entries with distinct policy#0, policy#1", () => {
    const configs: RedTeamPluginConfigInput[] = [
      { id: "policy", config: { policy: "Never recommend competitors." } },
      { id: "policy", config: { policy: "Never reveal internal tools." } },
    ];
    const result = createRedTeamPluginRegistry(configs);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.size).toBe(2);

    const first = result.data.get("policy#0");
    const second = result.data.get("policy#1");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
    expect(first?.description).toContain("Never recommend competitors.");
    expect(second?.description).toContain("Never reveal internal tools.");
  });

  // (e) — Unknown plugin id returns a suggestion via Levenshtein
  it("returns CONFIG_VALIDATION_ERROR with a 'did you mean' hint for close typos", () => {
    // One-character typo on a real id — well within suggestClosest's
    // max(2, 0.4 * len) threshold.
    const result = createRedTeamPluginRegistry([{ id: "prompt-injecton" }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
    const errors = result.error.details?.errors as string[] | undefined;
    expect(errors).toBeDefined();
    expect(errors!.length).toBe(1);
    expect(errors![0]).toContain("plugins[0].id");
    expect(errors![0]).toContain("Unknown red team plugin");
    expect(errors![0]).toContain('"prompt-injecton"');
    expect(errors![0]).toContain('Did you mean: "prompt-injection"');
  });

  it("falls back to a 'Known plugins' list when no close match exists", () => {
    const result = createRedTeamPluginRegistry([{ id: "totally-unrelated-xyz" }]);
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = result.error.details?.errors as string[] | undefined;
    expect(errors).toBeDefined();
    expect(errors![0]).toContain("Known plugins:");
    expect(errors![0]).toContain('"prompt-injection"');
  });

  it("collects errors from every bad entry instead of stopping at the first", () => {
    // Each id has a close match (distance 1) so both should generate
    // "Did you mean" suggestions and both should appear in the output.
    const result = createRedTeamPluginRegistry([
      { id: "prompt-injecton" },
      { id: "pii-disclosre" },
    ]);
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = result.error.details?.errors as string[] | undefined;
    expect(errors).toHaveLength(2);
    expect(errors![0]).toContain("plugins[0]");
    expect(errors![0]).toContain("prompt-injection");
    expect(errors![1]).toContain("plugins[1]");
    expect(errors![1]).toContain("pii-disclosure");
  });

  // (f) — Registry-level belt-and-suspenders on policy.config.policy
  it("requires config.policy for the policy plugin at the registry level", () => {
    const missing = createRedTeamPluginRegistry([{ id: "policy" }]);
    expect(missing.success).toBe(false);
    if (missing.success) return;
    expect(missing.error.code).toBe("CONFIG_VALIDATION_ERROR");
    const errors = missing.error.details?.errors as string[] | undefined;
    expect(errors![0]).toContain("plugins[0]");
    expect(errors![0]).toMatch(/non-empty config\.policy/i);

    const empty = createRedTeamPluginRegistry([
      { id: "policy", config: { policy: "   " } },
    ]);
    expect(empty.success).toBe(false);
    if (empty.success) return;
    const emptyErrors = empty.error.details?.errors as string[] | undefined;
    expect(emptyErrors![0]).toMatch(/non-empty config\.policy/i);
  });

  it("accepts a valid policy plugin and exposes the text on description", () => {
    const result = createRedTeamPluginRegistry([
      { id: "policy", config: { policy: "Stay on topic." } },
    ]);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const plugin = result.data.get("policy#0");
    expect(plugin?.description).toContain("Stay on topic.");
  });

  it("exposes BUILTIN_PLUGIN_IDS covering every wired factory", () => {
    // Guard against forgetting to register a plugin when adding new factories.
    expect(BUILTIN_PLUGIN_IDS).toContain("prompt-injection");
    expect(BUILTIN_PLUGIN_IDS).toContain("pii-disclosure");
    expect(BUILTIN_PLUGIN_IDS).toContain("improper-output-handling");
    expect(BUILTIN_PLUGIN_IDS).toContain("excessive-agency");
    expect(BUILTIN_PLUGIN_IDS).toContain("system-prompt-leakage");
    expect(BUILTIN_PLUGIN_IDS).toContain("misinformation");
    expect(BUILTIN_PLUGIN_IDS).toContain("unbounded-consumption");
    expect(BUILTIN_PLUGIN_IDS).toContain("harmful-content");
    expect(BUILTIN_PLUGIN_IDS).toContain("policy");
    expect(BUILTIN_PLUGIN_IDS).toHaveLength(9);
  });
});

// ------------------------------------------------------------
// (g) — resolveSeverity helper
// ------------------------------------------------------------

describe("resolveSeverity", () => {
  it("prefers the user override over the plugin default", () => {
    const plugin = createPromptInjectionPlugin();
    expect(plugin.defaultSeverity).toBe("critical");
    expect(resolveSeverity(plugin, "low")).toBe("low");
  });

  it("falls back to the plugin default when no override is provided", () => {
    const plugin = createPiiDisclosurePlugin();
    expect(resolveSeverity(plugin)).toBe("high");
    expect(resolveSeverity(plugin, undefined)).toBe("high");
  });
});
