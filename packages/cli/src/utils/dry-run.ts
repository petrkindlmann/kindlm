import chalk from "chalk";
import type { TestPlan } from "@kindlm/core";

/**
 * Formats a test plan for terminal display.
 * Used by --dry-run to show what tests would execute without making API calls.
 */
export function formatTestPlan(plan: TestPlan): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`\nTest Plan: ${plan.suiteName}`));
  if (plan.suiteDescription) {
    lines.push(chalk.dim(`  ${plan.suiteDescription}`));
  }
  lines.push(chalk.dim(`  Project: ${plan.project}`));
  lines.push("");

  const activeEntries = plan.entries.filter((e) => !e.skip);
  const skippedEntries = plan.entries.filter((e) => e.skip);

  if (activeEntries.length === 0) {
    lines.push(chalk.yellow("  No tests to execute."));
  } else {
    lines.push(chalk.underline("Tests to execute:"));
    lines.push("");

    for (const entry of activeEntries) {
      const modelLabel = entry.isCommand
        ? chalk.cyan("[command]")
        : chalk.cyan(`[${entry.modelId}]`);
      const repeatLabel =
        entry.repeat > 1 ? chalk.dim(` x${entry.repeat}`) : "";
      const tagsLabel =
        entry.tags.length > 0
          ? chalk.dim(` (${entry.tags.join(", ")})`)
          : "";
      const assertionLabel = chalk.dim(
        ` -> ${entry.assertionTypes.join(", ") || "none"}`,
      );

      lines.push(
        `  ${chalk.green("\u2713")} ${entry.testName} ${modelLabel}${repeatLabel}${tagsLabel}${assertionLabel}`,
      );
    }
  }

  if (skippedEntries.length > 0) {
    lines.push("");
    lines.push(chalk.underline("Skipped:"));
    lines.push("");
    for (const entry of skippedEntries) {
      lines.push(`  ${chalk.yellow("-")} ${chalk.dim(entry.testName)}`);
    }
  }

  lines.push("");
  lines.push(chalk.dim("---"));
  lines.push(
    `  Total execution units: ${chalk.bold(String(plan.totalExecutionUnits))}`,
  );
  lines.push(`  Concurrency: ${plan.concurrency}`);
  lines.push(`  Timeout: ${plan.timeoutMs}ms`);
  lines.push("");

  return lines.join("\n");
}
