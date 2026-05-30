import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM06 — Excessive Agency.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createExcessiveAgencyPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "excessive-agency",
    category: "LLM06",
    defaultSeverity: "high",
    description:
      "OWASP LLM06: tries to provoke the target into taking actions beyond its authority — unsafe tool calls, destructive writes, or out-of-scope API usage.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
