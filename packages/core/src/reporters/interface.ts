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
