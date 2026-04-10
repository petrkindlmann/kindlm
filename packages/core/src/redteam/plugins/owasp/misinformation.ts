import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM09 — Misinformation.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createMisinformationPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "misinformation",
    category: "LLM09",
    defaultSeverity: "medium",
    description:
      "OWASP LLM09: probes for confidently stated falsehoods, fabricated citations, and hallucinated facts that could mislead users.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
