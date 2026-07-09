import type {
  ProjectDataBundle,
  SubcontractorRfq,
  SubcontractorRfqLineBid,
  SubcontractorRfqSubmission,
} from "@/types/projects"

function normalizeBid(bid: SubcontractorRfqLineBid): SubcontractorRfqLineBid {
  if (bid.declined != null && (bid.materialUnitPrice != null || bid.laborUnitPrice != null)) {
    return {
      rfqLineId: bid.rfqLineId,
      materialUnitPrice: bid.materialUnitPrice ?? 0,
      laborUnitPrice: bid.laborUnitPrice ?? 0,
      declined: bid.declined,
    }
  }
  const legacy = bid.unitPrice ?? 0
  return {
    rfqLineId: bid.rfqLineId,
    materialUnitPrice: 0,
    laborUnitPrice: legacy,
    declined: legacy <= 0 && bid.declined === true,
  }
}

/** v1/legacy csomag alak — a régi mentésekben előforduló mezők és státuszok */
type LegacyRfqPackage = Omit<SubcontractorRfq, "status"> & {
  status: SubcontractorRfq["status"] | "closed" | "draft" | "sent" | "received"
  /** v1 — migrálás után a meghívásokban van */
  accessToken?: string
  accessCode?: string
}

function normalizePackageStatus(status: LegacyRfqPackage["status"]): SubcontractorRfq["status"] {
  if (status === "sent" || status === "received" || status === "draft") return "open"
  if (status === "closed") return "decided"
  return status
}

/** v1 RFQ (egy link a csomagon) → csomag + meghívás */
export function normalizeRfqBundle(bundle: ProjectDataBundle): ProjectDataBundle {
  const invitations = bundle.rfqInvitations ? [...bundle.rfqInvitations] : []
  const submissions = bundle.submissions.map((s) => ({
    ...s,
    invitationId: s.invitationId ?? "",
    updatedAt: s.updatedAt ?? s.submittedAt,
    lineBids: s.lineBids.map(normalizeBid),
  }))

  const rfqs = (bundle.rfqs as LegacyRfqPackage[]).map((pkg): SubcontractorRfq => {
    if (pkg.accessToken) {
      const existingInv = invitations.find((i) => i.accessToken === pkg.accessToken)
      if (!existingInv) {
        const invId = `inv-mig-${pkg.id}`
        invitations.push({
          id: invId,
          packageId: pkg.id,
          subcontractorName: "Alvállalkozó",
          contactPhone: "",
          accessToken: pkg.accessToken,
          accessCode: pkg.accessCode ?? "000000",
          status: submissions.some((s) => s.rfqId === pkg.id) ? "submitted" : "invited",
          createdAt: pkg.createdAt,
        })
        for (const sub of submissions) {
          if (sub.rfqId === pkg.id && !sub.invitationId) {
            sub.invitationId = invId
          }
        }
      }
    }

    const rest = { ...pkg }
    delete rest.accessToken
    delete rest.accessCode
    return { ...rest, status: normalizePackageStatus(pkg.status) }
  })

  for (const sub of submissions) {
    if (!sub.invitationId && sub.rfqId) {
      const inv = invitations.find((i) => i.packageId === sub.rfqId)
      if (inv) sub.invitationId = inv.id
    }
  }

  return {
    ...bundle,
    rfqs,
    rfqInvitations: invitations,
    submissions,
    rfqDecisionLogs: bundle.rfqDecisionLogs ?? [],
  }
}

export function getBidLineTotal(bid: SubcontractorRfqLineBid, quantity: number): number {
  if (bid.declined) return 0
  const mat = bid.materialUnitPrice ?? bid.unitPrice ?? 0
  const lab = bid.laborUnitPrice ?? 0
  if (bid.unitPrice != null && bid.materialUnitPrice == null && bid.laborUnitPrice == null) {
    return Math.round(bid.unitPrice * quantity)
  }
  return Math.round((mat + lab) * quantity)
}

export function computeSubmissionTotal(
  submission: SubcontractorRfqSubmission,
  pkg: SubcontractorRfq
): number {
  let total = 0
  for (const bid of submission.lineBids) {
    const line = pkg.lines.find((l) => l.id === bid.rfqLineId)
    if (!line || bid.declined) continue
    total += getBidLineTotal(bid, line.quantity)
  }
  return Math.round(total)
}
