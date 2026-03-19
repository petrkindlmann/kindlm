"use client";

import useSWR from "swr";
import type { Project } from "@/lib/api";
import { fetcher } from "@/lib/api";
import ProjectCard from "@/components/ProjectCard";
import EmptyState from "@/components/EmptyState";

export default function ProjectsPage() {
  const { data, error, isLoading } = useSWR<{ projects: Project[] }>(
    "/v1/projects",
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Projects</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-stone-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Projects</h1>
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-700 ring-1 ring-red-200">
          Failed to load projects. Please try again.
        </div>
      </div>
    );
  }

  const projects = data?.projects ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Projects</h1>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Projects are created automatically when you upload your first test run with the CLI."
          actionLabel="View setup guide"
          actionHref="https://docs.kindlm.com/cloud/getting-started"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
