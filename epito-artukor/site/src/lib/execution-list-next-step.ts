import type { Project } from "@/types/projects"
import type { ProjectListSummary } from "@/lib/project-list-summary"

export type ExecutionListFilter = "all" | "not_started" | "in_progress" | "tig_ready"

export type ExecutionListSortKey = "attention" | "updated" | "sell" | "progress"

export type ExecutionNextStep = {
  kind: "start" | "tig" | "progress" | "review"
  label: string
  /** Projekt Költségvetés / kivitelezés fül */
  href: string
  /** Magasabb = előrébb a „figyelmet igényel” rendezésben */
  priority: number
}

function projectQuotesHref(projectId: string): string {
  return `/projektek/${projectId}?tab=quotes`
}

export function executionStatusSentence(
  project: Project,
  summary: ProjectListSummary
): string {
  if (project.status === "won") {
    return "Elfogadva · még nem indult"
  }
  const eligible = summary.eligibleTigLineCount ?? 0
  if (eligible > 0) {
    return `${eligible} tétel vár TIG-re`
  }
  const pending = summary.executionPending ?? 0
  if (pending > 0) {
    return `${pending} tétel még nincs kész`
  }
  const pct = summary.executionPercent ?? summary.pricedPercent
  if (pct >= 100) {
    const tig = summary.tigPercent ?? 0
    return tig >= 100 ? "Kész · TIG teljes" : `Készültség kész · TIG ${tig}%`
  }
  return "Kivitelezés folyamatban"
}

export function resolveExecutionNextStep(
  project: Project,
  summary: ProjectListSummary
): ExecutionNextStep {
  const quotesHref = projectQuotesHref(project.id)

  if (project.status === "won") {
    return {
      kind: "start",
      label: "Kivitelezés indítása",
      href: quotesHref,
      priority: 90,
    }
  }

  const eligible = summary.eligibleTigLineCount ?? 0
  if (eligible > 0) {
    return {
      kind: "tig",
      label: `TIG (${eligible})`,
      href: quotesHref,
      priority: 100,
    }
  }

  const pending = summary.executionPending ?? 0
  if (pending > 0 || (summary.executionPercent ?? 0) < 100) {
    return {
      kind: "progress",
      label: "Készültség",
      href: quotesHref,
      priority: 50,
    }
  }

  return {
    kind: "review",
    label: "Áttekintés",
    href: quotesHref,
    priority: 10,
  }
}

export function matchesExecutionListFilter(
  project: Project,
  summary: ProjectListSummary,
  filter: ExecutionListFilter
): boolean {
  if (filter === "all") return true
  if (filter === "not_started") return project.status === "won"
  if (filter === "in_progress") return project.status === "in_progress"
  if (filter === "tig_ready") return (summary.eligibleTigLineCount ?? 0) > 0
  return true
}

export function sortExecutionProjects(
  projects: Project[],
  summaries: Map<string, ProjectListSummary>,
  sortKey: ExecutionListSortKey
): Project[] {
  const rows = [...projects]
  if (sortKey === "sell") {
    return rows.sort(
      (a, b) =>
        (summaries.get(b.id)?.sellTotal ?? 0) - (summaries.get(a.id)?.sellTotal ?? 0)
    )
  }
  if (sortKey === "progress") {
    return rows.sort(
      (a, b) =>
        (summaries.get(a.id)?.executionPercent ??
          summaries.get(a.id)?.pricedPercent ??
          0) -
        (summaries.get(b.id)?.executionPercent ??
          summaries.get(b.id)?.pricedPercent ??
          0)
    )
  }
  if (sortKey === "updated") {
    return rows.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }
  // attention — next-step priority, then updated
  return rows.sort((a, b) => {
    const sa = summaries.get(a.id)
    const sb = summaries.get(b.id)
    const pa = sa ? resolveExecutionNextStep(a, sa).priority : 0
    const pb = sb ? resolveExecutionNextStep(b, sb).priority : 0
    if (pb !== pa) return pb - pa
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function countExecutionListFilters(
  projects: Project[],
  summaries: Map<string, ProjectListSummary>
): Record<ExecutionListFilter, number> {
  const counts: Record<ExecutionListFilter, number> = {
    all: projects.length,
    not_started: 0,
    in_progress: 0,
    tig_ready: 0,
  }
  for (const p of projects) {
    const s = summaries.get(p.id)
    if (!s) continue
    if (p.status === "won") counts.not_started += 1
    if (p.status === "in_progress") counts.in_progress += 1
    if ((s.eligibleTigLineCount ?? 0) > 0) counts.tig_ready += 1
  }
  return counts
}
