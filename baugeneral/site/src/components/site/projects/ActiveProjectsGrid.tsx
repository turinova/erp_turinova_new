"use client"

import { ActiveProjectCard } from "@/components/site/projects/ActiveProjectCard"
import type { ActiveProject } from "@/lib/projects"

type ActiveProjectsGridProps = {
  projects: ActiveProject[]
}

export function ActiveProjectsGrid({ projects }: ActiveProjectsGridProps) {
  return (
    <div className="grid gap-4">
      {projects.map((project, index) => (
        <ActiveProjectCard key={project.slug} project={project} entranceIndex={index} />
      ))}
    </div>
  )
}
