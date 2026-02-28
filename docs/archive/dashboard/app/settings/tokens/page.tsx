"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ApiToken, ApiTokenCreateResponse } from "@/lib/api";
import { fetcher, apiClient } from "@/lib/api";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";

export default function TokensPage() {
  const key = "/v1/auth/tokens";
  const { data, isLoading, error, mutate: refresh } = useSWR<{
    data: ApiToken[];
  }>(key, fetcher);

  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const tokens = data?.data ?? [];

  async function createToken() {
    if (!tokenName.trim()) return;
    setCreating(true);

    try {
      const result = await apiClient<ApiTokenCreateResponse>(key, {
        method: "POST",
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      setNewToken(result.token);
      setTokenName("");
      refresh();
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(tokenId: string) {
    if (!confirm("Revoke this token? Any integrations using it will stop working."))
      return;

    await apiClient(`/v1/auth/tokens/${tokenId}`, { method: "DELETE" });
    refresh();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">API Tokens</h1>
          <p className="mt-1 text-sm text-stone-500">
            Create tokens for CI/CD integration with <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">kindlm upload</code>
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreate(true);
            setNewToken(null);
          }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Create token
        </button>
      </div>

      {/* New token banner */}
      {newToken && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-800">
            Token created successfully. Copy it now -- you will not see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-green-200">
              {newToken}
            </code>
            <button
              onClick={() => copyToClipboard(newToken)}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && !newToken && (
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-medium text-stone-900">
            Create a new API token
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Token name (e.g., github-actions-ci)"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && createToken()}
            />
            <button
              onClick={createToken}
              disabled={creating || !tokenName.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setTokenName("");
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load tokens. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <EmptyState
          title="No API tokens"
          description="Create a token to authenticate CI/CD uploads."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="px-4 py-3 font-medium text-stone-600">
                  Prefix
                </th>
                <th className="px-4 py-3 font-medium text-stone-600">
                  Last Used
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
              {tokens.map((token) => (
                <tr key={token.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {token.name}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                      {token.prefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {token.last_used_at
                      ? new Date(token.last_used_at).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(token.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => revokeToken(token.id)}
                      className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                    >
                      Revoke
                    </button>
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
