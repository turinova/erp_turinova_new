import type { RfqDecisionLogEntry } from "@/types/projects"
import { formatHuf } from "@/lib/pricing"
import { getTradeLabel } from "@/lib/trades"
import {
  listAuditForProject,
  listDecisionLogsForProject,
  listRfqsForProject,
  listQuotesForProject,
  listSubmissionsForProject,
} from "@/lib/data/projects-store"

export type OverviewActivityKind = "quote" | "rfq" | "file" | "project" | "decision"

export type OverviewActivityItem = {
  id: string
  at: string
  who: string
  action: string
  context?: string
  kind: OverviewActivityKind
  kindLabel: string
}

const KIND_LABELS: Record<OverviewActivityKind, string> = {
  quote: "Költségvetés",
  rfq: "Alvállalkozó",
  file: "Dokumentum",
  project: "Projekt",
  decision: "Döntés",
}

const UNKNOWN_ACTOR = "—"

function decisionAction(entry: RfqDecisionLogEntry): string {
  switch (entry.action) {
    case "accept_package":
      return "Nyertes kiválasztva"
    case "change_package_winner":
      return "Nyertes módosítva"
    default:
      return "Döntés"
  }
}

function decisionWho(entry: RfqDecisionLogEntry): string {
  return entry.decidedByEmail ?? entry.decidedByName ?? UNKNOWN_ACTOR
}

export function buildDetailedProjectActivity(projectId: string): OverviewActivityItem[] {
  const quotes = listQuotesForProject(projectId)
  const packages = listRfqsForProject(projectId)
  const submissions = listSubmissionsForProject(projectId)
  const decisionLogs = listDecisionLogsForProject(projectId)
  const auditEntries = listAuditForProject(projectId)

  const pkgMap = new Map(packages.map((p) => [p.id, p]))
  const quoteMap = new Map(quotes.map((q) => [q.id, q]))

  const events: OverviewActivityItem[] = []

  for (const entry of auditEntries) {
    events.push({
      id: entry.id,
      at: entry.at,
      who: entry.actorEmail,
      action: entry.action,
      context: entry.context,
      kind: entry.kind,
      kindLabel: KIND_LABELS[entry.kind],
    })
  }

  for (const sub of submissions) {
    const pkg = pkgMap.get(sub.rfqId)
    const quote = pkg ? quoteMap.get(pkg.quoteId) : undefined
    events.push({
      id: `sub-${sub.id}`,
      at: sub.submittedAt,
      who: sub.subcontractorName,
      action: "Ajánlat beküldve",
      context: [
        pkg?.title,
        quote?.primaryTrade ? getTradeLabel(quote.primaryTrade) : null,
        sub.totalAmount > 0 ? formatHuf(sub.totalAmount) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "rfq",
      kindLabel: KIND_LABELS.rfq,
    })
  }

  for (const entry of decisionLogs) {
    const pkg = pkgMap.get(entry.packageId)
    events.push({
      id: `dec-${entry.id}`,
      at: entry.createdAt,
      who: decisionWho(entry),
      action: decisionAction(entry),
      context: [
        pkg?.title,
        entry.subcontractorName ? `nyertes: ${entry.subcontractorName}` : null,
        entry.marginPercentAfter != null ? `fedezet ${entry.marginPercentAfter}%` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      kind: "decision",
      kindLabel: KIND_LABELS.decision,
    })
  }

  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12)
}

/** Összefoglaló szöveg listanézethez */
export function formatActivitySummary(item: OverviewActivityItem): string {
  const who = item.who !== UNKNOWN_ACTOR ? item.who : ""
  return [who, item.action].filter(Boolean).join(" — ")
}
