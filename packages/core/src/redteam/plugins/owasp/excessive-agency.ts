import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";
import { generateAttacksForPlugin } from "../../generation/generate.js";

/**
 * OWASP LLM06 — Excessive Agency.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` stays stubbed until S03 lands.
 */
export function createExcessiveAgencyPlugin(): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "excessive-agency",
    category: "LLM06",
    defaultSeverity: "high",
    description:
      "OWASP LLM06: tries to provoke the target into taking actions beyond its authority — unsafe tool calls, destructive writes, or out-of-scope API usage.",

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "excessive-agency.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
