/* eslint-disable no-console */
import chalk from "chalk";
import {
  createPrettyReporter,
  createJsonReporter,
  createJunitReporter,
} from "@kindlm/core";
import type { Colorize, Reporter } from "@kindlm/core";

const chalkColorize: Colorize = {
  bold: (t) => chalk.bold(t),
  red: (t) => chalk.red(t),
  green: (t) => chalk.green(t),
  yellow: (t) => chalk.yellow(t),
  cyan: (t) => chalk.cyan(t),
  dim: (t) => chalk.dim(t),
  greenBold: (t) => chalk.green.bold(t),
  redBold: (t) => chalk.red.bold(t),
};

const KNOWN_REPORTERS = ["pretty", "json", "junit"] as const;

export function selectReporter(type: string): Reporter {
  switch (type) {
    case "json":
      return createJsonReporter();
    case "junit":
      return createJunitReporter();
    case "pretty":
      return createPrettyReporter(chalkColorize);
    default:
      console.error(chalk.red(`Unknown reporter: '${type}'. Available: ${KNOWN_REPORTERS.join(", ")}`));
      process.exit(1);
  }
}
