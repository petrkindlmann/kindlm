import type { RedTeamPlugin } from "./interface.js";
import { err } from "../../types/result.js";
import { generateAttacksForPlugin } from "../generation/generate.js";

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
 * and error mapping. `grade` stays stubbed until S03 lands.
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

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "policy.grade is not implemented — added in S03.",
      });
    },
  };
  return plugin;
}
