import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM10 — Unbounded Consumption.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
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

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
