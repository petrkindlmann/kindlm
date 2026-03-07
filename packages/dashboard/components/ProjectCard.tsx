import Link from "next/link";
import type { Project } from "@/lib/api";
import Badge from "./Badge";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const latestRun = project.latest_run;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-stone-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-sm"
    >
      {/* Title + status */}
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-stone-900 group-hover:text-indigo-700">
          {project.name}
        </h3>
        {latestRun && (
          <Badge
            status={latestRun.failed === 0 ? "passed" : "failed"}
          />
        )}
      </div>

      {/* Stats */}
      {latestRun ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              Pass Rate
            </p>
            <p className="mt-0.5 text-lg font-semibold text-stone-900">
              {Math.round(latestRun.pass_rate * 100)}%
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
              Tests
            </p>
            <p className="mt-0.5 text-lg font-semibold text-stone-900">
              {latestRun.total_tests}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-400">No runs yet</p>
      )}

      {/* Footer */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        <p className="text-xs text-stone-400">
          Created {new Date(project.created_at).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
