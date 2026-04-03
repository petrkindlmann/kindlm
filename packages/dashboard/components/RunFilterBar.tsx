"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface RunFilterBarProps {
  projectId: string;
  branches: string[];
  suiteNames: string[];
}

export default function RunFilterBar({
  projectId,
  branches,
  suiteNames,
}: RunFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentBranch = searchParams.get("branch") ?? "";
  const currentSuite = searchParams.get("suite") ?? "";
  const currentDateFrom = searchParams.get("dateFrom") ?? "";
  const currentDateTo = searchParams.get("dateTo") ?? "";

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when any filter changes
      params.delete("page");
      router.push(`/projects/${projectId}/runs?${params.toString()}`);
    },
    [router, projectId, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentBranch}
        onChange={(e) => updateFilter("branch", e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
      >
        <option value="">All branches</option>
        {branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        value={currentSuite}
        onChange={(e) => updateFilter("suite", e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
      >
        <option value="">All suites</option>
        {suiteNames.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={currentDateFrom}
        onChange={(e) => updateFilter("dateFrom", e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
        placeholder="From"
      />

      <input
        type="date"
        value={currentDateTo}
        onChange={(e) => updateFilter("dateTo", e.target.value)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
        placeholder="To"
      />

      {(currentBranch || currentSuite || currentDateFrom || currentDateTo) && (
        <button
          onClick={() => router.push(`/projects/${projectId}/runs`)}
          className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:text-stone-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
