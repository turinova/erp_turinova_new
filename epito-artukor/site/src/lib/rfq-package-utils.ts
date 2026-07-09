import type {
  Quote,
  QuoteLine,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { loadCostItems } from "@/lib/data/cost-items-store"
import { getBidLineTotal } from "@/lib/rfq-migration"
import { formatHuf } from "@/lib/pricing"
import { quoteCostTotals, quoteSellTotals } from "@/lib/quote-pricing"

export type RfqDashboardStats = {
  awaitingResponse: number
  newSubmissions: number
  pendingDecisions: number
  marginWarnings: number
}

export type RfqPackageContext = {
  pkg: SubcontractorRfq
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
}

export function buildRfqDashboardStats(
  packages: SubcontractorRfq[],
  invitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[]
): RfqDashboardStats {
  const openPackages = packages.filter((p) => p.status === "open")
  let awaitingResponse = 0
  let newSubmissions = 0
  let pendingDecisions = 0

  for (const pkg of openPackages) {
    const invs = invitations.filter((i) => i.packageId === pkg.id)
    const subs = submissions.filter((s) => s.rfqId === pkg.id)
    const submittedCount = invs.filter((i) => i.status === "submitted" || subs.some((s) => s.invitationId === i.id)).length
    awaitingResponse += invs.filter((i) => i.status === "invited").length
    newSubmissions += subs.filter((s) => {
      const inv = invs.find((i) => i.id === s.invitationId)
      return inv && (inv.status === "submitted" || inv.status === "invited")
    }).length
    if (subs.length > 0 && pkg.status !== "decided") pendingDecisions += 1
    void submittedCount
  }

  return {
    awaitingResponse,
    newSubmissions,
    pendingDecisions,
    marginWarnings: 0,
  }
}

export function getCatalogReferenceForLine(line: QuoteLine): { material: number; labor: number } | null {
  if (!line.costItemId) return null
  const item = loadCostItems().find((c) => c.id === line.costItemId)
  if (!item) return null
  return { material: item.materialUnitPrice, labor: item.laborUnitPrice }
}

export function getLineCatalogTotal(line: QuoteLine): number {
  const ref = getCatalogReferenceForLine(line)
  if (!ref) return 0
  return Math.round((ref.material + ref.labor) * line.quantity)
}

export function getCatalogRefLabel(line: QuoteLine): string {
  const ref = getCatalogReferenceForLine(line)
  if (!ref) return "—"
  return `${formatHuf(ref.material)} + ${formatHuf(ref.labor)} / egység`
}

export function getSubmissionBidForLine(
  submission: SubcontractorRfqSubmission | undefined,
  rfqLineId: string
) {
  return submission?.lineBids.find((b) => b.rfqLineId === rfqLineId)
}

export function getInvitationSubmission(
  invitationId: string,
  submissions: SubcontractorRfqSubmission[]
): SubcontractorRfqSubmission | undefined {
  return submissions.find((s) => s.invitationId === invitationId)
}

export function computePackageSubmissionTotal(
  submission: SubcontractorRfqSubmission,
  pkg: SubcontractorRfq
): number {
  let total = 0
  for (const rfl of pkg.lines) {
    const bid = getSubmissionBidForLine(submission, rfl.id)
    if (!bid || bid.declined) continue
    total += getBidLineTotal(bid, rfl.quantity)
  }
  return total
}

export function countPricedLinesInSubmission(
  submission: SubcontractorRfqSubmission,
  pkg: SubcontractorRfq
): number {
  return pkg.lines.filter((rfl) => {
    const bid = getSubmissionBidForLine(submission, rfl.id)
    return bid && !bid.declined && (bid.materialUnitPrice > 0 || bid.laborUnitPrice > 0 || (bid.unitPrice ?? 0) > 0)
  }).length
}

export function previewMarginAfterSelections(
  quote: Quote,
  lines: QuoteLine[],
  pkg: SubcontractorRfq,
  selections: Map<string, { invitationId: string; submission: SubcontractorRfqSubmission }>
): { costTotal: number; sellTotal: number; marginPercent: number | null } {
  const patched = lines.map((line) => {
    const sel = selections.get(line.id)
    if (!sel) return line
    const rfl = pkg.lines.find((l) => l.quoteLineId === line.id)
    if (!rfl) return line
    const bid = getSubmissionBidForLine(sel.submission, rfl.id)
    if (!bid || bid.declined) return line
    const mat = bid.materialUnitPrice ?? 0
    const lab = bid.laborUnitPrice ?? bid.unitPrice ?? 0
    return {
      ...line,
      costMaterialUnitPrice: mat,
      costLaborUnitPrice: lab,
      pricingStatus: "costed" as const,
      costSource: "subcontractor" as const,
    }
  })
  const cost = quoteCostTotals(patched)
  const sell = quoteSellTotals(patched, quote)
  const marginPercent =
    cost.total > 0 ? Math.round(((sell.total - cost.total) / cost.total) * 100) : null
  return { costTotal: cost.total, sellTotal: sell.total, marginPercent }
}

export function findCheapestInvitationForLine(
  pkg: SubcontractorRfq,
  rfqLineId: string,
  invitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[]
): string | null {
  const rfl = pkg.lines.find((l) => l.id === rfqLineId)
  if (!rfl) return null
  let bestId: string | null = null
  let bestTotal = Infinity
  for (const inv of invitations) {
    const sub = getInvitationSubmission(inv.id, submissions)
    if (!sub) continue
    const bid = getSubmissionBidForLine(sub, rfqLineId)
    if (!bid || bid.declined) continue
    const total = getBidLineTotal(bid, rfl.quantity)
    if (total > 0 && total < bestTotal) {
      bestTotal = total
      bestId = inv.id
    }
  }
  return bestId
}
