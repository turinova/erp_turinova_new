import type { Quote, QuoteLine, QuoteScope, QuoteStatus, ProjectDataBundle } from "@/types/projects"
import type { Trade } from "@/types"
import { getTradeLabel } from "@/lib/trades"
import type { QuoteSummary } from "@/lib/quote-summary"
import { buildQuoteSummary } from "@/lib/quote-summary"
import {
  calcQuoteVatTotals,
  resolveQuoteVatMode,
  type QuoteVatTotals,
} from "@/lib/quote-client-summary"
import {
  bundleInvitationsForQuote,
  bundleQuoteLines,
  bundleQuotesForProject,
  bundleRfqsForQuote,
  bundleSubmissionsForQuote,
} from "@/lib/project-bundle-queries"
import {
  listInvitationsForQuote,
  listQuoteLines,
  listQuotesForProject,
  listRfqsForQuote,
  listSubmissionsForQuote,
} from "@/lib/data/projects-store"

export type QuoteWithSummary = {
  quote: Quote
  summary: QuoteSummary
  lines: QuoteLine[]
  scope: QuoteScope
  primaryTrade: Trade | null
}

/** Elküldött / elfogadott — ezek számítanak a bruttó projektbe */
const READY_STATUSES: QuoteStatus[] = ["sent", "accepted"]

export type ProjectTradeOverviewRow = {
  trade: Trade
  label: string
  quote: Quote
  summary: QuoteSummary
  status: QuoteStatus
  grossTotal: number
  pricedPercent: number
  countsInProjectTotal: boolean
  note: string | null
}

export type ProjectAggregatedTotals = {
  mode: "ready" | "empty"
  modeLabel: string
  selected: QuoteWithSummary[]
  draftQuoteCount: number
  warnings: string[]
  sellNetTotal: number
  grossTotal: number
  costTotal: number
  marginTotal: number
  marginPercent: number | null
  isPartialTotal: boolean
  lineCount: number
  pricedCount: number
  unpricedCount: number
  rfqPendingCount: number
  unpricedNotRfqCount: number
  pricedPercent: number
  canSend: boolean
  blockers: string[]
  mixedVat: boolean
  vatChipLabel: string
}

const STATUS_RANK: Record<QuoteStatus, number> = {
  accepted: 4,
  sent: 3,
  draft: 2,
  rejected: 1,
  archived: 0,
}

export function pickBetterQuote(a: Quote, b: Quote): Quote {
  const dr = STATUS_RANK[b.status] - STATUS_RANK[a.status]
  if (dr !== 0) return dr > 0 ? b : a
  return new Date(b.updatedAt) > new Date(a.updatedAt) ? b : a
}

export function inferQuoteScope(quote: Quote, lines: QuoteLine[]): QuoteScope {
  if (quote.quoteScope) return quote.quoteScope
  if (quote.supersedesQuoteId) return "version"
  return "trade"
}

export function inferPrimaryTrade(quote: Quote, lines: QuoteLine[]): Trade | null {
  if (quote.primaryTrade) return quote.primaryTrade
  if (lines.length === 0) return null

  const counts = new Map<Trade, number>()
  for (const line of lines) {
    counts.set(line.trade, (counts.get(line.trade) ?? 0) + 1)
  }
  let best: Trade = lines[0].trade
  let bestN = 0
  for (const [trade, n] of counts) {
    if (n > bestN) {
      best = trade
      bestN = n
    }
  }
  return best
}

export function buildQuoteWithSummary(quote: Quote): QuoteWithSummary {
  const lines = listQuoteLines(quote.id)
  const rfqs = listRfqsForQuote(quote.id)
  const subs = listSubmissionsForQuote(quote.id)
  const invitations = listInvitationsForQuote(quote.id)
  const summary = buildQuoteSummary(quote, lines, rfqs, subs, invitations)
  const scope = inferQuoteScope(quote, lines)
  const primaryTrade = inferPrimaryTrade(quote, lines)
  return { quote, summary, lines, scope, primaryTrade }
}

export function buildQuoteWithSummaryFromBundle(
  quote: Quote,
  bundle: ProjectDataBundle
): QuoteWithSummary {
  const lines = bundleQuoteLines(bundle, quote.id)
  const rfqs = bundleRfqsForQuote(bundle, quote.id)
  const subs = bundleSubmissionsForQuote(bundle, quote.id)
  const invitations = bundleInvitationsForQuote(bundle, quote.id)
  const summary = buildQuoteSummary(quote, lines, rfqs, subs, invitations)
  const scope = inferQuoteScope(quote, lines)
  const primaryTrade = inferPrimaryTrade(quote, lines)
  return { quote, summary, lines, scope, primaryTrade }
}

export function listActiveQuoteHeadsFromBundle(
  projectId: string,
  bundle: ProjectDataBundle
): QuoteWithSummary[] {
  const quotes = bundleQuotesForProject(bundle, projectId).filter(
    (q) => q.status !== "archived" && q.status !== "rejected"
  )
  return resolveVersionHeads(quotes.map((q) => buildQuoteWithSummaryFromBundle(q, bundle)))
}

function selectReadyQuotesFromBundle(
  projectId: string,
  bundle: ProjectDataBundle
): {
  selected: QuoteWithSummary[]
  warnings: string[]
  draftQuoteCount: number
} {
  const heads = listActiveQuoteHeadsFromBundle(projectId, bundle)
  const selected = heads.filter((r) => READY_STATUSES.includes(r.quote.status))
  const draftQuoteCount = heads.filter((r) => r.quote.status === "draft").length
  const warnings: string[] = []

  const readyByTrade = new Map<Trade, QuoteWithSummary[]>()
  for (const row of selected) {
    const trade = resolveQuoteTrade(row)
    if (!trade) continue
    const list = readyByTrade.get(trade) ?? []
    list.push(row)
    readyByTrade.set(trade, list)
  }

  for (const [trade, rows] of readyByTrade) {
    if (rows.length > 1) {
      warnings.push(
        `${getTradeLabel(trade)}: ${rows.length} kész ajánlat — ellenőrizd, mind számítson-e`
      )
    }
  }

  if (selected.length === 0 && draftQuoteCount > 0) {
    warnings.push(
      `${draftQuoteCount} piszkozat ajánlat még nem számít bele — állítsd „Elküldve” vagy „Elfogadva” státuszra`
    )
  }

  return { selected, warnings, draftQuoteCount }
}

export function resolveVersionHeads(rows: QuoteWithSummary[]): QuoteWithSummary[] {
  const superseded = new Set(
    rows.map((r) => r.quote.supersedesQuoteId).filter((id): id is string => !!id)
  )
  const heads = rows.filter((r) => !superseded.has(r.quote.id))

  const byRoot = new Map<string, QuoteWithSummary[]>()
  for (const row of heads) {
    let rootId = row.quote.id
    let cur = row.quote
    while (cur.supersedesQuoteId) {
      const parent = rows.find((r) => r.quote.id === cur.supersedesQuoteId)
      if (!parent) break
      rootId = parent.quote.id
      cur = parent.quote
    }
    const list = byRoot.get(rootId) ?? []
    list.push(row)
    byRoot.set(rootId, list)
  }

  const result: QuoteWithSummary[] = []
  for (const group of byRoot.values()) {
    const nonArchived = group.filter((r) => r.quote.status !== "archived")
    const pool = nonArchived.length > 0 ? nonArchived : group
    result.push(
      pool.reduce((best, r) => (pickBetterQuote(r.quote, best.quote) === r.quote ? r : best))
    )
  }
  return result
}

function resolveQuoteTrade(row: QuoteWithSummary): Trade | null {
  return row.primaryTrade ?? inferPrimaryTrade(row.quote, row.lines)
}

export function listActiveQuoteHeads(projectId: string): QuoteWithSummary[] {
  const quotes = listQuotesForProject(projectId).filter(
    (q) => q.status !== "archived" && q.status !== "rejected"
  )
  return resolveVersionHeads(quotes.map(buildQuoteWithSummary))
}

function selectReadyQuotes(projectId: string): {
  selected: QuoteWithSummary[]
  warnings: string[]
  draftQuoteCount: number
} {
  const heads = listActiveQuoteHeads(projectId)
  const selected = heads.filter((r) => READY_STATUSES.includes(r.quote.status))
  const draftQuoteCount = heads.filter((r) => r.quote.status === "draft").length
  const warnings: string[] = []

  const readyByTrade = new Map<Trade, QuoteWithSummary[]>()
  for (const row of selected) {
    const trade = resolveQuoteTrade(row)
    if (!trade) continue
    const list = readyByTrade.get(trade) ?? []
    list.push(row)
    readyByTrade.set(trade, list)
  }

  for (const [trade, rows] of readyByTrade) {
    if (rows.length > 1) {
      warnings.push(
        `${getTradeLabel(trade)}: ${rows.length} kész ajánlat — ellenőrizd, mind számítson-e`
      )
    }
  }

  if (selected.length === 0 && draftQuoteCount > 0) {
    warnings.push(
      `${draftQuoteCount} piszkozat ajánlat még nem számít bele — állítsd „Elküldve” vagy „Elfogadva” státuszra`
    )
  }

  return { selected, warnings, draftQuoteCount }
}

function aggregateSummaries(
  selected: QuoteWithSummary[]
): Omit<
  ProjectAggregatedTotals,
  | "mode"
  | "modeLabel"
  | "selected"
  | "warnings"
  | "draftQuoteCount"
  | "mixedVat"
  | "vatChipLabel"
> {
  let sellNetTotal = 0
  let grossTotal = 0
  let costTotal = 0
  let lineCount = 0
  let pricedCount = 0
  let unpricedCount = 0
  let rfqPendingCount = 0
  let unpricedNotRfqCount = 0
  let isPartialTotal = false
  const blockers: string[] = []

  for (const { quote, summary } of selected) {
    sellNetTotal += summary.sellTotal
    costTotal += summary.costTotal
    grossTotal += calcQuoteVatTotals(summary.sellTotal, resolveQuoteVatMode(quote)).grossTotal
    lineCount += summary.lineCount
    pricedCount += summary.pricedCount
    unpricedCount += summary.unpricedCount
    rfqPendingCount += summary.rfqPendingCount
    unpricedNotRfqCount += summary.unpricedNotRfqCount
    if (summary.isPartialTotal) isPartialTotal = true
    for (const b of summary.readiness.blockers) {
      blockers.push(`${quote.title}: ${b}`)
    }
  }

  const marginTotal = sellNetTotal - costTotal
  const marginPercent =
    costTotal > 0 && lineCount > 0 ? Math.round((marginTotal / costTotal) * 100) : null

  const seenBlockers = [...new Set(blockers)]
  const canSend = selected.length > 0 && selected.every((s) => s.summary.readiness.canSend)

  return {
    sellNetTotal,
    grossTotal,
    costTotal,
    marginTotal,
    marginPercent,
    isPartialTotal,
    lineCount,
    pricedCount,
    unpricedCount,
    rfqPendingCount,
    unpricedNotRfqCount,
    pricedPercent: lineCount > 0 ? Math.round((pricedCount / lineCount) * 100) : 0,
    canSend,
    blockers: seenBlockers,
  }
}

function buildModeLabel(
  mode: ProjectAggregatedTotals["mode"],
  selected: QuoteWithSummary[],
  draftQuoteCount: number
): string {
  if (mode === "empty") {
    return draftQuoteCount > 0
      ? "Még nincs kész ajánlat (elküldött / elfogadva)"
      : "Nincs kész ajánlat"
  }
  return `${selected.length} kész ajánlat összege`
}

function resolveVatChip(selected: QuoteWithSummary[]): { mixedVat: boolean; vatChipLabel: string } {
  if (selected.length === 0) return { mixedVat: false, vatChipLabel: "27% ÁFA" }
  const modes = new Set(selected.map((s) => resolveQuoteVatMode(s.quote)))
  if (modes.size > 1) return { mixedVat: true, vatChipLabel: "Vegyes ÁFA" }
  const mode = resolveQuoteVatMode(selected[0].quote)
  if (mode === "aam") return { mixedVat: false, vatChipLabel: "AAM" }
  if (mode === "reverse_charge") return { mixedVat: false, vatChipLabel: "Fordított adózás" }
  const rate = mode === "reduced" ? 5 : 27
  return { mixedVat: false, vatChipLabel: `${rate}% ÁFA` }
}

const EMPTY_TOTALS: ProjectAggregatedTotals = {
  mode: "empty",
  modeLabel: "Nincs kész ajánlat",
  selected: [],
  draftQuoteCount: 0,
  warnings: [],
  sellNetTotal: 0,
  grossTotal: 0,
  costTotal: 0,
  marginTotal: 0,
  marginPercent: null,
  isPartialTotal: false,
  lineCount: 0,
  pricedCount: 0,
  unpricedCount: 0,
  rfqPendingCount: 0,
  unpricedNotRfqCount: 0,
  pricedPercent: 0,
  canSend: false,
  blockers: [],
  mixedVat: false,
  vatChipLabel: "27% ÁFA",
}

export function buildProjectAggregatedTotals(projectId: string): ProjectAggregatedTotals {
  const { selected, warnings, draftQuoteCount } = selectReadyQuotes(projectId)
  if (selected.length === 0) {
    return { ...EMPTY_TOTALS, warnings, draftQuoteCount, modeLabel: buildModeLabel("empty", [], draftQuoteCount) }
  }

  const agg = aggregateSummaries(selected)
  const { mixedVat, vatChipLabel } = resolveVatChip(selected)

  return {
    mode: "ready",
    modeLabel: buildModeLabel("ready", selected, draftQuoteCount),
    selected,
    draftQuoteCount,
    warnings,
    ...agg,
    mixedVat,
    vatChipLabel,
  }
}

export function buildProjectAggregatedTotalsFromBundle(
  projectId: string,
  bundle: ProjectDataBundle
): ProjectAggregatedTotals {
  const { selected, warnings, draftQuoteCount } = selectReadyQuotesFromBundle(projectId, bundle)
  if (selected.length === 0) {
    return { ...EMPTY_TOTALS, warnings, draftQuoteCount, modeLabel: buildModeLabel("empty", [], draftQuoteCount) }
  }

  const agg = aggregateSummaries(selected)
  const { mixedVat, vatChipLabel } = resolveVatChip(selected)

  return {
    mode: "ready",
    modeLabel: buildModeLabel("ready", selected, draftQuoteCount),
    selected,
    draftQuoteCount,
    warnings,
    ...agg,
    mixedVat,
    vatChipLabel,
  }
}

export function buildProjectTradeOverviewRows(projectId: string): ProjectTradeOverviewRow[] {
  const heads = listActiveQuoteHeads(projectId)
  const rows: ProjectTradeOverviewRow[] = []

  for (const row of heads) {
    const trade = resolveQuoteTrade(row)
    if (!trade) continue
    const countsInProjectTotal = READY_STATUSES.includes(row.quote.status)
    rows.push({
      trade,
      label: getTradeLabel(trade),
      quote: row.quote,
      summary: row.summary,
      status: row.quote.status,
      grossTotal: calcQuoteVatTotals(
        row.summary.sellTotal,
        resolveQuoteVatMode(row.quote)
      ).grossTotal,
      pricedPercent: row.summary.pricedPercent,
      countsInProjectTotal,
      note: countsInProjectTotal ? null : "Nem számít a bruttóba (piszkozat)",
    })
  }

  return rows.sort((a, b) => a.label.localeCompare(b.label, "hu"))
}

export function buildAggregatedVatTotals(totals: ProjectAggregatedTotals): QuoteVatTotals | null {
  if (totals.selected.length === 0) return null
  return {
    netTotal: totals.sellNetTotal,
    vatAmount: totals.grossTotal - totals.sellNetTotal,
    grossTotal: totals.grossTotal,
    vatLabel: totals.vatChipLabel,
    vatNote: totals.mixedVat ? "Több ajánlat eltérő ÁFA móddal." : null,
    showVatAmount: !totals.mixedVat,
  }
}

/** Összes aktív szakág (piszkozat is) — áttekintés KPI-hoz */
export function buildProjectAllQuotesTotals(projectId: string): ProjectAggregatedTotals {
  const rows = listQuotesForProject(projectId)
    .filter((q) => q.status !== "archived")
    .map(buildQuoteWithSummary)

  if (rows.length === 0) {
    return { ...EMPTY_TOTALS, modeLabel: "Nincs költségvetés" }
  }

  const agg = aggregateSummaries(rows)
  const { mixedVat, vatChipLabel } = resolveVatChip(rows)
  const draftQuoteCount = rows.filter((r) => r.quote.status === "draft").length

  return {
    mode: "ready",
    modeLabel: `${rows.length} szakág összesen`,
    selected: rows,
    draftQuoteCount,
    warnings: [],
    mixedVat,
    vatChipLabel,
    ...agg,
  }
}
