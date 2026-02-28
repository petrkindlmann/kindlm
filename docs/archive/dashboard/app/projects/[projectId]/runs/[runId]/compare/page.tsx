"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import type { ComparisonData } from "@/lib/api";
import { fetcher } from "@/lib/api";
import ComparisonView from "@/components/ComparisonView";
import EmptyState from "@/components/EmptyState";

export default function ComparePage() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();

  const { data, isLoading, error } = useSWR<ComparisonData>(
    `/v1/runs/${runId}/compare`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
      </div>
    );
  }

  if (error?.status === 404) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Baseline Comparison
        </h1>
        <EmptyState
          title="No baseline available"
          description="Set a baseline with `kindlm baseline set` before comparing runs."
          actionLabel="Back to run"
          actionHref={`/projects/${projectId}/runs/${runId}`}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
        Failed to load comparison data. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Baseline Comparison
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Comparing run against active baseline
        </p>
      </div>

      {data && <ComparisonView data={data} />}
    </div>
  );
}
