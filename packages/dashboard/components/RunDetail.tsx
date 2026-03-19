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
  const totalCost = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const avgLatency =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r.latencyAvgMs ?? 0), 0) /
        results.length
      : 0;

  return (
    <div className="space-y-8">
      {/* Header info */}
      <div className="flex items-center gap-3">
        <Badge
          status={
            run.status === "running"
              ? "running"
              : run.passRate != null && run.passRate >= 1
                ? "passed"
                : "failed"
          }
        />
        <div className="flex items-center gap-4 text-sm text-stone-500">
          {run.branch && (
            <span>
              Branch:{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                {run.branch}
              </code>
            </span>
          )}
          {run.commitSha && (
            <span>
              Commit:{" "}
              <code className="text-xs text-stone-600">
                {run.commitSha.slice(0, 7)}
              </code>
            </span>
          )}
          <span>{new Date(run.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Pass Rate"
          value={
            run.passRate != null
              ? `${Math.round(run.passRate * 100)}%`
              : "--"
          }
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
          label="Judge Avg Score"
          value={
            run.judgeAvgScore != null ? run.judgeAvgScore.toFixed(2) : "--"
          }
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
