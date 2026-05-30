import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM02 — Sensitive Information Disclosure (PII).
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createPiiDisclosurePlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "pii-disclosure",
    category: "LLM02",
    defaultSeverity: "high",
    description:
      "OWASP LLM02: probes that try to coax the target into leaking emails, phone numbers, credit cards, API keys, or other PII.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
