import type { Project } from "@/types/projects"
import type { QuoteSummary } from "@/lib/quote-summary"
import { buildQuoteSummary, resolveActiveQuoteId } from "@/lib/quote-summary"
import { buildProjectAggregatedTotals } from "@/lib/project-quote-aggregation"
import { buildExecutionSummary } from "@/lib/execution-summary"
import { phaseForProject } from "@/lib/project-phase"
import {
  listInvitationsForQuote,
  listQuoteLines,
  listQuotesForProject,
  listRfqsForQuote,
  listSubmissionsForQuote,
} from "@/lib/data/projects-store"

export type ProjectListSummary = {
  projectId: string
  quoteCount: number
  activeQuoteId: string | null
  activeQuoteTitle: string | null
  activeSummary: QuoteSummary | null
  sellTotal: number
  marginPercent: number | null
  pricedPercent: number
  isPartialTotal: boolean
  lastActivityLabel: string | null
  lastUpdatedAt: string
  /** Kivitelezés fázis */
  executionPercent?: number
  tigPercent?: number
  isExecutionList?: boolean
}

export function buildProjectListSummary(project: Project): ProjectListSummary {
  const quotes = listQuotesForProject(project.id).filter((q) => q.status !== "archived")
  const summaries = new Map<string, QuoteSummary>()

  let lastActivityLabel: string | null = null
  let lastActivityTime = 0

  for (const q of quotes) {
    const lines = listQuoteLines(q.id)
    const rfqs = listRfqsForQuote(q.id)
    const subs = listSubmissionsForQuote(q.id)
    const invitations = listInvitationsForQuote(q.id)
    const summary = buildQuoteSummary(q, lines, rfqs, subs, invitations)
    summaries.set(q.id, summary)

    const subTime = subs[0] ? new Date(subs[0].submittedAt).getTime() : 0
    const quoteTime = new Date(q.updatedAt).getTime()
    const activityTime = Math.max(subTime, quoteTime)
    if (activityTime > lastActivityTime && summary.lastActivityLabel) {
      lastActivityTime = activityTime
      lastActivityLabel = summary.lastActivityLabel
    }
  }

  const activeQuoteId = resolveActiveQuoteId(quotes)
  const activeQuote = activeQuoteId ? quotes.find((q) => q.id === activeQuoteId) : quotes[0]
  const activeSummary = activeQuote ? summaries.get(activeQuote.id) ?? null : null

  const phase = phaseForProject(project)
  if (phase === "execution") {
    const exec = buildExecutionSummary(project.id)
    return {
      projectId: project.id,
      quoteCount: quotes.length,
      activeQuoteId: activeQuote?.id ?? null,
      activeQuoteTitle: activeQuote?.title ?? null,
      activeSummary,
      sellTotal: exec.contractGross,
      marginPercent: exec.marginPercentOnContract,
      pricedPercent: exec.executionPercent,
      isPartialTotal: exec.executionPercent < 100,
      lastActivityLabel,
      lastUpdatedAt: project.updatedAt,
      executionPercent: exec.executionPercent,
      tigPercent: exec.tigPercentOfContract,
      isExecutionList: true,
    }
  }

  const projectTotals = buildProjectAggregatedTotals(project.id)

  return {
    projectId: project.id,
    quoteCount: quotes.length,
    activeQuoteId: activeQuote?.id ?? null,
    activeQuoteTitle: activeQuote?.title ?? null,
    activeSummary,
    sellTotal: projectTotals.grossTotal,
    marginPercent: projectTotals.marginPercent,
    pricedPercent: projectTotals.pricedPercent,
    isPartialTotal: projectTotals.isPartialTotal,
    lastActivityLabel,
    lastUpdatedAt: project.updatedAt,
  }
}

export type ProjectSortKey = "updated" | "sell"

export function sortProjects(
  projects: Project[],
  summaries: Map<string, ProjectListSummary>,
  sortKey: ProjectSortKey
): Project[] {
  const rows = [...projects]
  if (sortKey === "sell") {
    return rows.sort(
      (a, b) =>
        (summaries.get(b.id)?.sellTotal ?? 0) - (summaries.get(a.id)?.sellTotal ?? 0)
    )
  }
  return rows.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export function filterProjects(
  projects: Project[],
  opts: {
    q?: string
    status?: Project["status"] | "all"
    hideArchived?: boolean
  }
): Project[] {
  let rows = [...projects]

  if (opts.hideArchived) {
    rows = rows.filter((p) => p.status !== "archived")
  }
  if (opts.status && opts.status !== "all") {
    rows = rows.filter((p) => p.status === opts.status)
  }
  if (opts.q?.trim()) {
    const q = opts.q.trim().toLowerCase()
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        p.siteAddress.toLowerCase().includes(q)
    )
  }

  return rows
}

export function countProjectsByStatus(projects: Project[]): Record<Project["status"], number> {
  const counts: Record<Project["status"], number> = {
    prospect: 0,
    quoting: 0,
    won: 0,
    in_progress: 0,
    done: 0,
    archived: 0,
  }
  for (const p of projects) counts[p.status]++
  return counts
}
