/**
 * Format a Zod issue path array into a dotted/bracketed string.
 *
 * Example: `["tests", 2, "expect", "judge", 0, "minScore"]` →
 *          `"tests[2].expect.judge[0].minScore"`.
 *
 * Extracted to a dependency-free module so schemas living outside
 * `config/` (e.g. `redteam/schema.ts`) can re-use the same formatting
 * without pulling `config/schema.ts` into their module graph — that
 * import direction creates a value-level cycle because
 * `KindLMConfigSchema` references `RedTeamConfigSchema`.
 */
export function formatZodPath(path: (string | number)[]): string {
  return path.reduce<string>((acc, segment, i) => {
    if (typeof segment === "number") return `${acc}[${segment}]`;
    return i === 0 ? segment : `${acc}.${segment}`;
  }, "");
}
