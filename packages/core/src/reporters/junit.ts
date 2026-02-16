import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createJunitReporter(): Reporter {
  return {
    name: "junit",
    generate(_runResult: RunResult, _gateEvaluation: GateEvaluation): ReporterOutput {
      throw new Error("Not implemented");
    },
  };
}
