"use client";

import useSWR from "swr";
import type { Member } from "@/lib/api";
import { fetcher } from "@/lib/api";
import MemberList from "@/components/MemberList";

export default function MembersPage() {
  const { data, isLoading, error, mutate: refresh } = useSWR<{
    data: Member[];
  }>("/v1/org/members", fetcher);

  const members = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Members</h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage your organization members and their roles
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load members. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : (
        <MemberList members={members} onUpdate={() => refresh()} />
      )}
    </div>
  );
}
