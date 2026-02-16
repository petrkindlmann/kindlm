import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createComplianceReporter(): Reporter {
  return {
    name: "compliance",
    generate(_runResult: RunResult, _gateEvaluation: GateEvaluation): ReporterOutput {
      throw new Error("Not implemented");
    },
  };
}
