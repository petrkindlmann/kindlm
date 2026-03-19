import type { ComparisonData, ComparisonDelta } from "@/lib/api";
import MetricCard from "./MetricCard";

interface ComparisonViewProps {
  data: ComparisonData;
}

function DeltaRow({ delta }: { delta: ComparisonDelta }) {
  const isPositive = delta.delta > 0;
  const sign = isPositive ? "+" : "";
  const colorClass = isPositive ? "text-green-700" : "text-red-700";
  const bgClass = isPositive ? "bg-green-50" : "bg-red-50";

  return (
    <tr className="hover:bg-stone-50">
      <td className="px-4 py-3 text-sm font-medium text-stone-900">
        {delta.testCaseName}
      </td>
      <td className="px-4 py-3 text-sm text-stone-500">{delta.field}</td>
      <td className="px-4 py-3 text-sm text-stone-500">
        {typeof delta.baselineValue === "number"
          ? delta.baselineValue.toFixed(3)
          : String(delta.baselineValue)}
      </td>
      <td className="px-4 py-3 text-sm text-stone-500">
        {typeof delta.currentValue === "number"
          ? delta.currentValue.toFixed(3)
          : String(delta.currentValue)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${bgClass} ${colorClass}`}
        >
          {sign}
          {typeof delta.delta === "number"
            ? delta.delta.toFixed(3)
            : String(delta.delta)}
        </span>
      </td>
    </tr>
  );
}

function DeltaTable({
  title,
  deltas,
  emptyMessage,
}: {
  title: string;
  deltas: ComparisonDelta[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      {deltas.length === 0 ? (
        <p className="text-sm text-stone-400">{emptyMessage}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Test Case
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Field
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Baseline
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Current
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {deltas.map((delta, i) => (
                  <DeltaRow key={i} delta={delta} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparisonView({ data }: ComparisonViewProps) {
  const totalChanges = data.regressions.length + data.improvements.length;

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Regressions" value={String(data.regressions.length)} />
        <MetricCard
          label="Improvements"
          value={String(data.improvements.length)}
        />
        <MetricCard label="Unchanged" value={String(data.unchanged)} />
        <MetricCard label="Total Changes" value={String(totalChanges)} />
      </div>

      {/* Baseline info */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-sm text-stone-500">
          Comparing against baseline{" "}
          <span className="font-medium text-stone-700">
            {data.baseline.label}
          </span>{" "}
          (created{" "}
          {new Date(data.baseline.createdAt).toLocaleDateString()})
        </p>
      </div>

      {/* Regressions */}
      <DeltaTable
        title="Regressions"
        deltas={data.regressions}
        emptyMessage="No regressions detected."
      />

      {/* Improvements */}
      <DeltaTable
        title="Improvements"
        deltas={data.improvements}
        emptyMessage="No improvements detected."
      />
    </div>
  );
}
