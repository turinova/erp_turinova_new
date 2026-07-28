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

/** Ennyivel drágább a legolcsóbbnál → amber figyelmeztetés */
export const RFQ_EXPENSIVE_RATIO = 0.15

export type RfqLineFilter = "all" | "differs" | "missing" | "catalog_diff"

export type RfqLineBidCell = {
  invitationId: string
  lineTotal: number | null
  materialTotal: number
  laborTotal: number
  materialUnit: number
  laborUnit: number
  declined: boolean
  /** Legolcsóbb sorösszeg */
  isCheapest: boolean
  isCheapestMaterial: boolean
  isCheapestLabor: boolean
  /** >15% a legolcsóbb anyag egységárnál */
  isExpensiveMaterial: boolean
  isExpensiveLabor: boolean
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
  /** Ártükör / költségvetés egységár */
  costMaterialUnit: number
  costLaborUnit: number
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

function markUnitCheapest(
  units: { invitationId: string; unit: number }[]
): {
  cheapestId: string | null
  cheapest: number
} {
  const priced = units.filter((u) => u.unit > 0)
  if (priced.length === 0) return { cheapestId: null, cheapest: 0 }
  let cheapest = Infinity
  let cheapestId: string | null = null
  for (const u of priced) {
    if (u.unit < cheapest) {
      cheapest = u.unit
      cheapestId = u.invitationId
    }
  }
  return { cheapestId, cheapest }
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

    const rawBids = submittedInvitations.map((inv) => {
      const sub = getInvitationSubmission(inv.id, submissions)
      const bid = sub ? getSubmissionBidForLine(sub, rfl.id) : undefined
      const declined = bid?.declined ?? true
      const materialUnit = declined ? 0 : (bid?.materialUnitPrice ?? 0)
      const laborUnit = declined ? 0 : (bid?.laborUnitPrice ?? bid?.unitPrice ?? 0)
      const materialTotal = declined ? 0 : Math.round(materialUnit * rfl.quantity)
      const laborTotal = declined ? 0 : Math.round(laborUnit * rfl.quantity)
      const lineTotal = declined || !bid ? null : getBidLineTotal(bid, rfl.quantity)
      return {
        invitationId: inv.id,
        lineTotal: lineTotal && lineTotal > 0 ? lineTotal : null,
        materialTotal,
        laborTotal,
        materialUnit,
        laborUnit,
        declined,
      }
    })

    const matMark = markUnitCheapest(
      rawBids.map((b) => ({ invitationId: b.invitationId, unit: b.materialUnit }))
    )
    const labMark = markUnitCheapest(
      rawBids.map((b) => ({ invitationId: b.invitationId, unit: b.laborUnit }))
    )

    const bids: RfqLineBidCell[] = rawBids.map((b) => {
      const isCheapestMaterial =
        matMark.cheapestId === b.invitationId && b.materialUnit > 0
      const isCheapestLabor = labMark.cheapestId === b.invitationId && b.laborUnit > 0
      const isExpensiveMaterial =
        !isCheapestMaterial &&
        b.materialUnit > 0 &&
        matMark.cheapest > 0 &&
        b.materialUnit > matMark.cheapest * (1 + RFQ_EXPENSIVE_RATIO)
      const isExpensiveLabor =
        !isCheapestLabor &&
        b.laborUnit > 0 &&
        labMark.cheapest > 0 &&
        b.laborUnit > labMark.cheapest * (1 + RFQ_EXPENSIVE_RATIO)

      return {
        ...b,
        isCheapest: b.invitationId === cheapestInv && b.lineTotal != null && b.lineTotal > 0,
        isCheapestMaterial,
        isCheapestLabor,
        isExpensiveMaterial,
        isExpensiveLabor,
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

    const qty = rfl.quantity > 0 ? rfl.quantity : 1
    const costMaterialTotal = ql ? lineCostMaterialTotal(ql) : 0
    const costLaborTotal = ql ? lineCostLaborTotal(ql) : 0

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
      costMaterialUnit: Math.round(costMaterialTotal / qty),
      costLaborUnit: Math.round(costLaborTotal / qty),
      costMaterialTotal,
      costLaborTotal,
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
