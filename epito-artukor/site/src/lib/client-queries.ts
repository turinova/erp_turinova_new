import type { Client } from "@/types/clients"
import type { Project, Quote } from "@/types/projects"
import { listProjects, listQuotesForProject, listQuoteLines, listRfqsForQuote, listSubmissionsForQuote, listInvitationsForQuote } from "@/lib/data/projects-store"
import { buildQuoteSummary } from "@/lib/quote-summary"
import { formatHuf } from "@/lib/pricing"

export type ClientProjectRow = {
  project: Project
  quoteCount: number
  openQuoteCount: number
}

export type ClientQuoteRow = {
  quote: Quote
  project: Project
  grossTotal: number
  grossFormatted: string
}

export type ClientStats = {
  projectCount: number
  activeProjectCount: number
  quoteCount: number
  openQuoteCount: number
  acceptedGrossTotal: number
  acceptedGrossFormatted: string
}

export function listProjectsForClient(client: Client): Project[] {
  return listProjects().filter(
    (p) => p.clientId === client.id || (!p.clientId && matchClientName(p.clientName, client))
  )
}

function matchClientName(clientName: string, client: Client): boolean {
  const q = clientName.trim().toLowerCase()
  if (!q) return false
  return (
    client.displayName.toLowerCase() === q ||
    client.legalName.toLowerCase() === q ||
    client.displayName.toLowerCase().includes(q) ||
    client.legalName.toLowerCase().includes(q)
  )
}

export function getClientStats(client: Client): ClientStats {
  const projects = listProjectsForClient(client)
  let quoteCount = 0
  let openQuoteCount = 0
  let acceptedGrossTotal = 0

  for (const project of projects) {
    const quotes = listQuotesForProject(project.id)
    quoteCount += quotes.length
    for (const quote of quotes) {
      const lines = listQuoteLines(quote.id)
      const rfqs = listRfqsForQuote(quote.id)
      const subs = listSubmissionsForQuote(quote.id)
      const invitations = listInvitationsForQuote(quote.id)
      const summary = buildQuoteSummary(quote, lines, rfqs, subs, invitations)
      if (quote.status === "draft" || quote.status === "sent") {
        openQuoteCount += 1
      }
      if (quote.status === "accepted") {
        acceptedGrossTotal += summary.sellTotal
      }
    }
  }

  const activeProjectCount = projects.filter(
    (p) => p.status !== "archived" && p.status !== "done"
  ).length

  return {
    projectCount: projects.length,
    activeProjectCount,
    quoteCount,
    openQuoteCount,
    acceptedGrossTotal,
    acceptedGrossFormatted: formatHuf(acceptedGrossTotal),
  }
}

export function listClientProjectRows(client: Client): ClientProjectRow[] {
  return listProjectsForClient(client).map((project) => {
    const quotes = listQuotesForProject(project.id)
    return {
      project,
      quoteCount: quotes.length,
      openQuoteCount: quotes.filter((q) => q.status === "draft" || q.status === "sent").length,
    }
  })
}

export function listClientQuoteRows(client: Client): ClientQuoteRow[] {
  const rows: ClientQuoteRow[] = []
  for (const project of listProjectsForClient(client)) {
    for (const quote of listQuotesForProject(project.id)) {
      const lines = listQuoteLines(quote.id)
      const rfqs = listRfqsForQuote(quote.id)
      const subs = listSubmissionsForQuote(quote.id)
      const invitations = listInvitationsForQuote(quote.id)
      const summary = buildQuoteSummary(quote, lines, rfqs, subs, invitations)
      rows.push({
        quote,
        project,
        grossTotal: summary.sellTotal,
        grossFormatted: formatHuf(summary.sellTotal),
      })
    }
  }
  return rows.sort(
    (a, b) => new Date(b.quote.updatedAt).getTime() - new Date(a.quote.updatedAt).getTime()
  )
}

export function countProjectsForClient(clientId: string, clientName?: string): number {
  return listProjects().filter(
    (p) =>
      p.clientId === clientId ||
      (!p.clientId && clientName && p.clientName.toLowerCase() === clientName.toLowerCase())
  ).length
}
