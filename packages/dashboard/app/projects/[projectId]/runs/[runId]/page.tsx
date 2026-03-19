"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import type { TestRun, TestResult } from "@/lib/api";
import { fetcher } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import ResultGrid from "@/components/ResultGrid";
import Badge from "@/components/Badge";

export default function RunDetailPage() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();

  const { data: run, isLoading: loadingRun } = useSWR<TestRun>(
    `/v1/runs/${runId}`,
    fetcher,
  );

  const { data: resultsData, isLoading: loadingResults } = useSWR<{
    results: TestResult[];
  }>(`/v1/runs/${runId}/results`, fetcher);

  const isLoading = loadingRun || loadingResults;
  const results = resultsData?.results ?? [];

  // Compute aggregate stats from results
  const totalCost = results.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
  const avgLatency =
    results.length > 0
      ? results.reduce((sum, r) => sum + (r.latencyAvgMs ?? 0), 0) /
        results.length
      : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-stone-200"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-stone-900">
              Run Detail
            </h1>
            {run && (
              <Badge
                status={
                  run.status === "running"
                    ? "running"
                    : run.passRate != null && run.passRate >= 1
                      ? "passed"
                      : "failed"
                }
              />
            )}
          </div>
          {run && (
            <div className="mt-1 flex items-center gap-4 text-sm text-stone-500">
              {run.branch && <span>Branch: {run.branch}</span>}
              {run.commitSha && (
                <span>Commit: {run.commitSha.slice(0, 7)}</span>
              )}
              {run.environment && <span>Env: {run.environment}</span>}
              <span>
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <Link
          href={`/projects/${projectId}/runs/${runId}/compare`}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Compare to baseline
        </Link>
      </div>

      {/* Metric cards */}
      {run && (
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
              run.judgeAvgScore != null
                ? run.judgeAvgScore.toFixed(2)
                : "--"
            }
          />
        </div>
      )}

      {/* Results grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-stone-900">Test Results</h2>
        <ResultGrid results={results} />
      </div>
    </div>
  );
}
