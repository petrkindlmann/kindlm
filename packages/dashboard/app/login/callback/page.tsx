"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken } from "@/lib/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setError("No token received from authentication server.");
      return;
    }

    setToken(token);
    router.replace("/projects");
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
