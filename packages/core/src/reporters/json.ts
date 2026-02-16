import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createJsonReporter(): Reporter {
  return {
    name: "json",
    generate(_runResult: RunResult, _gateEvaluation: GateEvaluation): ReporterOutput {
      throw new Error("Not implemented");
    },
  };
}
