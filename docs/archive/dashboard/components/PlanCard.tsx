interface PlanCardProps {
  name: string;
  price: string;
  period: string;
  current: boolean;
  highlighted?: boolean;
  features: string[];
  onSelect?: () => void;
  actionLabel?: string;
}

export default function PlanCard({
  name,
  price,
  period,
  current,
  highlighted = false,
  features,
  onSelect,
  actionLabel,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        highlighted
          ? "border-indigo-300 bg-white shadow-md ring-1 ring-indigo-100"
          : "border-stone-200 bg-white"
      }`}
    >
      {/* Current plan badge */}
      {current && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            Current plan
          </span>
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-lg font-semibold text-stone-900">{name}</h3>

      {/* Price */}
      <div className="mt-3 flex items-baseline">
        <span className="text-3xl font-bold text-stone-900">{price}</span>
        <span className="ml-1 text-sm text-stone-500">{period}</span>
      </div>

      {/* Features */}
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            <span className="text-stone-600">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Action button */}
      {onSelect && (
        <button
          onClick={onSelect}
          className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            highlighted
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "border border-stone-300 text-stone-700 hover:bg-stone-50"
          }`}
        >
          {actionLabel ?? (current ? "Manage" : "Upgrade")}
        </button>
      )}
    </div>
  );
}
