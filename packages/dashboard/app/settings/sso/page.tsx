"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { SamlConfig, Organization } from "@/lib/api";
import { fetcher, apiClient } from "@/lib/api";

const SP_METADATA_URL =
  process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/auth/saml/metadata`
    : "https://api.kindlm.com/auth/saml/metadata";

export default function SsoPage() {
  // Check organization plan
  const { data: org } = useSWR<Organization>("/v1/org", fetcher);
  const isEnterprise = org?.plan === "enterprise";

  const { data: config, isLoading, error, mutate: refresh } = useSWR<SamlConfig>(
    isEnterprise ? "/v1/sso/config" : null,
    fetcher,
  );

  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    if (config && config.configured) {
      setEntityId(config.idpEntityId ?? "");
      setSsoUrl(config.idpSsoUrl ?? "");
    }
  }, [config]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      await apiClient("/v1/sso/config", {
        method: "PUT",
        body: JSON.stringify({
          idpEntityId: entityId.trim(),
          idpSsoUrl: ssoUrl.trim(),
          idpCertificate: certificate.trim(),
        }),
      });
      setSaved(true);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  if (org && !isEnterprise) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            SSO Configuration
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Configure SAML single sign-on for your organization
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
            SAML SSO is available on the Enterprise plan. Upgrade to enable
            single sign-on for your organization.
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
        <h1 className="text-2xl font-semibold text-stone-900">
          SSO Configuration
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Configure SAML single sign-on for your organization
        </p>
      </div>

      {/* Coming soon notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        SAML login is currently being rolled out. You can save your IDP
        configuration now and SAML-based authentication will be enabled once the
        integration is complete.
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load SSO configuration. Please try again.
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-stone-200"
            />
          ))}
        </div>
      ) : (
        <>
          {/* SP Metadata URL */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="text-sm font-medium text-stone-900">
              Service Provider Metadata
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Provide this URL to your Identity Provider when configuring SAML.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700 ring-1 ring-stone-200">
                {SP_METADATA_URL}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(SP_METADATA_URL)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Configuration form */}
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-medium text-stone-900">
              Identity Provider Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  IDP Entity ID
                </label>
                <input
                  type="text"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="https://idp.example.com/metadata"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  IDP SSO URL
                </label>
                <input
                  type="text"
                  value={ssoUrl}
                  onChange={(e) => setSsoUrl(e.target.value)}
                  placeholder="https://idp.example.com/sso/saml"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  IDP Certificate
                </label>
                <textarea
                  value={certificate}
                  onChange={(e) => setCertificate(e.target.value)}
                  placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                  rows={6}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save configuration"}
                </button>

                {saved && (
                  <span className="text-sm text-green-600">
                    Configuration saved successfully.
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
