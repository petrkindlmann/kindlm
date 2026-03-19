import Link from "next/link";
import type { Project } from "@/lib/api";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-stone-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-sm"
    >
      {/* Title */}
      <div className="flex items-start justify-between">
        <h3 className="text-base font-semibold text-stone-900 group-hover:text-indigo-700">
          {project.name}
        </h3>
      </div>

      {/* Description */}
      {project.description ? (
        <p className="mt-2 text-sm text-stone-500 line-clamp-2">
          {project.description}
        </p>
      ) : (
        <p className="mt-2 text-sm text-stone-400">No description</p>
      )}

      {/* Footer */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        <p className="text-xs text-stone-400">
          Created {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
