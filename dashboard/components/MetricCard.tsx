interface MetricCardProps {
  label: string;
  value: string;
  delta?: number;
}

export default function MetricCard({ label, value, delta }: MetricCardProps) {
  let deltaDisplay: React.ReactNode = null;

  if (delta != null && delta !== 0) {
    const isPositive = delta > 0;
    const sign = isPositive ? "+" : "";
    const colorClass = isPositive
      ? "text-green-700 bg-green-50"
      : "text-red-700 bg-red-50";

    deltaDisplay = (
      <span
        className={`ml-2 inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {sign}
        {delta.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold text-stone-900">{value}</p>
        {deltaDisplay}
      </div>
    </div>
  );
}
