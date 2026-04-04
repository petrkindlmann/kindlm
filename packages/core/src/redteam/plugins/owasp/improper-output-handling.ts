import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM05 — Improper Output Handling.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
 */
export function createImproperOutputHandlingPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "improper-output-handling",
    category: "LLM05",
    defaultSeverity: "high",
    description:
      "OWASP LLM05: attempts to make the target emit output a downstream system would mishandle — unescaped HTML, shell metacharacters, SQL fragments, or SSRF-style URLs.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "improper-output-handling.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
