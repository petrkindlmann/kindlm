import Link from "next/link";
import type { TestRun } from "@/lib/api";
import Badge from "./Badge";

interface RunTableProps {
  runs: TestRun[];
  projectId: string;
}

export default function RunTable({ runs, projectId }: RunTableProps) {
  if (runs.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Pass Rate
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Tests
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Branch
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Commit
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Duration
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-stone-600">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-stone-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/projects/${projectId}/runs/${run.id}`}>
                    <Badge
                      status={run.failed === 0 ? "passed" : "failed"}
                    />
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/projects/${projectId}/runs/${run.id}`}
                    className="font-medium text-stone-900 hover:text-indigo-600"
                  >
                    {Math.round(run.pass_rate * 100)}%
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                  <span className="text-green-700">{run.passed}</span>
                  {" / "}
                  <span className="text-stone-900">{run.total_tests}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {run.git_branch ? (
                    <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-700">
                      {run.git_branch}
                    </code>
                  ) : (
                    <span className="text-stone-400">--</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {run.git_commit ? (
                    <code className="text-xs text-stone-500">
                      {run.git_commit.slice(0, 7)}
                    </code>
                  ) : (
                    <span className="text-stone-400">--</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                  {run.duration_ms < 1000
                    ? `${run.duration_ms}ms`
                    : `${(run.duration_ms / 1000).toFixed(1)}s`}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                  {new Date(run.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
