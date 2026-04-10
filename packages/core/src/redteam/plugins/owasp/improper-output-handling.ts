import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM05 — Improper Output Handling.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
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

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
