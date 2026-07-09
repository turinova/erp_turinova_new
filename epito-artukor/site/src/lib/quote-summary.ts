import type {
  Quote,
  QuoteLine,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import type { Trade } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import { getTradesListSync } from "@/lib/trades/trades-cache"
import {
  countUnpricedLines,
  isLineCosted,
  quoteCostTotals,
  quoteSellTotals,
} from "@/lib/quote-pricing"
import {
  getMinAcceptableMarginPercent,
  getMinAcceptableMarginPercentStatic,
} from "@/lib/app-settings"

/** @deprecated Használd a getMinAcceptableMarginPercent() függvényt */
export const MIN_ACCEPTABLE_MARGIN_PERCENT = getMinAcceptableMarginPercentStatic()

export { getMinAcceptableMarginPercent }

export type QuoteTradeStat = {
  trade: Trade
  label: string
  total: number
  priced: number
  unpriced: number
  rfqPending: number
}

export type QuoteReadiness = {
  canSend: boolean
  canExportPdf: boolean
  blockers: string[]
}

export type QuoteSummary = {
  lineCount: number
  pricedCount: number
  unpricedCount: number
  /** Árazatlan, de nem vár RFQ-ra */
  unpricedNotRfqCount: number
  subcontractorCount: number
  rfqPendingCount: number
  costTotal: number
  sellTotal: number
  marginTotal: number
  marginPercent: number | null
  isPartialTotal: boolean
  totalsCalculable: boolean
  pricedPercent: number
  rfqCount: number
  rfqSubmissionCount: number
  rfqAwaitingCount: number
  unappliedSubmissionCount: number
  unappliedSubmissionIds: string[]
  tradeStats: QuoteTradeStat[]
  readiness: QuoteReadiness
  lastActivityLabel: string
}

function countUnappliedSubmissions(
  rfqs: SubcontractorRfq[],
  submissions: SubcontractorRfqSubmission[],
  lines: QuoteLine[]
): { count: number; ids: string[] } {
  const unapplied: string[] = []
  for (const sub of submissions) {
    const rfq = rfqs.find((r) => r.id === sub.rfqId)
    if (!rfq) continue
    const needsApply = rfq.lines.some((rl) => {
      if (!rl.quoteLineId) return false
      const line = lines.find((l) => l.id === rl.quoteLineId)
      return line != null && line.costSourceRfqSubmissionId !== sub.id
    })
    if (needsApply) unapplied.push(sub.id)
  }
  return { count: unapplied.length, ids: unapplied }
}

function buildTradeStats(lines: QuoteLine[]): QuoteTradeStat[] {
  return getTradesListSync()
    .map((t) => {
      const tradeLines = lines.filter((l) => l.trade === t.code)
      const rfqPending = tradeLines.filter((l) => l.pricingStatus === "rfq_pending").length
      const unpriced = tradeLines.filter((l) => !isLineCosted(l)).length
      const priced = tradeLines.length - unpriced
      return {
        trade: t.code,
        label: t.name,
        total: tradeLines.length,
        priced,
        unpriced,
        rfqPending,
      }
    })
    .filter((s) => s.total > 0)
}

function buildLastActivityLabel(
  quote: Quote,
  submissions: SubcontractorRfqSubmission[]
): string {
  const latestSub = submissions[0]
  if (latestSub) {
    const d = new Date(latestSub.submittedAt).toLocaleString("hu-HU", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    return `${d} — ${latestSub.subcontractorName} válasza`
  }
  const d = new Date(quote.updatedAt).toLocaleString("hu-HU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${d} — árajánlat módosítva`
}

function buildReadiness(
  lineCount: number,
  unpricedCount: number,
  unappliedSubmissionCount: number,
  isPartialTotal: boolean,
  marginPercent: number | null
): QuoteReadiness {
  const blockers: string[] = []
  if (lineCount === 0) blockers.push("Nincs tétel az árajánlatban")
  if (unpricedCount > 0) blockers.push(`${unpricedCount} tétel még árazatlan`)
  if (unappliedSubmissionCount > 0) {
    blockers.push(
      `${unappliedSubmissionCount} alvállalkozói válasz még nincs beírva`
    )
  }
  if (!isPartialTotal && marginPercent != null && marginPercent < getMinAcceptableMarginPercent()) {
    blockers.push(
      `Fedezet alacsony (${marginPercent}% — minimum ${getMinAcceptableMarginPercent()}%)`
    )
  }

  const canSend = blockers.length === 0
  return {
    canSend,
    canExportPdf: canSend,
    blockers,
  }
}

export function buildQuoteSummary(
  quote: Quote,
  lines: QuoteLine[],
  rfqs: SubcontractorRfq[],
  submissions: SubcontractorRfqSubmission[],
  invitations: RfqInvitation[] = []
): QuoteSummary {
  const lineCount = lines.length
  const unpricedCount = countUnpricedLines(lines)
  const pricedCount = lineCount - unpricedCount
  const rfqPendingCount = lines.filter((l) => l.pricingStatus === "rfq_pending").length
  const unpricedNotRfqCount = lines.filter(
    (l) => !isLineCosted(l) && l.pricingStatus !== "rfq_pending"
  ).length
  const subcontractorCount = lines.filter((l) => l.costSource === "subcontractor").length

  const cost = quoteCostTotals(lines)
  const sell = quoteSellTotals(lines, quote)

  const costTotal = cost.total
  const sellTotal = sell.total
  const marginTotal = sellTotal - costTotal
  const isPartialTotal = unpricedCount > 0
  const totalsCalculable = lineCount > 0 && costTotal > 0
  const marginPercent = totalsCalculable
    ? Math.round((marginTotal / costTotal) * 100)
    : lineCount > 0 && !isPartialTotal && costTotal === 0
      ? 0
      : null

  const sortedSubs = [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )
  const { count: unappliedSubmissionCount, ids: unappliedSubmissionIds } =
    countUnappliedSubmissions(rfqs, sortedSubs, lines)

  const rfqSubmissionCount = submissions.length
  const rfqAwaitingCount = invitations.filter((i) => i.status === "invited").length

  const readiness = buildReadiness(
    lineCount,
    unpricedCount,
    unappliedSubmissionCount,
    isPartialTotal,
    marginPercent
  )

  return {
    lineCount,
    pricedCount,
    unpricedCount,
    unpricedNotRfqCount,
    subcontractorCount,
    rfqPendingCount,
    costTotal,
    sellTotal,
    marginTotal,
    marginPercent,
    isPartialTotal,
    totalsCalculable,
    pricedPercent: lineCount > 0 ? Math.round((pricedCount / lineCount) * 100) : 0,
    rfqCount: rfqs.length,
    rfqSubmissionCount,
    rfqAwaitingCount,
    unappliedSubmissionCount,
    unappliedSubmissionIds,
    tradeStats: buildTradeStats(lines),
    readiness,
    lastActivityLabel: buildLastActivityLabel(quote, sortedSubs),
  }
}

/** Első szakág ahol van árazatlan tétel (legtöbb), különben első szakág tételekkel */
export function pickDefaultRfqTrade(lines: QuoteLine[]): Trade {
  const unpriced = lines.filter((l) => !isLineCosted(l))
  const pool = unpriced.length > 0 ? unpriced : lines
  if (pool.length === 0) return "epitomester"

  const counts = new Map<Trade, number>()
  for (const line of pool) {
    counts.set(line.trade, (counts.get(line.trade) ?? 0) + 1)
  }
  let best: Trade = pool[0].trade
  let bestN = 0
  for (const [trade, n] of counts) {
    if (n > bestN) {
      best = trade
      bestN = n
    }
  }
  return best
}

export function getRfqTitleForTrade(trade: Trade): string {
  return `${getTradeLabel(trade)} ajánlatkérés`
}

/** Elfogadott ajánlat, vagy ha nincs, legutóbbi piszkozat / elküldött */
export function resolveActiveQuoteId(quotes: Quote[]): string | null {
  const accepted = quotes.find((q) => q.status === "accepted")
  if (accepted) return accepted.id
  const working = quotes.find((q) => q.status === "draft" || q.status === "sent")
  return working?.id ?? null
}
