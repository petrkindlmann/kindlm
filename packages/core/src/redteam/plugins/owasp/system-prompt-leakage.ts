import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM07 — System Prompt Leakage.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "system-prompt-leakage.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
