// Inputs read from action.yml via core.getInput()
export type ActionInputs = {
  config: string;
  version: string;
  reporter: string;
  args: string;
  cloudToken: string;
  comment: boolean;
};

// Shape of the JSON reporter output from @kindlm/core json reporter.
// ACTION-08: Only use summary and test name/status fields — never response_text.
export type KindlmJsonReport = {
  kindlm: {
    version: string;
    timestamp: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
    durationMs: number;
  };
  gates: {
    passed: boolean;
    results: Array<{
      name: string;
      passed: boolean;
      actual: number;
      threshold: number;
    }>;
  };
  suites: Array<{
    name: string;
    status: "passed" | "failed" | "errored" | "skipped";
    tests: Array<{
      name: string;
      status: "passed" | "failed" | "errored" | "skipped";
      assertions: Array<{
        passed: boolean;
        label: string;
        assertionType: string;
        score: number;
        failureMessage?: string;
        turnLabel?: string;
      }>;
      latencyMs?: number;
      costUsd?: number;
    }>;
  }>;
};

// Outputs set via core.setOutput()
export type ActionOutputs = {
  passRate: string;
  total: string;
  passed: string;
  failed: string;
  exitCode: string;
};
