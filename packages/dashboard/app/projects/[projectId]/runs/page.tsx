"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import type { TestRun } from "@/lib/api";
import { fetcher } from "@/lib/api";
import RunTable from "@/components/RunTable";
import EmptyState from "@/components/EmptyState";

const PER_PAGE = 20;

export default function RunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get("page") ?? "1");
  const offset = (page - 1) * PER_PAGE;

  const { data, isLoading, error } = useSWR<{
    runs: TestRun[];
    total: number;
  }>(
    `/v1/projects/${projectId}/runs?limit=${PER_PAGE}&offset=${offset}`,
    fetcher,
  );

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PER_PAGE);

  function goToPage(p: number) {
    router.push(`/projects/${projectId}/runs?page=${p}`);
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
          <RunTable runs={runs} projectId={projectId} />

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
