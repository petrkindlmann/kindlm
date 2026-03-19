"use client";

import useSWR from "swr";
import type { Webhook } from "@/lib/api";
import { fetcher } from "@/lib/api";
import WebhookList from "@/components/WebhookList";
import EmptyState from "@/components/EmptyState";

export default function WebhooksPage() {
  const key = "/v1/org/webhooks";
  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR<{ webhooks: Webhook[] }>(key, fetcher);

  const webhooks = data?.webhooks ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Webhooks</h1>
        <p className="mt-1 text-sm text-stone-500">
          Receive notifications when test runs complete
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load webhooks. Please try again.
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
      ) : webhooks.length === 0 ? (
        <EmptyState
          title="No webhooks configured"
          description="Add a webhook to get notified on Slack, Discord, or any HTTP endpoint when test runs complete."
        />
      ) : (
        <WebhookList webhooks={webhooks} onUpdate={() => refresh()} />
      )}
    </div>
  );
}
