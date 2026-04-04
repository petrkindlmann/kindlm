import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * KindLM-specific — Harmful Content.
 *
 * Covers hate, harassment, self-harm, sexual, and violent-content probes.
 * Not part of the OWASP LLM Top 10, but ships as a built-in because
 * production chatbots routinely need this gate.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "harmful-content.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
