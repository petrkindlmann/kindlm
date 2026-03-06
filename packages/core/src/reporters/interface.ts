import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export interface ReporterOutput {
  content: string;
  format: "text" | "json" | "xml" | "markdown";
}

export interface Reporter {
  readonly name: string;
  generate(runResult: RunResult, gateEvaluation: GateEvaluation): ReporterOutput;
}

export interface Colorize {
  bold: (text: string) => string;
  red: (text: string) => string;
  green: (text: string) => string;
  yellow: (text: string) => string;
  cyan: (text: string) => string;
  dim: (text: string) => string;
  greenBold: (text: string) => string;
  redBold: (text: string) => string;
}

const identity = (t: string): string => t;

export const noColor: Colorize = {
  bold: identity,
  red: identity,
  green: identity,
  yellow: identity,
  cyan: identity,
  dim: identity,
  greenBold: identity,
  redBold: identity,
};
