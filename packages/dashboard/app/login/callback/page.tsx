"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.kindlm.com";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setError("No authorization code received.");
      return;
    }

    // Exchange the short-lived code for an API token via POST
    fetch(`${API_URL}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? "Token exchange failed");
        }
        return res.json() as Promise<{ token: string }>;
      })
      .then(({ token }) => {
        setToken(token);
        // Replace URL to remove the code from browser history
        window.history.replaceState({}, "", "/login/callback");
        router.replace("/projects");
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-stone-200">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-stone-900">
          Authentication Failed
        </h2>
        <p className="mt-2 text-sm text-stone-500">{error}</p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-stone-200">
      <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-indigo-600" />
      <p className="text-sm text-stone-500">Signing you in...</p>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg ring-1 ring-stone-200">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-indigo-600" />
            <p className="text-sm text-stone-500">Loading...</p>
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
