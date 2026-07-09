import type { Project } from "@/types/projects"

/** Projektek menü — lista nézetek státusz szerint */
export type ProjectListPhase = "quotes" | "execution" | "archive"

export const QUOTES_PHASE_STATUSES: Project["status"][] = ["prospect", "quoting"]
export const EXECUTION_PHASE_STATUSES: Project["status"][] = ["won", "in_progress"]
export const ARCHIVE_PHASE_STATUSES: Project["status"][] = ["done", "archived"]

const PHASE_STATUSES: Record<ProjectListPhase, Project["status"][]> = {
  quotes: QUOTES_PHASE_STATUSES,
  execution: EXECUTION_PHASE_STATUSES,
  archive: ARCHIVE_PHASE_STATUSES,
}

export const PROJECT_PHASE_HREFS: Record<ProjectListPhase, string> = {
  quotes: "/ajanlatok",
  execution: "/kivitelezes",
  archive: "/archiv",
}

export const PROJECT_PHASE_LABELS: Record<ProjectListPhase, string> = {
  quotes: "Árajánlatok",
  execution: "Kivitelezés",
  archive: "Archív",
}

export function projectMatchesPhase(project: Project, phase: ProjectListPhase): boolean {
  return PHASE_STATUSES[phase].includes(project.status)
}

export function listHrefForProject(project: Project): string {
  return PROJECT_PHASE_HREFS[phaseForProject(project)]
}

export function phaseForProject(project: Project): ProjectListPhase {
  if (EXECUTION_PHASE_STATUSES.includes(project.status)) return "execution"
  if (ARCHIVE_PHASE_STATUSES.includes(project.status)) return "archive"
  return "quotes"
}

export function filterProjectsByPhase(projects: Project[], phase: ProjectListPhase): Project[] {
  return projects.filter((p) => projectMatchesPhase(p, phase))
}
