import type { ComparisonData, ResultDiff } from "@/lib/api";
import MetricCard from "./MetricCard";

interface ComparisonViewProps {
  data: ComparisonData;
}

function statusColor(status: ResultDiff["status"]): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "regression":
      return { bg: "bg-red-50", text: "text-red-700" };
    case "improvement":
      return { bg: "bg-green-50", text: "text-green-700" };
    case "new":
      return { bg: "bg-blue-50", text: "text-blue-700" };
    case "removed":
      return { bg: "bg-amber-50", text: "text-amber-700" };
    default:
      return { bg: "bg-stone-50", text: "text-stone-600" };
  }
}

function DiffRow({ diff }: { diff: ResultDiff }) {
  const { bg, text } = statusColor(diff.status);

  return (
    <tr className="hover:bg-stone-50">
      <td className="px-4 py-3 text-sm font-medium text-stone-900">
        {diff.testCaseName}
      </td>
      <td className="px-4 py-3 text-sm text-stone-500">{diff.modelId}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
        >
          {diff.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-stone-500">
        {diff.baselinePassRate != null
          ? `${(diff.baselinePassRate * 100).toFixed(1)}%`
          : "--"}
      </td>
      <td className="px-4 py-3 text-sm text-stone-500">
        {diff.currentPassRate != null
          ? `${(diff.currentPassRate * 100).toFixed(1)}%`
          : "--"}
      </td>
      <td className="px-4 py-3">
        {diff.delta != null ? (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
              diff.delta > 0
                ? "bg-green-50 text-green-700"
                : diff.delta < 0
                  ? "bg-red-50 text-red-700"
                  : "bg-stone-50 text-stone-600"
            }`}
          >
            {diff.delta > 0 ? "+" : ""}
            {(diff.delta * 100).toFixed(2)}%
          </span>
        ) : (
          <span className="text-sm text-stone-400">--</span>
        )}
      </td>
    </tr>
  );
}

export default function ComparisonView({ data }: ComparisonViewProps) {
  const summary = data.summary;
  const diffs = data.diffs ?? [];

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Regressions" value={String(summary.regressions)} />
          <MetricCard
            label="Improvements"
            value={String(summary.improvements)}
          />
          <MetricCard label="Unchanged" value={String(summary.unchanged)} />
          <MetricCard label="New" value={String(summary.new)} />
          <MetricCard label="Removed" value={String(summary.removed)} />
        </div>
      )}

      {/* Baseline info */}
      {data.baseline && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-sm text-stone-500">
            Comparing against baseline{" "}
            <span className="font-medium text-stone-700">
              {data.baseline.label}
            </span>{" "}
            (run{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs text-stone-600">
              {data.baseline.runId.slice(0, 8)}
            </code>
            )
          </p>
        </div>
      )}

      {/* Diffs table */}
      {diffs.length === 0 ? (
        <p className="text-sm text-stone-400">No test results to compare.</p>
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
                    Model
                  </th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                    Status
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
                {diffs.map((diff, i) => (
                  <DiffRow key={i} diff={diff} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
