import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM09 — Misinformation.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "misinformation.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
