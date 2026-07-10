import type { Project, ProjectDataBundle } from "@/types/projects"
import type { ProjectListSummary } from "@/lib/project-list-summary"
import { buildProjectListSummaryFromBundle } from "@/lib/project-list-summary"

export type ProjectsSummaryPayload = {
  projects: Project[]
  summaries: Record<string, ProjectListSummary>
}

/** Szerver-oldali projektlista összegzések — a teljes bundle DB-ből, kis válasz a kliensnek. */
export function buildProjectsSummaryPayload(bundle: ProjectDataBundle): ProjectsSummaryPayload {
  const summaries: Record<string, ProjectListSummary> = {}
  for (const project of bundle.projects) {
    summaries[project.id] = buildProjectListSummaryFromBundle(project, bundle)
  }
  return { projects: bundle.projects, summaries }
}
