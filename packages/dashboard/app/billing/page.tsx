"use client";

import useSWR from "swr";
import type { BillingInfo } from "@/lib/api";
import { fetcher, apiClient } from "@/lib/api";
import PlanCard from "@/components/PlanCard";


export default function BillingPage() {
  const { data, isLoading, error } = useSWR<BillingInfo>(
    "/v1/billing",
    fetcher,
  );

  async function handleManageBilling() {
    const result = await apiClient<{ url: string }>("/v1/billing/portal", {
      method: "POST",
    });
    window.location.href = result.url;
  }

  async function handleUpgrade(plan: "team" | "enterprise") {
    const result = await apiClient<{ url: string }>("/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
    window.location.href = result.url;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-xl bg-stone-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
        Failed to load billing information. Please try again.
      </div>
    );
  }

  const currentPlan = data?.plan ?? "free";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Billing & Plan
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current plan notice */}
      {data?.cancel_at_period_end && data.current_period_end && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your plan is set to cancel at the end of the current period (
          {new Date(data.current_period_end).toLocaleDateString()}). You can
          reactivate from the billing portal.
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        <PlanCard
          name="Free"
          price="$0"
          period="forever"
          current={currentPlan === "free"}
          features={[
            "CLI (all features)",
            "1 project",
            "7-day test history",
            "1 team member",
            "GitHub Issues support",
          ]}
          onSelect={undefined}
        />
        <PlanCard
          name="Team"
          price="$49"
          period="/month"
          current={currentPlan === "team"}
          highlighted
          features={[
            "Cloud dashboard",
            "5 projects",
            "90-day test history",
            "10 team members",
            "Compliance PDF export",
            "Slack/webhook notifications",
            "Email support",
          ]}
          onSelect={
            currentPlan === "free"
              ? () => handleUpgrade("team")
              : currentPlan === "team"
                ? handleManageBilling
                : undefined
          }
          actionLabel={
            currentPlan === "free"
              ? "Upgrade"
              : currentPlan === "team"
                ? "Manage"
                : undefined
          }
        />
        <PlanCard
          name="Enterprise"
          price="$299"
          period="/month"
          current={currentPlan === "enterprise"}
          features={[
            "Unlimited projects",
            "Unlimited test history",
            "Unlimited team members",
            "Signed compliance reports",
            "SSO/SAML",
            "Audit log API",
            "99.9% SLA",
            "Dedicated support",
          ]}
          onSelect={
            currentPlan !== "enterprise"
              ? () => handleUpgrade("enterprise")
              : handleManageBilling
          }
          actionLabel={currentPlan === "enterprise" ? "Manage" : "Upgrade"}
        />
      </div>

      {/* Manage billing portal link */}
      {currentPlan !== "free" && (
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h3 className="text-sm font-medium text-stone-900">
            Billing portal
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Update payment method, download invoices, and manage subscription.
          </p>
          <button
            onClick={handleManageBilling}
            className="mt-4 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            Open billing portal
          </button>
        </div>
      )}
    </div>
  );
}
