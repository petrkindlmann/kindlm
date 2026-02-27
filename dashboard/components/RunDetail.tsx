"use client";

import type { TestRun, TestResult } from "@/lib/api";
import MetricCard from "./MetricCard";
import ResultGrid from "./ResultGrid";
import Badge from "./Badge";

interface RunDetailProps {
  run: TestRun;
  results: TestResult[];
}

export default function RunDetail({ run, results }: RunDetailProps) {
  const judgeScores = results
    .flatMap((r) =>
      r.assertions.filter((a) => a.type === "judge" && a.score != null),
    )
    .map((a) => a.score as number);
  const avgJudge =
    judgeScores.length > 0
      ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
      : null;

  const totalCost = results.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  const avgLatency =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) /
        results.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Header info */}
      <div className="flex items-center gap-3">
        <Badge
          status={
            run.failed === 0 ? "passed" : run.passed === 0 ? "failed" : "failed"
          }
        />
        <div className="flex items-center gap-4 text-sm text-stone-500">
          {run.git_branch && (
            <span>
              Branch:{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                {run.git_branch}
              </code>
            </span>
          )}
          {run.git_commit && (
            <span>
              Commit:{" "}
              <code className="text-xs text-stone-600">
                {run.git_commit.slice(0, 7)}
              </code>
            </span>
          )}
          <span>{new Date(run.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pass Rate"
          value={`${Math.round(run.pass_rate * 100)}%`}
        />
        <MetricCard
          label="Total Cost"
          value={totalCost > 0 ? `$${totalCost.toFixed(4)}` : "--"}
        />
        <MetricCard
          label="Avg Latency"
          value={
            avgLatency > 0
              ? avgLatency < 1000
                ? `${Math.round(avgLatency)}ms`
                : `${(avgLatency / 1000).toFixed(1)}s`
              : "--"
          }
        />
        <MetricCard
          label="Avg Judge Score"
          value={avgJudge != null ? avgJudge.toFixed(2) : "--"}
        />
      </div>

      {/* Results */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-stone-900">Test Results</h2>
        <ResultGrid results={results} />
      </div>
    </div>
  );
}
