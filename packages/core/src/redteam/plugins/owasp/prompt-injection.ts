import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM01 — Prompt Injection.
 *
 * Stub for S01. Attack generation and grading land in S02/S03; the
 * methods intentionally return an `INTERNAL_ERROR` Result so the engine
 * can surface a clean "not wired up yet" message instead of throwing.
 */
export function createPromptInjectionPlugin(): RedTeamPlugin {
  return {
    id: "prompt-injection",
    category: "LLM01",
    defaultSeverity: "critical",
    description:
      "OWASP LLM01: attempts to override the target's system prompt, exfiltrate instructions, or hijack tool use via crafted user input.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "prompt-injection.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "prompt-injection.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
