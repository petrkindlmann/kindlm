import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM07 — System Prompt Leakage.
 *
 * Stub for S01 — leak-detection heuristics and probe bank land in S02/S03.
 */
export function createSystemPromptLeakagePlugin(): RedTeamPlugin {
  return {
    id: "system-prompt-leakage",
    category: "LLM07",
    defaultSeverity: "medium",
    description:
      "OWASP LLM07: attempts to make the target reveal its hidden system prompt, guardrails, or operator instructions.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "system-prompt-leakage.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "system-prompt-leakage.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
