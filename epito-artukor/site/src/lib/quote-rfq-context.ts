import type { QuoteLine, RfqInvitation, SubcontractorRfq, SubcontractorRfqSubmission } from "@/types/projects"
import { getBidLineTotal } from "@/lib/rfq-migration"
import {
  computePackageSubmissionTotal,
  findCheapestInvitationForLine,
  getInvitationSubmission,
  getSubmissionBidForLine,
} from "@/lib/rfq-package-utils"
import {
  getRfq,
  getSubmission,
  listInvitationsForPackage,
  listRfqsForQuote,
  listSubmissionsForPackage,
} from "@/lib/data/projects-store"

export type LineBidOffer = {
  invitationId: string
  submissionId: string
  subcontractorName: string
  materialUnitPrice: number
  laborUnitPrice: number
  materialTotal: number
  laborTotal: number
  lineTotal: number
  declined: boolean
  isCheapest: boolean
}

export type QuoteLineRfqContext = {
  packageId: string
  packageTitle: string
  packageStatus: SubcontractorRfq["status"]
  rfqLineId: string
  submissionCount: number
  invitedCount: number
  awaitingCount: number
  offers: LineBidOffer[]
  needsDecision: boolean
}

export type PendingRfqPackage = {
  pkg: SubcontractorRfq
  invitations: RfqInvitation[]
  submissions: SubcontractorRfqSubmission[]
  submissionCount: number
  needsDecision: boolean
  canChangeWinner: boolean
  winningInvitationId: string | null
  winningSubcontractorName: string | null
}

export function packageNeedsDecision(
  pkg: SubcontractorRfq,
  submissions: SubcontractorRfqSubmission[],
  quoteLines: QuoteLine[]
): boolean {
  if (pkg.status === "decided") return false
  if (submissions.length === 0) return false
  return pkg.lines.some((rfl) => {
    if (!rfl.quoteLineId) return false
    const ql = quoteLines.find((l) => l.id === rfl.quoteLineId)
    return ql != null && ql.costSourceRfqSubmissionId == null
  })
}

export function getWinningInvitationForPackage(
  pkg: SubcontractorRfq,
  invitations: RfqInvitation[],
  quoteLines: QuoteLine[]
): RfqInvitation | null {
  const accepted = invitations.find((i) => i.status === "accepted")
  if (accepted) return accepted

  for (const rfl of pkg.lines) {
    if (!rfl.quoteLineId) continue
    const ql = quoteLines.find((l) => l.id === rfl.quoteLineId)
    if (!ql?.costSourceRfqSubmissionId) continue
    const sub = getSubmission(ql.costSourceRfqSubmissionId)
    if (!sub) continue
    const inv = invitations.find((i) => i.id === sub.invitationId)
    if (inv) return inv
  }
  return null
}

function packageCanChangeWinner(
  pkg: SubcontractorRfq,
  submissions: SubcontractorRfqSubmission[],
  winningInvitationId: string | null
): boolean {
  if (pkg.status !== "decided") return false
  if (submissions.length < 2) return false
  if (!winningInvitationId) return false
  const alternatives = submissions.filter((s) => s.invitationId !== winningInvitationId)
  return alternatives.length > 0
}

function buildPackageSummary(
  pkg: SubcontractorRfq,
  quoteLines: QuoteLine[]
): PendingRfqPackage {
  const invitations = listInvitationsForPackage(pkg.id)
  const submissions = listSubmissionsForPackage(pkg.id)
  const winning = getWinningInvitationForPackage(pkg, invitations, quoteLines)
  return {
    pkg,
    invitations,
    submissions,
    submissionCount: submissions.length,
    needsDecision: packageNeedsDecision(pkg, submissions, quoteLines),
    canChangeWinner: packageCanChangeWinner(
      pkg,
      submissions,
      winning?.id ?? null
    ),
    winningInvitationId: winning?.id ?? null,
    winningSubcontractorName: winning?.subcontractorName ?? null,
  }
}

export function listRfqPackagesForQuoteEditor(
  quoteId: string,
  quoteLines: QuoteLine[]
): PendingRfqPackage[] {
  return listRfqsForQuote(quoteId)
    .map((pkg) => buildPackageSummary(pkg, quoteLines))
    .filter((p) => p.needsDecision || p.canChangeWinner)
}

export function listPendingRfqPackagesForQuote(
  quoteId: string,
  quoteLines: QuoteLine[]
): PendingRfqPackage[] {
  return listRfqPackagesForQuoteEditor(quoteId, quoteLines).filter((p) => p.needsDecision)
}

export function getQuoteLineRfqContexts(
  quoteLineId: string,
  quoteId: string,
  quoteLines: QuoteLine[]
): QuoteLineRfqContext[] {
  const packages = listRfqsForQuote(quoteId)
  const contexts: QuoteLineRfqContext[] = []

  for (const pkg of packages) {
    const rfl = pkg.lines.find((l) => l.quoteLineId === quoteLineId)
    if (!rfl) continue

    const invitations = listInvitationsForPackage(pkg.id)
    const submissions = listSubmissionsForPackage(pkg.id)
    const submittedInvitations = invitations.filter((inv) =>
      submissions.some((s) => s.invitationId === inv.id)
    )
    const cheapestInv = findCheapestInvitationForLine(
      pkg,
      rfl.id,
      submittedInvitations,
      submissions
    )

    const offers: LineBidOffer[] = submittedInvitations.map((inv) => {
      const sub = getInvitationSubmission(inv.id, submissions)!
      const bid = getSubmissionBidForLine(sub, rfl.id)
      const declined = bid?.declined ?? true
      let materialUnitPrice = 0
      let laborUnitPrice = 0
      if (bid && !declined) {
        if ((bid.materialUnitPrice ?? 0) > 0 || (bid.laborUnitPrice ?? 0) > 0) {
          materialUnitPrice = bid.materialUnitPrice ?? 0
          laborUnitPrice = bid.laborUnitPrice ?? 0
        } else if (bid.unitPrice != null && bid.unitPrice > 0) {
          materialUnitPrice = bid.unitPrice
          laborUnitPrice = 0
        }
      }
      const materialTotal = Math.round(materialUnitPrice * rfl.quantity)
      const laborTotal = Math.round(laborUnitPrice * rfl.quantity)
      const lineTotal =
        bid && !declined ? getBidLineTotal(bid, rfl.quantity) : 0
      return {
        invitationId: inv.id,
        submissionId: sub.id,
        subcontractorName: inv.subcontractorName,
        materialUnitPrice,
        laborUnitPrice,
        materialTotal,
        laborTotal,
        lineTotal,
        declined,
        isCheapest: inv.id === cheapestInv && lineTotal > 0,
      }
    })

    const quoteLine = quoteLines.find((l) => l.id === quoteLineId)
    const needsDecision =
      packageNeedsDecision(pkg, submissions, quoteLines) &&
      quoteLine?.pricingStatus === "rfq_pending"

    contexts.push({
      packageId: pkg.id,
      packageTitle: pkg.title,
      packageStatus: pkg.status,
      rfqLineId: rfl.id,
      submissionCount: submittedInvitations.length,
      invitedCount: invitations.length,
      awaitingCount: invitations.filter((i) => i.status === "invited").length,
      offers,
      needsDecision,
    })
  }

  return contexts
}

export function getRfqPackageContext(packageId: string) {
  const pkg = getRfq(packageId)
  if (!pkg) return null
  return {
    pkg,
    invitations: listInvitationsForPackage(packageId),
    submissions: listSubmissionsForPackage(packageId),
  }
}

export function findCheapestPackageInvitation(
  pkg: SubcontractorRfq,
  invitations: RfqInvitation[],
  submissions: SubcontractorRfqSubmission[]
): string | null {
  const submitted = invitations.filter((inv) =>
    submissions.some((s) => s.invitationId === inv.id)
  )
  let bestId: string | null = null
  let bestTotal = Infinity
  for (const inv of submitted) {
    const sub = getInvitationSubmission(inv.id, submissions)
    if (!sub) continue
    const total = computePackageSubmissionTotal(sub, pkg)
    if (total > 0 && total < bestTotal) {
      bestTotal = total
      bestId = inv.id
    }
  }
  return bestId
}
