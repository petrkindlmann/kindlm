import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "prompt-injection.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
