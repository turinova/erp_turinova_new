import type { Subcontractor } from "@/types/subcontractors"
import type { RfqInvitation, SubcontractorRfqSubmission } from "@/types/projects"
import {
  getProject,
  getQuote,
  listDecisionLogsForPackage,
  listInvitationsForPackage,
  listProjects,
  listRfqsForProject,
  listSubmissionsForPackage,
} from "@/lib/data/projects-store"
import { getSubcontractor } from "@/lib/data/subcontractors-store"
import { RFQ_INVITATION_STATUS_LABELS } from "@/lib/project-labels"
import { getTradeLabel } from "@/lib/trades"
import { formatHuf } from "@/lib/pricing"

export type SubcontractorSubmissionRow = {
  submissionId: string
  invitationId: string
  packageId: string
  projectId: string
  projectName: string
  projectCode: string
  quoteId: string
  quoteTitle: string
  packageTitle: string
  trade: string
  tradeLabel: string
  totalAmount: number
  submittedAt: string
  invitationStatus: RfqInvitation["status"]
  invitationStatusLabel: string
}

export type SubcontractorStats = {
  invitationCount: number
  submittedCount: number
  acceptedCount: number
  rejectedCount: number
  lastSubmissionAt: string | null
}

export type SubcontractorActivityItem = {
  id: string
  at: string
  label: string
  detail?: string
}

function listAllPackages() {
  return listProjects().flatMap((p) => listRfqsForProject(p.id))
}

function matchesSubcontractor(
  sub: Subcontractor,
  invitation: RfqInvitation,
  submission?: SubcontractorRfqSubmission
): boolean {
  if (invitation.subcontractorId === sub.id) return true
  if (submission?.subcontractorId === sub.id) return true
  const name = sub.legalName.toLowerCase()
  const display = sub.displayName.toLowerCase()
  const invName = invitation.subcontractorName.trim().toLowerCase()
  return invName === name || invName === display
}

export function listSubmissionRowsForSubcontractor(
  subcontractorOrId: string | Subcontractor
): SubcontractorSubmissionRow[] {
  const sub =
    typeof subcontractorOrId === "string"
      ? getSubcontractor(subcontractorOrId)
      : subcontractorOrId
  if (!sub) return []

  const rows: SubcontractorSubmissionRow[] = []

  for (const pkg of listAllPackages()) {
    const invitations = listInvitationsForPackage(pkg.id)
    const submissions = listSubmissionsForPackage(pkg.id)
    const project = getProject(pkg.projectId)
    const quote = getQuote(pkg.quoteId)
    if (!project || !quote) continue

    for (const inv of invitations) {
      if (!matchesSubcontractor(sub, inv)) continue
      const submission = submissions.find((s) => s.invitationId === inv.id)
      if (!submission) continue

      rows.push({
        submissionId: submission.id,
        invitationId: inv.id,
        packageId: pkg.id,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        quoteId: quote.id,
        quoteTitle: quote.title,
        packageTitle: pkg.title,
        trade: pkg.trade,
        tradeLabel: getTradeLabel(pkg.trade),
        totalAmount: submission.totalAmount,
        submittedAt: submission.submittedAt,
        invitationStatus: inv.status,
        invitationStatusLabel: RFQ_INVITATION_STATUS_LABELS[inv.status],
      })
    }
  }

  return rows.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )
}

export function getSubcontractorStats(subcontractorOrId: string | Subcontractor): SubcontractorStats {
  const sub =
    typeof subcontractorOrId === "string"
      ? getSubcontractor(subcontractorOrId)
      : subcontractorOrId
  if (!sub) {
    return {
      invitationCount: 0,
      submittedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      lastSubmissionAt: null,
    }
  }

  let invitationCount = 0
  let submittedCount = 0
  let acceptedCount = 0
  let rejectedCount = 0
  let lastSubmissionAt: string | null = null

  for (const pkg of listAllPackages()) {
    const invitations = listInvitationsForPackage(pkg.id)
    const submissions = listSubmissionsForPackage(pkg.id)

    for (const inv of invitations) {
      if (!matchesSubcontractor(sub, inv)) continue
      invitationCount++
      if (inv.status === "accepted") acceptedCount++
      if (inv.status === "rejected") rejectedCount++

      const submission = submissions.find((s) => s.invitationId === inv.id)
      if (submission) {
        submittedCount++
        if (!lastSubmissionAt || submission.submittedAt > lastSubmissionAt) {
          lastSubmissionAt = submission.submittedAt
        }
      }
    }
  }

  return {
    invitationCount,
    submittedCount,
    acceptedCount,
    rejectedCount,
    lastSubmissionAt,
  }
}

export function buildSubcontractorActivity(
  subcontractorOrId: string | Subcontractor
): SubcontractorActivityItem[] {
  const sub =
    typeof subcontractorOrId === "string"
      ? getSubcontractor(subcontractorOrId)
      : subcontractorOrId
  if (!sub) return []

  const items: SubcontractorActivityItem[] = []

  for (const pkg of listAllPackages()) {
    const invitations = listInvitationsForPackage(pkg.id)
    const submissions = listSubmissionsForPackage(pkg.id)
    const decisions = listDecisionLogsForPackage(pkg.id)
    const project = getProject(pkg.projectId)

    for (const inv of invitations) {
      if (!matchesSubcontractor(sub, inv)) continue

      items.push({
        id: `inv-${inv.id}`,
        at: inv.createdAt,
        label: "RFQ meghívás",
        detail: `${project?.name ?? "Projekt"} — ${pkg.title}`,
      })

      const submission = submissions.find((s) => s.invitationId === inv.id)
      if (submission) {
        items.push({
          id: `sub-${submission.id}`,
          at: submission.submittedAt,
          label: "Ajánlat beküldve",
          detail: `${formatHuf(submission.totalAmount)} · ${pkg.title}`,
        })
      }

      if (inv.status === "accepted") {
        const decision = decisions.find((d) => d.invitationId === inv.id)
        items.push({
          id: `acc-${inv.id}`,
          at: decision?.createdAt ?? submission?.submittedAt ?? inv.createdAt,
          label: "Ajánlat elfogadva",
          detail: pkg.title,
        })
      }
    }
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 20)
}
