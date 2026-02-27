"use client";

import { useState } from "react";
import type { Webhook } from "@/lib/api";
import { apiClient } from "@/lib/api";

interface WebhookListProps {
  webhooks: Webhook[];
  onUpdate: () => void;
}

const AVAILABLE_EVENTS = [
  "run.completed",
  "run.failed",
  "baseline.created",
  "baseline.activated",
];

export default function WebhookList({ webhooks, onUpdate }: WebhookListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["run.completed"]);
  const [creating, setCreating] = useState(false);

  async function createWebhook() {
    if (!newUrl.trim()) return;
    setCreating(true);

    try {
      await apiClient("/v1/org/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents }),
      });
      setNewUrl("");
      setNewEvents(["run.completed"]);
      setShowCreate(false);
      onUpdate();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(webhook: Webhook) {
    await apiClient(`/v1/org/webhooks/${webhook.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !webhook.active }),
    });
    onUpdate();
  }

  async function deleteWebhook(webhookId: string) {
    if (!confirm("Delete this webhook?")) return;

    await apiClient(`/v1/org/webhooks/${webhookId}`, { method: "DELETE" });
    onUpdate();
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Add webhook
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-medium text-stone-900">
            Add a new webhook
          </h3>

          {/* URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              Endpoint URL
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Events */}
          <div>
            <label className="mb-2 block text-xs font-medium text-stone-600">
              Events
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_EVENTS.map((event) => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    newEvents.includes(event)
                      ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                      : "bg-stone-100 text-stone-500 ring-1 ring-stone-200 hover:bg-stone-200"
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={createWebhook}
              disabled={creating || !newUrl.trim() || newEvents.length === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewUrl("");
                setNewEvents(["run.completed"]);
              }}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Webhook list */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-3 font-medium text-stone-600">URL</th>
                <th className="px-4 py-3 font-medium text-stone-600">Events</th>
                <th className="px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="px-4 py-3 font-medium text-stone-600">Created</th>
                <th className="px-4 py-3 text-right font-medium text-stone-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                      {webhook.url.length > 50
                        ? `${webhook.url.slice(0, 50)}...`
                        : webhook.url}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <span
                          key={event}
                          className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(webhook)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        webhook.active ? "bg-indigo-600" : "bg-stone-300"
                      }`}
                      role="switch"
                      aria-checked={webhook.active}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
                          webhook.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {new Date(webhook.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteWebhook(webhook.id)}
                      className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
