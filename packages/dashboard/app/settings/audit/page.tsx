"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AuditLogEntry, Organization } from "@/lib/api";
import { fetcher } from "@/lib/api";

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { label: "All actions", value: "" },
  { label: "Create", value: "create" },
  { label: "Update", value: "update" },
  { label: "Delete", value: "delete" },
  { label: "Login", value: "login" },
  { label: "Invite", value: "invite" },
];

export default function AuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Check organization plan
  const { data: org } = useSWR<Organization>("/v1/org", fetcher);
  const isEnterprise = org?.plan === "enterprise";

  // Build query string
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (actionFilter) params.set("action", actionFilter);
  if (dateFrom) params.set("since", dateFrom);
  if (dateTo) params.set("until", dateTo);

  const { data, isLoading, error } = useSWR<{
    entries: AuditLogEntry[];
    total: number;
  }>(isEnterprise ? `/v1/audit?${params.toString()}` : null, fetcher);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  if (org && !isEnterprise) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Audit Log</h1>
          <p className="mt-1 text-sm text-stone-500">
            View a detailed log of all actions in your organization
          </p>
        </div>

        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-stone-200 bg-white px-6 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
            <svg
              className="h-6 w-6 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-stone-900">
            Enterprise feature
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-stone-500">
            The audit log is available on the Enterprise plan. Upgrade to track
            all actions across your organization.
          </p>
          <a
            href="/billing"
            className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Upgrade to Enterprise
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Audit Log</h1>
        <p className="mt-1 text-sm text-stone-500">
          View a detailed log of all actions in your organization
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load audit log. Please try again.
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-stone-200 bg-white px-6 py-16">
          <h3 className="text-sm font-semibold text-stone-900">
            No audit log entries
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Actions will appear here as your team uses the platform.
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="px-4 py-3 font-medium text-stone-600">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-600">
                    Action
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-600">
                    Resource Type
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-600">
                    Resource ID
                  </th>
                  <th className="px-4 py-3 font-medium text-stone-600">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                        {entry.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {entry.resourceType}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-stone-500">
                        {entry.resourceId}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {entry.actorId ?? "system"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">
              Showing {offset + 1}--{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total} entries
            </p>
            <div className="flex gap-2">
              <button
                disabled={!hasPrev}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={!hasNext}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
