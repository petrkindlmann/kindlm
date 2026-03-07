"use client";

import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import type { Baseline } from "@/lib/api";
import { fetcher, apiClient } from "@/lib/api";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

export default function BaselinesPage() {
  const { projectId, suiteId } = useParams<{
    projectId: string;
    suiteId: string;
  }>();

  const key = `/v1/suites/${suiteId}/baselines`;
  const { data, isLoading, error } = useSWR<{ data: Baseline[] }>(
    key,
    fetcher,
  );

  const baselines = data?.data ?? [];

  async function activateBaseline(baselineId: string) {
    await apiClient(`/v1/suites/${suiteId}/baselines/${baselineId}/activate`, {
      method: "POST",
    });
    mutate(key);
  }

  async function deleteBaseline(baselineId: string) {
    if (!confirm("Delete this baseline? This cannot be undone.")) return;

    await apiClient(`/v1/suites/${suiteId}/baselines/${baselineId}`, {
      method: "DELETE",
    });
    mutate(key);
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
        Failed to load baselines. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Baselines</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage stored baselines for this suite
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : baselines.length === 0 ? (
        <EmptyState
          title="No baselines"
          description="Create a baseline with `kindlm baseline set` from the CLI."
          actionLabel="Back to project"
          actionHref={`/projects/${projectId}`}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="px-4 py-3 font-medium text-stone-600">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-stone-600">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {baselines.map((baseline) => (
                <tr key={baseline.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {baseline.name}
                  </td>
                  <td className="px-4 py-3">
                    {baseline.active ? (
                      <Badge status="passed" label="Active" />
                    ) : (
                      <span className="text-stone-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(baseline.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!baseline.active && (
                        <button
                          onClick={() => activateBaseline(baseline.id)}
                          className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => deleteBaseline(baseline.id)}
                        className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
