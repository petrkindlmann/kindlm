"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import type { ComplianceReport } from "@/lib/api";
import { fetcher } from "@/lib/api";

export default function ComplianceClient() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();

  const { data, isLoading, error } = useSWR<ComplianceReport>(
    `/v1/runs/${runId}/compliance`,
    fetcher,
  );

  function handleDownload() {
    if (!data?.complianceReport) return;

    const blob = new Blob([data.complianceReport], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-report-${runId}.md`;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="space-y-6">
        <div>
          <Link
            href={`/projects/${projectId}/runs/${runId}`}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            &larr; Back to run
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">
            Compliance Report
          </h1>
        </div>
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load compliance report. Please try again.
        </div>
      </div>
    );
  }

  if (!data?.complianceReport) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/projects/${projectId}/runs/${runId}`}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            &larr; Back to run
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">
            Compliance Report
          </h1>
        </div>
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-stone-200 bg-white px-6 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
            <svg
              className="h-6 w-6 text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-stone-900">
            No compliance report generated
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-stone-500">
            This run was not executed with the{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
              --compliance
            </code>{" "}
            flag. Re-run with{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
              kindlm test --compliance
            </code>{" "}
            to generate an EU AI Act Annex IV report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/projects/${projectId}/runs/${runId}`}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            &larr; Back to run
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-stone-900">
            Compliance Report
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            EU AI Act Annex IV documentation for run{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
              {runId.slice(0, 8)}
            </code>
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Download as Markdown
        </button>
      </div>

      {/* Hashes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Content Hash (SHA-256)
          </p>
          <code className="mt-1 block break-all text-sm text-stone-700">
            {data.complianceHash}
          </code>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Run ID
          </p>
          <code className="mt-1 block break-all text-sm text-stone-700">
            {runId}
          </code>
        </div>
      </div>

      {/* Report content */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 lg:p-8">
        <div className="prose prose-stone max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {data.complianceReport}
        </div>
      </div>
    </div>
  );
}
