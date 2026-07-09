import type {
  QuoteLine,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { loadCostItems } from "@/lib/data/cost-items-store"
import { getBidLineTotal } from "@/lib/rfq-migration"
import {
  buildCostItemMap,
  buildLineSectionNumbers,
  getLineInternalIdentifier,
} from "@/lib/quote-line-display"
import {
  computePackageSubmissionTotal,
  findCheapestInvitationForLine,
  getInvitationSubmission,
  getLineCatalogTotal,
  getSubmissionBidForLine,
} from "@/lib/rfq-package-utils"
import {
  lineCostLaborTotal,
  lineCostMaterialTotal,
  lineCostTotal,
} from "@/lib/quote-pricing"

export type RfqLineFilter = "all" | "differs" | "missing" | "catalog_diff"

export type RfqLineBidCell = {
  invitationId: string
  lineTotal: number | null
  materialTotal: number
  laborTotal: number
  declined: boolean
  isCheapest: boolean
}

export type RfqComparisonRow = {
  rfqLineId: string
  quoteLineId: string | null
  rowIndex: number
  sectionNumber: string
  identifier: string
  text: string
  quantity: number
  unitCode: string
  costMaterialTotal: number
  costLaborTotal: number
  costTotal: number
  catalogTotal: number
  bids: RfqLineBidCell[]
  hasMissingBid: boolean
  hasBidDifference: boolean
  hasCatalogDifference: boolean
}

export type RfqPackageKpis = {
  cheapestTotal: number | null
  highestTotal: number | null
  spread: number | null
  pricedLineCount: number
  totalLines: number
  missingBidCount: number
  differsCount: number
}

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase()
}

export function buildRfqComparisonRows(
  pkg: SubcontractorRfq,
  quoteLines: QuoteLine[],
  submittedInvitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[],
  quoteLineOrder: Map<string, number>
): RfqComparisonRow[] {
  const costItemById = buildCostItemMap(loadCostItems())
  const sectionNumbers = buildLineSectionNumbers(quoteLines)

  return pkg.lines.map((rfl, idx) => {
    const ql = quoteLines.find((l) => l.id === rfl.quoteLineId)
    const catalogTotal = ql ? getLineCatalogTotal(ql) : 0
    const cheapestInv = findCheapestInvitationForLine(
      pkg,
      rfl.id,
      submittedInvitations,
      submissions
    )

    const bids: RfqLineBidCell[] = submittedInvitations.map((inv) => {
      const sub = getInvitationSubmission(inv.id, submissions)
      const bid = sub ? getSubmissionBidForLine(sub, rfl.id) : undefined
      const declined = bid?.declined ?? true
      const matUnit = bid?.materialUnitPrice ?? 0
      const labUnit = bid?.laborUnitPrice ?? bid?.unitPrice ?? 0
      const materialTotal = declined ? 0 : Math.round(matUnit * rfl.quantity)
      const laborTotal = declined ? 0 : Math.round(labUnit * rfl.quantity)
      const lineTotal = declined ? null : getBidLineTotal(bid!, rfl.quantity)
      return {
        invitationId: inv.id,
        lineTotal: lineTotal && lineTotal > 0 ? lineTotal : null,
        materialTotal,
        laborTotal,
        declined,
        isCheapest: inv.id === cheapestInv && lineTotal != null && lineTotal > 0,
      }
    })

    const pricedTotals = bids
      .map((b) => b.lineTotal)
      .filter((t): t is number => t != null && t > 0)
    const hasMissingBid =
      submittedInvitations.length > 0 &&
      bids.some((b) => b.lineTotal == null && !b.declined)
    const hasBidDifference =
      pricedTotals.length >= 2 && Math.min(...pricedTotals) !== Math.max(...pricedTotals)
    const hasCatalogDifference =
      catalogTotal > 0 &&
      pricedTotals.some((t) => Math.abs(t - catalogTotal) / catalogTotal > 0.1)

    const order =
      rfl.quoteLineId != null ? (quoteLineOrder.get(rfl.quoteLineId) ?? idx) : idx

    return {
      rfqLineId: rfl.id,
      quoteLineId: rfl.quoteLineId ?? null,
      rowIndex: order,
      sectionNumber: ql
        ? (sectionNumbers.get(ql.id) ?? String(order + 1))
        : String(order + 1),
      identifier: ql ? getLineInternalIdentifier(ql, costItemById) : "—",
      text: ql?.textSnapshot ?? rfl.text,
      quantity: rfl.quantity,
      unitCode: rfl.unitId,
      costMaterialTotal: ql ? lineCostMaterialTotal(ql) : 0,
      costLaborTotal: ql ? lineCostLaborTotal(ql) : 0,
      costTotal: ql ? lineCostTotal(ql) : 0,
      catalogTotal,
      bids,
      hasMissingBid,
      hasBidDifference,
      hasCatalogDifference,
    }
  })
}

export function filterRfqComparisonRows(
  rows: RfqComparisonRow[],
  search: string,
  filter: RfqLineFilter
): RfqComparisonRow[] {
  const q = normalizeSearch(search)
  return rows.filter((row) => {
    if (q) {
      const hay = `${row.identifier} ${row.text}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    switch (filter) {
      case "differs":
        return row.hasBidDifference
      case "missing":
        return row.hasMissingBid || row.bids.every((b) => b.lineTotal == null)
      case "catalog_diff":
        return row.hasCatalogDifference
      default:
        return true
    }
  })
}

export function buildRfqPackageKpis(
  pkg: SubcontractorRfq,
  submittedInvitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[],
  rows: RfqComparisonRow[]
): RfqPackageKpis {
  const totals = submittedInvitations
    .map((inv) => {
      const sub = getInvitationSubmission(inv.id, submissions)
      return sub ? computePackageSubmissionTotal(sub, pkg) : 0
    })
    .filter((t) => t > 0)

  const cheapestTotal = totals.length > 0 ? Math.min(...totals) : null
  const highestTotal = totals.length > 0 ? Math.max(...totals) : null
  const spread =
    cheapestTotal != null && highestTotal != null ? highestTotal - cheapestTotal : null

  return {
    cheapestTotal,
    highestTotal,
    spread,
    pricedLineCount: rows.filter((r) => r.bids.some((b) => b.lineTotal != null)).length,
    totalLines: rows.length,
    missingBidCount: rows.filter((r) => r.hasMissingBid || r.bids.every((b) => b.lineTotal == null))
      .length,
    differsCount: rows.filter((r) => r.hasBidDifference).length,
  }
}

export function sumColumnTotals(
  rows: RfqComparisonRow[],
  invitationId: string
): { material: number; labor: number; total: number } {
  let material = 0
  let labor = 0
  let total = 0
  for (const row of rows) {
    const bid = row.bids.find((b) => b.invitationId === invitationId)
    if (!bid || bid.lineTotal == null) continue
    material += bid.materialTotal
    labor += bid.laborTotal
    total += bid.lineTotal
  }
  return { material, labor, total }
}

export function sumCostTotals(rows: RfqComparisonRow[]): {
  material: number
  labor: number
  total: number
} {
  let material = 0
  let labor = 0
  let total = 0
  for (const row of rows) {
    material += row.costMaterialTotal
    labor += row.costLaborTotal
    total += row.costTotal
  }
  return { material, labor, total }
}
