import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM09 — Misinformation.
 *
 * Stub for S01 — hallucination / over-confidence probes and judge-based
 * grading arrive in S02/S03.
 */
export function createMisinformationPlugin(): RedTeamPlugin {
  return {
    id: "misinformation",
    category: "LLM09",
    defaultSeverity: "medium",
    description:
      "OWASP LLM09: probes for confidently stated falsehoods, fabricated citations, and hallucinated facts that could mislead users.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "misinformation.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "misinformation.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
