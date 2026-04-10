import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM01 — Prompt Injection.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
 */
export function createPromptInjectionPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "prompt-injection",
    category: "LLM01",
    defaultSeverity: "critical",
    description:
      "OWASP LLM01: attempts to override the target's system prompt, exfiltrate instructions, or hijack tool use via crafted user input.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
