"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import type { Project, TestRun } from "@/lib/api";
import { fetcher } from "@/lib/api";
import MetricCard from "@/components/MetricCard";
import RunTable from "@/components/RunTable";
import EmptyState from "@/components/EmptyState";

export default function ProjectPageClient() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project, isLoading: loadingProject } = useSWR<Project>(
    `/v1/projects/${projectId}`,
    fetcher,
  );

  const { data: runsData, isLoading: loadingRuns } = useSWR<{
    runs: TestRun[];
    total: number;
  }>(`/v1/projects/${projectId}/runs?limit=5`, fetcher);

  const isLoading = loadingProject || loadingRuns;
  const runs = runsData?.runs ?? [];
  const latestRun = runs[0] ?? null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-stone-200"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          {project?.name ?? "Project"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Project overview and recent activity
        </p>
      </div>

      {/* Metric cards from latest run */}
      {latestRun ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Pass Rate"
              value={
                latestRun.passRate != null
                  ? `${Math.round(latestRun.passRate * 100)}%`
                  : "--"
              }
            />
            <MetricCard
              label="Tests"
              value={String(latestRun.testCount)}
            />
            <MetricCard
              label="Status"
              value={latestRun.status}
            />
            <MetricCard
              label="Avg Latency"
              value={
                latestRun.latencyAvgMs != null
                  ? latestRun.latencyAvgMs < 1000
                    ? `${Math.round(latestRun.latencyAvgMs)}ms`
                    : `${(latestRun.latencyAvgMs / 1000).toFixed(1)}s`
                  : "--"
              }
            />
          </div>

          {/* Recent runs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-stone-900">
                Recent Runs
              </h2>
              <Link
                href={`/projects/${projectId}/runs`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                View all
              </Link>
            </div>

            <RunTable runs={runs} projectId={projectId} />
          </div>
        </>
      ) : (
        <EmptyState
          title="No test runs yet"
          description="Run your first test suite with the CLI to see results here."
          actionLabel="View CLI docs"
          actionHref="https://docs.kindlm.com/cli/getting-started"
        />
      )}
    </div>
  );
}
