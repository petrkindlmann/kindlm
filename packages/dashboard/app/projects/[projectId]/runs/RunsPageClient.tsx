"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import type { TestRun, TrendPoint } from "@/lib/api";
import { fetcher } from "@/lib/api";
import RunTable from "@/components/RunTable";
import RunFilterBar from "@/components/RunFilterBar";
import TrendChart from "@/components/TrendChart";
import EmptyState from "@/components/EmptyState";

const PER_PAGE = 20;

function RunsContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get("page") ?? "1");
  const offset = (page - 1) * PER_PAGE;

  const branch = searchParams.get("branch") ?? undefined;
  const suite = searchParams.get("suite") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  // Build query with all active filters
  const query = new URLSearchParams({ limit: String(PER_PAGE), offset: String(offset) });
  if (branch) query.set("branch", branch);
  if (suite) query.set("suite", suite);
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const { data, isLoading, error } = useSWR<{
    runs: TestRun[];
    total: number;
  }>(
    `/v1/projects/${projectId}/runs?${query}`,
    fetcher,
  );

  const { data: trendsData } = useSWR<{ trends: TrendPoint[] }>(
    `/v1/projects/${projectId}/runs/trends`,
    fetcher,
  );

  const { data: suitesData } = useSWR<{ suites: Array<{ id: string; name: string }> }>(
    `/v1/projects/${projectId}/suites`,
    fetcher,
  );

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  const branches = [
    ...new Set(runs.map((r) => r.branch).filter((b): b is string => b !== null)),
  ];
  const suiteNames = (suitesData?.suites ?? []).map((s) => s.name);

  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

  function toggleRun(runId: string) {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/projects/${projectId}/runs?${params.toString()}`);
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
        Failed to load runs. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Run History</h1>
        <p className="mt-1 text-sm text-stone-500">
          All test runs for this project
        </p>
      </div>

      <RunFilterBar
        projectId={projectId}
        branches={branches}
        suiteNames={suiteNames}
      />

      {trendsData?.trends && trendsData.trends.length > 0 && (
        <TrendChart data={trendsData.trends} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs found"
          description="Upload your first test run with `kindlm upload` to see results here."
          actionLabel="View upload docs"
          actionHref="https://docs.kindlm.com/cli/upload"
        />
      ) : (
        <>
          {selectedRunIds.size === 2 && (
            <button
              onClick={() => {
                const ids = [...selectedRunIds];
                router.push(
                  `/projects/${projectId}/runs/compare?runA=${ids[0]}&runB=${ids[1]}`,
                );
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Compare selected ({selectedRunIds.size})
            </button>
          )}

          <RunTable
            runs={runs}
            projectId={projectId}
            selectedRunIds={selectedRunIds}
            onToggleRun={toggleRun}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-stone-200 pt-4">
              <p className="text-sm text-stone-500">
                Showing {(page - 1) * PER_PAGE + 1}--
                {Math.min(page * PER_PAGE, total)} of {total} runs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function RunsPageClient() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Run History</h1>
            <p className="mt-1 text-sm text-stone-500">
              All test runs for this project
            </p>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-stone-200"
              />
            ))}
          </div>
        </div>
      }
    >
      <RunsContent />
    </Suspense>
  );
}
