import type {
  CompositionSelection,
  CustomerPackage,
  CustomerPackageSnapshot,
  CustomerPackageSnapshotLine,
  CustomerPackageStatus,
  ProjectComposition,
  Quote,
} from "@/types/projects"
import type { Trade } from "@/types"
import { unitMap } from "@/lib/data/units-store"
import { getTradeLabel } from "@/lib/trades"
import type { QuoteWithSummary } from "@/lib/project-quote-aggregation"
import {
  calcQuoteVatTotals,
  quoteVatChipLabel,
  resolveQuoteVatMode,
} from "@/lib/quote-client-summary"
import { lineSellTotal } from "@/lib/quote-pricing"

export const CUSTOMER_PACKAGE_STATUS_LABELS: Record<CustomerPackageStatus, string> = {
  draft: "Piszkozat",
  sent: "Elküldve",
  accepted: "Elfogadva",
  rejected: "Elutasítva",
  superseded: "Felülírva",
}

export const CUSTOMER_PACKAGE_TYPE_LABELS: Record<CustomerPackage["type"], string> = {
  full: "Teljes ajánlat",
  supplement: "Kiegészítő",
}

export type CustomerPackageResponseType = "accept_all" | "reject_all" | "partial"

export type PackageSendPreview = {
  selections: CompositionSelection[]
  snapshots: CustomerPackageSnapshot[]
  sellNetTotal: number
  grossTotal: number
  mixedVat: boolean
  vatChipLabel: string
  blockers: string[]
  canSend: boolean
  quoteRows: {
    trade: Trade
    label: string
    quote: Quote
    summary: QuoteWithSummary["summary"]
    lineCount: number
  }[]
}

function rowByQuoteId(rows: QuoteWithSummary[], quoteId: string): QuoteWithSummary | undefined {
  return rows.find((r) => r.quote.id === quoteId)
}

export function buildSnapshotLines(
  row: QuoteWithSummary,
  lineIds?: string[]
): CustomerPackageSnapshotLine[] {
  const included = lineIds
    ? row.lines.filter((l) => lineIds.includes(l.id))
    : row.lines

  return included.map((line) => {
    const sellNetTotal = lineSellTotal(line, row.quote)
    const sellNetUnitPrice =
      line.quantity > 0 ? Math.round(sellNetTotal / line.quantity) : sellNetTotal
    return {
      lineId: line.id,
      identifier: line.identifierSnapshot,
      text: line.textSnapshot,
      unitLabel: unitMap[line.unitId]?.code ?? "db",
      quantity: line.quantity,
      sellNetUnitPrice,
      sellNetTotal,
    }
  })
}

function snapshotSellNetFromLines(lines: CustomerPackageSnapshotLine[]): number {
  return lines.reduce((sum, l) => sum + l.sellNetTotal, 0)
}

export function buildSnapshotForRow(
  row: QuoteWithSummary,
  trade: Trade,
  lineIds?: string[]
): CustomerPackageSnapshot {
  const lines = buildSnapshotLines(row, lineIds)
  const sellNetTotal =
    lines.length > 0 ? snapshotSellNetFromLines(lines) : row.summary.sellTotal
  const vatMode = resolveQuoteVatMode(row.quote)
  const vat = calcQuoteVatTotals(sellNetTotal, vatMode)
  return {
    trade,
    quoteId: row.quote.id,
    quoteTitle: row.quote.title,
    sellNetTotal,
    grossTotal: vat.grossTotal,
    vatMode,
    vatLabel: quoteVatChipLabel(row.quote),
    lineIds: lineIds ?? row.lines.map((l) => l.id),
    lines,
  }
}

/** Snapshot vs élő quote összeg eltérés (kézi rögzítés figyelmeztetéshez) */
export function packageSnapshotDrift(
  pkg: CustomerPackage,
  rows: QuoteWithSummary[]
): { hasDrift: boolean; details: string[] } {
  const details: string[] = []
  for (const snap of pkg.snapshots) {
    const row = rowByQuoteId(rows, snap.quoteId)
    if (!row) continue
    const liveGross = calcQuoteVatTotals(
      row.summary.sellTotal,
      resolveQuoteVatMode(row.quote)
    ).grossTotal
    if (Math.abs(liveGross - snap.grossTotal) > 1) {
      details.push(`${snap.quoteTitle}: a költségvetés összege megváltozott az elküldött ajánlathoz képest`)
    }
  }
  return { hasDrift: details.length > 0, details }
}

export function customerPackagePublicUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/ajanlat/${token}`
  }
  return `/ajanlat/${token}`
}

export function isCustomerPackageExpired(pkg: CustomerPackage): boolean {
  if (!pkg.expiresAt) return false
  return new Date(pkg.expiresAt).getTime() < Date.now()
}

/** Alapértelmezett összeállítás: szakágonként a legjobb aktív ajánlatfej */
export function buildDefaultCompositionSelections(heads: QuoteWithSummary[]): CompositionSelection[] {
  const byTrade = new Map<Trade, QuoteWithSummary>()

  for (const row of heads) {
    const trade = row.primaryTrade
    if (!trade) continue
    if (row.quote.status === "archived" || row.quote.status === "rejected") continue
    const existing = byTrade.get(trade)
    if (!existing) {
      byTrade.set(trade, row)
      continue
    }
    const prefer =
      row.summary.readiness.canSend && !existing.summary.readiness.canSend
        ? row
        : !row.summary.readiness.canSend && existing.summary.readiness.canSend
          ? existing
          : row
    byTrade.set(trade, prefer)
  }

  return [...byTrade.entries()].map(([trade, row]) => ({
    trade,
    quoteId: row.quote.id,
  }))
}

export function buildSnapshotsFromSelections(
  selections: CompositionSelection[],
  rows: QuoteWithSummary[]
): CustomerPackageSnapshot[] {
  return selections.map((sel) => {
    const row = rowByQuoteId(rows, sel.quoteId)
    if (!row) {
      return {
        trade: sel.trade,
        quoteId: sel.quoteId,
        quoteTitle: "—",
        sellNetTotal: 0,
        grossTotal: 0,
        lineIds: sel.lineIds,
        lines: [],
      }
    }
    return buildSnapshotForRow(row, sel.trade, sel.lineIds)
  })
}

export function buildPackagePreviewFromQuoteIds(
  projectId: string,
  quoteIds: string[],
  rows: QuoteWithSummary[]
): PackageSendPreview {
  const selections: CompositionSelection[] = []
  const blockers: string[] = []

  for (const quoteId of quoteIds) {
    const row = rowByQuoteId(rows, quoteId)
    if (!row) {
      blockers.push("A kiválasztott költségvetés nem található")
      continue
    }
    if (row.quote.projectId !== projectId) {
      blockers.push(`${row.quote.title}: más projekthez tartozik`)
      continue
    }
    if (row.quote.status === "archived") {
      blockers.push(`${row.quote.title}: archivált`)
      continue
    }
    const trade = row.primaryTrade
    if (!trade) {
      blockers.push(`${row.quote.title}: nincs szakág`)
      continue
    }
    selections.push({ trade, quoteId })
  }

  if (selections.length === 0) {
    return {
      selections: [],
      snapshots: [],
      sellNetTotal: 0,
      grossTotal: 0,
      mixedVat: false,
      vatChipLabel: "27% ÁFA",
      blockers: blockers.length > 0 ? blockers : ["Legalább egy költségvetést válassz ki"],
      canSend: false,
      quoteRows: [],
    }
  }

  return buildPackageSendPreview(projectId, selections, rows)
}

export function buildPackageSendPreview(
  projectId: string,
  selections: CompositionSelection[],
  rows: QuoteWithSummary[]
): PackageSendPreview {
  const quoteRows: PackageSendPreview["quoteRows"] = []
  const blockers: string[] = []
  let sellNetTotal = 0
  let grossTotal = 0
  const vatModes = new Set<string>()

  for (const sel of selections) {
    const row = rowByQuoteId(rows, sel.quoteId)
    if (!row) {
      blockers.push(`${getTradeLabel(sel.trade)}: az ajánlat nem található`)
      continue
    }
    if (row.quote.projectId !== projectId) {
      blockers.push(`${getTradeLabel(sel.trade)}: más projekthez tartozik`)
      continue
    }
    const includedLines = sel.lineIds
      ? row.lines.filter((l) => sel.lineIds!.includes(l.id))
      : row.lines

    if (includedLines.length === 0) {
      blockers.push(`${getTradeLabel(sel.trade)}: nincs tétel`)
    }

    for (const b of row.summary.readiness.blockers) {
      blockers.push(`${row.quote.title}: ${b}`)
    }

    sellNetTotal += row.summary.sellTotal
    const vatMode = resolveQuoteVatMode(row.quote)
    vatModes.add(vatMode)
    grossTotal += calcQuoteVatTotals(row.summary.sellTotal, vatMode).grossTotal

    quoteRows.push({
      trade: sel.trade,
      label: getTradeLabel(sel.trade),
      quote: row.quote,
      summary: row.summary,
      lineCount: includedLines.length,
    })
  }

  const mixedVat = vatModes.size > 1
  let vatChipLabel = "27% ÁFA"
  if (vatModes.size === 1) {
    const mode = [...vatModes][0]
    if (mode === "aam") vatChipLabel = "AAM"
    else if (mode === "reverse_charge") vatChipLabel = "Fordított adózás"
    else if (mode === "reduced") vatChipLabel = "5% ÁFA"
  } else if (mixedVat) {
    vatChipLabel = "Vegyes ÁFA"
  }

  const snapshots = buildSnapshotsFromSelections(selections, rows)
  const seenBlockers = [...new Set(blockers)]

  return {
    selections,
    snapshots,
    sellNetTotal,
    grossTotal,
    mixedVat,
    vatChipLabel,
    blockers: seenBlockers,
    canSend: selections.length > 0 && seenBlockers.length === 0,
    quoteRows,
  }
}

export function getActiveSentPackage(packages: CustomerPackage[]): CustomerPackage | null {
  const sent = packages
    .filter((p) => p.status === "sent")
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
  return sent[0] ?? null
}

export function packageTitleForProject(projectName: string, type: CustomerPackage["type"]): string {
  if (type === "supplement") return `${projectName} — kiegészítő ajánlat`
  return `${projectName} — teljes projektajánlat`
}

export function mergeComposition(
  stored: ProjectComposition | undefined,
  heads: QuoteWithSummary[]
): CompositionSelection[] {
  if (stored && stored.selections.length > 0) return stored.selections
  return buildDefaultCompositionSelections(heads)
}

/** Szakágonként elérhető ajánlatfejek a composition választóhoz */
export function groupQuoteHeadsByTrade(
  heads: QuoteWithSummary[]
): { trade: Trade; label: string; options: QuoteWithSummary[] }[] {
  const map = new Map<Trade, QuoteWithSummary[]>()
  for (const row of heads) {
    const trade = row.primaryTrade
    if (!trade) continue
    if (row.quote.status === "archived") continue
    const list = map.get(trade) ?? []
    list.push(row)
    map.set(trade, list)
  }
  return [...map.entries()]
    .map(([trade, options]) => ({
      trade,
      label: getTradeLabel(trade),
      options,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "hu"))
}
