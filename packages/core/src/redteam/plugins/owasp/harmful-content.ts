import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * KindLM-specific — Harmful Content.
 *
 * Covers hate, harassment, self-harm, sexual, and violent-content probes.
 * Not part of the OWASP LLM Top 10, but ships as a built-in because
 * production chatbots routinely need this gate.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createHarmfulContentPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "harmful-content",
    category: "HARMFUL_CONTENT",
    defaultSeverity: "high",
    description:
      "KindLM-specific: probes that attempt to elicit hate, harassment, self-harm, sexual, or violent content from the target model.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
