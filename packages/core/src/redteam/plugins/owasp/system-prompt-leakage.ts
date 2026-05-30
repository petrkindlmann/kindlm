import type { RedTeamPlugin } from "../interface.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";
import { gradeAttackResponse } from "../../grading/grade.js";

/**
 * OWASP LLM07 — System Prompt Leakage.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createSystemPromptLeakagePlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "system-prompt-leakage",
    category: "LLM07",
    defaultSeverity: "medium",
    description:
      "OWASP LLM07: attempts to make the target reveal its hidden system prompt, guardrails, or operator instructions.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
