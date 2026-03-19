"use client";

import { useState } from "react";
import type { Member } from "@/lib/api";
import { apiClient } from "@/lib/api";

interface MemberListProps {
  members: Member[];
  onUpdate: () => void;
}

const ROLE_OPTIONS: Array<{ value: Member["role"]; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

function roleBadge(role: Member["role"]) {
  switch (role) {
    case "owner":
      return (
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
          Owner
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
          Admin
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
          Member
        </span>
      );
  }
}

export default function MemberList({ members, onUpdate }: MemberListProps) {
  const [changingRole, setChangingRole] = useState<string | null>(null);

  async function changeRole(userId: string, newRole: Member["role"]) {
    setChangingRole(userId);
    try {
      await apiClient(`/v1/org/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      onUpdate();
    } finally {
      setChangingRole(null);
    }
  }

  async function removeMember(userId: string, login: string) {
    if (!confirm(`Remove ${login} from the organization?`)) return;

    await apiClient(`/v1/org/members/${userId}`, { method: "DELETE" });
    onUpdate();
  }

  if (members.length === 0) {
    return <p className="text-sm text-stone-400">No members found.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-4 py-3 font-medium text-stone-600">Member</th>
              <th className="px-4 py-3 font-medium text-stone-600">Email</th>
              <th className="px-4 py-3 font-medium text-stone-600">Role</th>
              <th className="px-4 py-3 font-medium text-stone-600">Joined</th>
              <th className="px-4 py-3 text-right font-medium text-stone-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members.map((member) => {
              const login = member.user?.githubLogin ?? "Unknown";
              const avatarUrl = member.user?.avatarUrl ?? null;
              const email = member.user?.email ?? null;

              return (
                <tr key={member.userId} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={login}
                          className="h-8 w-8 rounded-full ring-1 ring-stone-200"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                          {login.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-stone-900">
                        {login}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {email ?? "--"}
                  </td>
                  <td className="px-4 py-3">{roleBadge(member.role)}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Role selector */}
                      {member.role !== "owner" && (
                        <>
                          <select
                            value={member.role}
                            onChange={(e) =>
                              changeRole(
                                member.userId,
                                e.target.value as Member["role"],
                              )
                            }
                            disabled={changingRole === member.userId}
                            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.filter((r) => r.value !== "owner").map(
                              (opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            onClick={() =>
                              removeMember(member.userId, login)
                            }
                            className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
