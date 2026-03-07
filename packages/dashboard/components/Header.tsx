"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { User, Organization } from "@/lib/api";
import { fetcher } from "@/lib/api";
import { clearToken } from "@/lib/auth";

export default function Header() {
  const router = useRouter();

  const { data: user } = useSWR<User>("/v1/auth/me", fetcher);
  const { data: org } = useSWR<Organization>("/v1/org", fetcher);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-6">
      {/* Org name */}
      <div className="flex items-center gap-3 pl-10 lg:pl-0">
        {org ? (
          <span className="text-sm font-medium text-stone-700">
            {org.name}
          </span>
        ) : (
          <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
        )}
      </div>

      {/* User section */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.github_login}
                className="h-8 w-8 rounded-full ring-1 ring-stone-200"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
                {user.github_login.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden text-sm font-medium text-stone-700 sm:block">
              {user.github_login}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-stone-200" />
            <div className="hidden h-4 w-20 animate-pulse rounded bg-stone-200 sm:block" />
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          title="Sign out"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
