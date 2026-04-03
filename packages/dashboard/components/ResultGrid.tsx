import { useState } from "react";
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

function parseJson(raw: string | null): unknown | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ResultDetailExpanded({ result }: { result: TestResult }) {
  const [showFullResponse, setShowFullResponse] = useState(false);
  const assertions = parseAssertionScores(result.assertionScores);
  const toolCalls = parseJson(result.toolCallsJson);
  const responseText = result.responseText;

  return (
    <div className="space-y-4">
      {/* Assertion outcomes */}
      {assertions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Assertions
          </h4>
          <div className="space-y-1">
            {assertions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${a.pass ? "bg-green-400" : "bg-red-400"}`}
                />
                <span className="font-medium text-stone-700">{a.type}</span>
                {a.message && (
                  <span className="text-stone-500">— {a.message}</span>
                )}
                {a.score != null && (
                  <span className="text-stone-400">
                    ({(a.score * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool calls */}
      {toolCalls != null && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Tool Calls
          </h4>
          <pre className="max-h-48 overflow-auto rounded-lg bg-stone-100 p-3 text-xs text-stone-700">
            {JSON.stringify(toolCalls, null, 2)}
          </pre>
        </div>
      )}

      {/* Model response */}
      {responseText && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Model Response
          </h4>
          <div className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
            <p className="whitespace-pre-wrap">
              {showFullResponse || responseText.length <= 500
                ? responseText
                : `${responseText.slice(0, 500)}...`}
            </p>
            {responseText.length > 500 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullResponse(!showFullResponse);
                }}
                className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {showFullResponse ? "Show less" : "Show full response"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Failure messages */}
      {result.failureMessages && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Failure Messages
          </h4>
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {(
              parseJson(result.failureMessages) as string[] | null
            )?.map((msg: string, i: number) => (
              <p key={i}>{msg}</p>
            )) ?? <p>{result.failureMessages}</p>}
          </div>
        </div>
      )}

      {/* Empty state */}
      {assertions.length === 0 &&
        !toolCalls &&
        !responseText &&
        !result.failureMessages && (
          <p className="text-sm text-stone-400">
            No detail data available for this test result.
          </p>
        )}
    </div>
  );
}

export default function ResultGrid({ results }: ResultGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                const isExpanded = expandedId === result.id;

                return (
                  <>
                    <tr
                      key={result.id}
                      className="cursor-pointer hover:bg-stone-50"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : result.id)
                      }
                    >
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
                    {isExpanded && (
                      <tr key={`${result.id}-detail`}>
                        <td
                          colSpan={6}
                          className="bg-stone-50 px-6 py-4"
                        >
                          <ResultDetailExpanded result={result} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
