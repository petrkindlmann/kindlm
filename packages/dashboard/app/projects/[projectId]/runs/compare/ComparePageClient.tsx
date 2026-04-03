"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import type { RunComparisonData, ComparisonData } from "@/lib/api";
import { fetcher } from "@/lib/api";
import ComparisonView from "@/components/ComparisonView";

function CompareContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const runA = searchParams.get("runA");
  const runB = searchParams.get("runB");

  const shouldFetch = runA && runB;
  const { data, isLoading, error } = useSWR<RunComparisonData>(
    shouldFetch ? `/v1/compare/${runA}/compare/${runB}` : null,
    fetcher,
  );

  if (!runA || !runB) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Run Comparison
        </h1>
        <p className="text-sm text-stone-500">
          Select two runs from the run history to compare.
        </p>
        <Link
          href={`/projects/${projectId}/runs`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Back to runs
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
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

  if (!data) return null;

  const comparisonData: ComparisonData = {
    hasBaseline: true,
    summary: data.summary,
    diffs: data.diffs,
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}/runs`}
            className="text-sm text-stone-400 hover:text-stone-600"
          >
            Runs
          </Link>
          <span className="text-stone-300">/</span>
          <h1 className="text-2xl font-semibold text-stone-900">
            Run Comparison
          </h1>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Comparing run{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            {runA.slice(0, 8)}
          </code>{" "}
          vs{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            {runB.slice(0, 8)}
          </code>
        </p>
      </div>
      <ComparisonView data={comparisonData} />
    </div>
  );
}

export default function ComparePageClient() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
          <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
