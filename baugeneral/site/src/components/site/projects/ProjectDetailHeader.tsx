"use client"

import { useMemo } from "react"
import { ProjectCategoryChip } from "@/components/site/projects/ProjectCategoryChip"
import { ProjectOwnershipChip } from "@/components/site/projects/ProjectOwnershipChip"
import { formatTimelineDate, getProjectTimelineState } from "@/lib/project-timeline"
import type { ActiveProject } from "@/lib/projects"

export function ProjectDetailHeader({ project }: { project: ActiveProject }) {
  const timeline = useMemo(() => getProjectTimelineState(project), [project])

  return (
    <header className="rounded-[var(--radius-md)] border border-black/8 bg-white px-4 py-5 md:px-6 md:py-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-live)]/25 bg-[var(--color-live)]/8 px-3 py-1 text-sm font-semibold text-[var(--color-live)]">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-live)] opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-live)]" />
          </span>
          Aktív projekt · {timeline.progressPercent}%
        </span>
        <ProjectOwnershipChip ownership={project.ownership} />
        <ProjectCategoryChip category={project.category} />
      </div>
      <h1 className="about-h1 mt-4 text-black/90">{project.title}</h1>
      <p className="mt-2 text-base text-black/55">
        Állapot:{" "}
        <span className="font-medium text-black/75">{formatTimelineDate(timeline.today)}</span>
        {" · "}
        {project.city}
      </p>
    </header>
  )
}
