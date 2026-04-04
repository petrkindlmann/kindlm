import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * KindLM-specific — Harmful Content.
 *
 * Covers hate, harassment, self-harm, sexual, and violent-content probes.
 * Not part of the OWASP LLM Top 10, but ships as a built-in because
 * production chatbots routinely need this gate.
 *
 * Stub for S01 — real probe bank and safety classifier arrive in S02/S03.
 */
export function createHarmfulContentPlugin(): RedTeamPlugin {
  return {
    id: "harmful-content",
    category: "HARMFUL_CONTENT",
    defaultSeverity: "high",
    description:
      "KindLM-specific: probes that attempt to elicit hate, harassment, self-harm, sexual, or violent content from the target model.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "harmful-content.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "harmful-content.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
