import type { RedTeamPlugin } from "./interface.js";
import { generateAttacksForPlugin } from "../generation/generate.js";
import { gradeAttackResponse } from "../grading/grade.js";

/**
 * Custom policy plugin — `id: "policy"`, `category: "CUSTOM_POLICY"`.
 *
 * Accepts a `{ policy: string }` config bag. The policy text is preserved
 * on `description` so downstream reporters and the judge pipeline can
 * pick it up from a single plugin instance. Multiple policy plugins in
 * the same run are allowed — the registry keys them by index so they
 * don't collide.
 *
 * The attacker-author prompt for this plugin also reads the policy text
 * out of `context.pluginConfig.policy` at generation time, so the
 * description string and the effective probe are always in lock-step.
 *
 * `generate` delegates to the shared `generateAttacksForPlugin` so every
 * plugin uses the same adapter selection, retry policy, parse handling,
 * and error mapping. `grade` delegates to the shared LLM-as-judge.
 */
export function createPolicyPlugin(config: {
  policy: string;
}): RedTeamPlugin {
  const plugin: RedTeamPlugin = {
    id: "policy",
    category: "CUSTOM_POLICY",
    defaultSeverity: "high",
    description: `Custom policy: ${config.policy}`,

    async generate(context) {
      return generateAttacksForPlugin(plugin, context);
    },

    async grade(attack, outputText, context) {
      return gradeAttackResponse(plugin, attack, outputText, context);
    },
  };
  return plugin;
}
