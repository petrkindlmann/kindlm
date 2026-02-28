interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-stone-200 bg-white px-6 py-16">
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
        <svg
          className="h-6 w-6 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      </div>

      {/* Text */}
      <h3 className="mt-4 text-sm font-semibold text-stone-900">{title}</h3>
      <p className="mt-1 max-w-sm text-center text-sm text-stone-500">
        {description}
      </p>

      {/* Action */}
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
