import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-indigo-500 mb-3">404</p>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-stone-500 mb-6">
          The page you're looking for doesn't exist.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-4 py-2 text-sm font-semibold bg-stone-900 text-white rounded-lg no-underline"
          >
            Home
          </Link>
          <Link
            href="/docs"
            className="px-4 py-2 text-sm font-semibold border border-stone-300 text-stone-700 rounded-lg no-underline"
          >
            Docs
          </Link>
        </div>
      </div>
    </div>
  );
}
