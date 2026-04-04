import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM10 — Unbounded Consumption.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
 */
export function createUnboundedConsumptionPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "unbounded-consumption",
    category: "LLM10",
    defaultSeverity: "medium",
    description:
      "OWASP LLM10: attempts to drive the target into runaway token generation, expensive tool loops, or cost blowouts.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "unbounded-consumption.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
