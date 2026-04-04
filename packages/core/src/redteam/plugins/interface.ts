import type { Result, KindlmError } from "../../types/result.js";
import type {
  Attack,
  AttackVerdict,
  RedTeamCategory,
  RedTeamPluginContext,
  Severity,
} from "../types.js";

/**
 * A red team plugin generates attack probes for a single category and
 * grades the target model's responses.
 *
 * Plugins are plain values returned by factory functions (see
 * {@link RedTeamPluginFactory}) — KindLM never uses class inheritance for
 * plugins so the surface is explicit and trivially mockable in tests.
 */
export interface RedTeamPlugin {
  /** Stable plugin identifier used in YAML config (e.g. "prompt-injection"). */
  readonly id: string;
  /** Category this plugin attacks. */
  readonly category: RedTeamCategory;
  /** Default severity when the user does not override it. */
  readonly defaultSeverity: Severity;
  /** Human-readable description for reports and CLI help. */
  readonly description: string;

  /**
   * Produce a list of concrete attacks to run against the target.
   *
   * Implementations may call `context.targetAdapter` or an internal attacker
   * model via `context.judgeAdapter` — the engine supplies adapters so core
   * stays free of real I/O.
   */
  generate(
    context: RedTeamPluginContext,
  ): Promise<Result<Attack[], KindlmError>>;

  /**
   * Grade a single attack by comparing the target's response against the
   * plugin's expected resistance behavior.
   */
  grade(
    attack: Attack,
    outputText: string,
    context: RedTeamPluginContext,
  ): Promise<Result<AttackVerdict, KindlmError>>;
}

/**
 * Factory signature for every built-in and user-provided red team plugin.
 *
 * Plugins take an optional, already-validated config bag and return a
 * {@link RedTeamPlugin} instance. Validation of the config shape itself
 * happens at the Zod layer (see `schema.ts`) plus a belt-and-suspenders
 * check inside the registry.
 */
export type RedTeamPluginFactory = (
  config?: Record<string, unknown>,
) => RedTeamPlugin;
