import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM02 — Sensitive Information Disclosure (PII).
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "pii-disclosure.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
