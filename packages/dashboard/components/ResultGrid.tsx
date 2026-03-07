import type { TestResult } from "@/lib/api";
import Badge from "./Badge";

interface ResultGridProps {
  results: TestResult[];
}

export default function ResultGrid({ results }: ResultGridProps) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-stone-400">No test results available.</p>
    );
  }

  // Group results by suite
  const suiteMap = new Map<string, TestResult[]>();
  for (const result of results) {
    const list = suiteMap.get(result.suite_name) ?? [];
    list.push(result);
    suiteMap.set(result.suite_name, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(suiteMap.entries()).map(([suiteName, suiteResults]) => (
        <div key={suiteName} className="space-y-3">
          {/* Suite header */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-700">
              {suiteName}
            </h3>
            <span className="text-xs text-stone-400">
              {suiteResults.filter((r) => r.pass).length}/
              {suiteResults.length} passed
            </span>
          </div>

          {/* Results table */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                      Test
                    </th>
                    <th className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-600">
                      Status
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
                  {suiteResults.map((result) => {
                    const passedAssertions = result.assertions.filter(
                      (a) => a.pass,
                    ).length;
                    const totalAssertions = result.assertions.length;

                    return (
                      <tr key={result.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <span className="font-medium text-stone-900">
                            {result.test_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={result.pass ? "passed" : "failed"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-stone-600">
                              {passedAssertions}/{totalAssertions}
                            </span>
                            {/* Mini assertion bar */}
                            <div className="flex gap-0.5">
                              {result.assertions.map((assertion, i) => (
                                <div
                                  key={i}
                                  title={`${assertion.type}: ${assertion.message}`}
                                  className={`h-4 w-1.5 rounded-full ${
                                    assertion.pass
                                      ? "bg-green-400"
                                      : "bg-red-400"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                          {result.latency_ms != null
                            ? result.latency_ms < 1000
                              ? `${result.latency_ms}ms`
                              : `${(result.latency_ms / 1000).toFixed(1)}s`
                            : "--"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                          {result.cost_usd != null
                            ? `$${result.cost_usd.toFixed(4)}`
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
      ))}
    </div>
  );
}
