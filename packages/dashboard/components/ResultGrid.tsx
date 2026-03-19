import type { TestResult } from "@/lib/api";
import Badge from "./Badge";

interface ResultGridProps {
  results: TestResult[];
}

/** Parse the JSON assertionScores string into an array of score objects. */
function parseAssertionScores(
  raw: string | null,
): Array<{ type: string; pass: boolean; score?: number; message?: string }> {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Array<{
      type: string;
      pass: boolean;
      score?: number;
      message?: string;
    }>;
  } catch {
    return [];
  }
}

export default function ResultGrid({ results }: ResultGridProps) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-stone-400">No test results available.</p>
    );
  }

  return (
    <div className="space-y-6">
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
                  Pass Rate
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                  Assertions
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                  Latency
                </th>
                <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {results.map((result) => {
                const assertions = parseAssertionScores(
                  result.assertionScores,
                );
                const passedAssertions = assertions.filter(
                  (a) => a.pass,
                ).length;
                const totalAssertions = assertions.length;

                return (
                  <tr key={result.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900">
                        {result.testCaseName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                        {result.modelId}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        status={result.passRate >= 1 ? "passed" : "failed"}
                        label={`${Math.round(result.passRate * 100)}%`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {totalAssertions > 0 ? (
                          <>
                            <span className="text-stone-600">
                              {passedAssertions}/{totalAssertions}
                            </span>
                            {/* Mini assertion bar */}
                            <div className="flex gap-0.5">
                              {assertions.map((assertion, i) => (
                                <div
                                  key={i}
                                  title={`${assertion.type}: ${assertion.message ?? ""}`}
                                  className={`h-4 w-1.5 rounded-full ${
                                    assertion.pass
                                      ? "bg-green-400"
                                      : "bg-red-400"
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="text-stone-400">--</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                      {result.latencyAvgMs != null
                        ? result.latencyAvgMs < 1000
                          ? `${Math.round(result.latencyAvgMs)}ms`
                          : `${(result.latencyAvgMs / 1000).toFixed(1)}s`
                        : "--"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                      {result.costUsd != null
                        ? `$${result.costUsd.toFixed(4)}`
                        : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
