import type { RedTeamPlugin } from "./interface.js";
import { err } from "../../types/result.js";

/**
 * Custom policy plugin — `id: "policy"`, `category: "CUSTOM_POLICY"`.
 *
 * Accepts a `{ policy: string }` config bag. The policy text is preserved
 * on `description` so downstream reporters and the S02/S03 judge pipeline
 * can pick it up from a single plugin instance. Multiple policy plugins
 * in the same run are allowed — the registry keys them by index so they
 * don't collide.
 *
 * Stub for S01 — `generate`/`grade` return an `INTERNAL_ERROR` Result
 * until policy-probe synthesis lands in S02/S03.
 */
export function createPolicyPlugin(config: {
  policy: string;
}): RedTeamPlugin {
  return {
    id: "policy",
    category: "CUSTOM_POLICY",
    defaultSeverity: "high",
    description: `Custom policy: ${config.policy}`,

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "policy.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "policy.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
