import { NextResponse } from "next/server"
import type {
  RfqCampaign,
  RfqInvitation,
  SubcontractorRfq,
  SubcontractorRfqSubmission,
} from "@/types/projects"
import { computeSubmissionTotal } from "@/lib/rfq-migration"
import { isSameRfqPartner } from "@/lib/rfq-public-export/build-export-model"
import { loadBundleFromDb, syncBundleToDb } from "@/lib/server/projects-bundle-db"
import { createSupabaseServiceClient } from "@/lib/supabase/service"
import { clearPinFailures, isPinLocked, recordPinFailure } from "@/lib/server/pin-lockout"

/**
 * Publikus alvállalkozói ajánlatbekérés — service-role kliens + szerveroldali
 * PIN. Az access_code SOHA nem megy le a válaszban; a feloldás ?code=
 * (GET) / body accessCode (POST) alapján, szerveren validálva.
 */

type RouteParams = { params: Promise<{ token: string }> }

type InvitationRow = {
  id: string
  rfq_id: string
  access_code: string
  subcontractor_name: string
}

async function findInvitationOrg(
  token: string
): Promise<{ row: InvitationRow; orgId: string } | null> {
  const supabase = createSupabaseServiceClient()
  const { data: inv } = await supabase
    .from("rfq_invitations")
    .select("id, rfq_id, access_code, subcontractor_name")
    .eq("access_token", token)
    .maybeSingle<InvitationRow>()
  if (!inv) return null

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("project_id")
    .eq("id", inv.rfq_id)
    .maybeSingle<{ project_id: string }>()
  if (!rfq) return null

  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", rfq.project_id)
    .maybeSingle<{ organization_id: string }>()
  if (!project) return null

  return { row: inv, orgId: project.organization_id }
}

function sanitizeInvitation(inv: RfqInvitation): Omit<RfqInvitation, "accessCode"> {
  const { accessCode: _c, ...rest } = inv
  return rest
}

export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const found = await findInvitationOrg(token)
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const url = new URL(request.url)
    const code = url.searchParams.get("code")?.trim() ?? ""

    if (code === "") {
      // Kód nélkül csak a feloldó űrlaphoz szükséges minimum
      return NextResponse.json({
        needsCode: true,
        subcontractorName: found.row.subcontractor_name,
      })
    }

    if (isPinLocked(token)) {
      return NextResponse.json({ error: "Túl sok hibás kód — próbáld 15 perc múlva." }, { status: 429 })
    }
    if (code !== found.row.access_code) {
      recordPinFailure(token)
      return NextResponse.json({ error: "Hibás belépőkód" }, { status: 403 })
    }
    clearPinFailures(token)

    const supabase = createSupabaseServiceClient()
    const bundle = await loadBundleFromDb(supabase, found.orgId)

    const invitation = bundle.rfqInvitations.find((i) => i.id === found.row.id)
    const pkg = invitation
      ? bundle.rfqs.find((r) => r.id === invitation.packageId)
      : undefined
    if (!invitation || !pkg) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const project = bundle.projects.find((p) => p.id === pkg.projectId)
    const submission = bundle.submissions.find((s) => s.invitationId === invitation.id)
    const campaign: RfqCampaign | null = pkg.campaignId
      ? (bundle.rfqCampaigns?.find((c) => c.id === pkg.campaignId) ?? null)
      : null

    const packageDecision = (bundle.rfqDecisionLogs ?? [])
      .filter((l) => l.packageId === pkg.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    const packageDecided = pkg.status === "decided"
    const youWon = invitation.status === "accepted"
    const youLost =
      invitation.status === "rejected" ||
      (packageDecided && invitation.status !== "accepted")

    // Ugyanarra a projektre vonatkozó, ugyanazon partner meghívói (Excel több szakág)
    const siblingInvitations = bundle.rfqInvitations.filter((inv) => {
      if (inv.id === invitation.id) return true
      const siblingPkg = bundle.rfqs.find((r) => r.id === inv.packageId)
      if (!siblingPkg || siblingPkg.projectId !== pkg.projectId) return false
      return isSameRfqPartner(invitation, inv)
    })

    const exportPackages: Array<{
      rfq: SubcontractorRfq
      submission: SubcontractorRfqSubmission | null
      invitationId: string
      invitationStatus: string
      isCurrent: boolean
    }> = []
    const seenPackageIds = new Set<string>()
    for (const inv of siblingInvitations) {
      const siblingPkg = bundle.rfqs.find((r) => r.id === inv.packageId)
      if (!siblingPkg || seenPackageIds.has(siblingPkg.id)) continue
      seenPackageIds.add(siblingPkg.id)
      exportPackages.push({
        rfq: siblingPkg,
        submission:
          bundle.submissions.find((s) => s.invitationId === inv.id) ?? null,
        invitationId: inv.id,
        invitationStatus: inv.status,
        isCurrent: inv.id === invitation.id,
      })
    }
    if (!exportPackages.some((p) => p.isCurrent)) {
      exportPackages.unshift({
        rfq: pkg,
        submission: submission ?? null,
        invitationId: invitation.id,
        invitationStatus: invitation.status,
        isCurrent: true,
      })
    }

    // Mértékegység-címkék a sorokhoz (a kliens nem lát törzsadatot)
    const unitIds = [
      ...new Set(exportPackages.flatMap((p) => p.rfq.lines.map((l) => l.unitId))),
    ]
    const units: Record<string, string> = {}
    if (unitIds.length > 0) {
      const { data: unitRows } = await supabase
        .from("units")
        .select("id, code")
        .in("id", unitIds)
      for (const u of unitRows ?? []) units[u.id] = u.code
    }

    return NextResponse.json({
      invitation: sanitizeInvitation(invitation),
      rfq: pkg,
      project: project
        ? {
            id: project.id,
            name: project.name,
            siteAddress: project.siteAddress,
            code: project.code,
          }
        : null,
      submission: submission ?? null,
      campaign,
      units,
      exportPackages,
      packageDecided,
      youWon,
      youLost,
      decidedAt: packageDecision?.createdAt ?? null,
    })
  } catch (error) {
    console.error("rfq GET:", error)
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params

  try {
    const found = await findInvitationOrg(token)
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = (await request.json()) as Omit<
      SubcontractorRfqSubmission,
      "id" | "rfqId" | "invitationId" | "submittedAt" | "updatedAt"
    > & { accessCode?: string; targetInvitationId?: string }

    if (isPinLocked(token)) {
      return NextResponse.json({ error: "Túl sok hibás kód — próbáld 15 perc múlva." }, { status: 429 })
    }
    if (!body.accessCode || body.accessCode.trim() !== found.row.access_code) {
      recordPinFailure(token)
      return NextResponse.json({ error: "Hibás belépőkód" }, { status: 403 })
    }
    clearPinFailures(token)

    const supabase = createSupabaseServiceClient()
    const bundle = await loadBundleFromDb(supabase, found.orgId)

    const entryInvIdx = bundle.rfqInvitations.findIndex((i) => i.id === found.row.id)
    if (entryInvIdx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const entryInvitation = bundle.rfqInvitations[entryInvIdx]

    let invIdx = entryInvIdx
    if (body.targetInvitationId && body.targetInvitationId !== entryInvitation.id) {
      const targetIdx = bundle.rfqInvitations.findIndex(
        (i) => i.id === body.targetInvitationId
      )
      if (targetIdx < 0) {
        return NextResponse.json({ error: "A cél meghívás nem található" }, { status: 404 })
      }
      const target = bundle.rfqInvitations[targetIdx]
      if (!isSameRfqPartner(entryInvitation, target)) {
        return NextResponse.json({ error: "Nem a te meghívásod" }, { status: 403 })
      }
      // PIN egyezés (kampányon belül egységesített, vagy azonos kód)
      if (
        target.accessCode !== entryInvitation.accessCode &&
        body.accessCode.trim() !== target.accessCode
      ) {
        return NextResponse.json({ error: "Hibás belépőkód" }, { status: 403 })
      }
      invIdx = targetIdx
    }

    const invitation = bundle.rfqInvitations[invIdx]
    const pkgIdx = bundle.rfqs.findIndex((r) => r.id === invitation.packageId)
    if (pkgIdx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const pkg = bundle.rfqs[pkgIdx]
    if (new Date(pkg.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Expired" }, { status: 410 })
    }
    if (pkg.status === "decided") {
      return NextResponse.json({ error: "Decision already made" }, { status: 409 })
    }
    if (invitation.status === "accepted" || invitation.status === "rejected") {
      return NextResponse.json({ error: "Decision already made" }, { status: 409 })
    }

    const lineBids = body.lineBids.map((b) => ({
      rfqLineId: b.rfqLineId,
      materialUnitPrice: b.materialUnitPrice ?? 0,
      laborUnitPrice: b.laborUnitPrice ?? (b as { unitPrice?: number }).unitPrice ?? 0,
      declined: b.declined ?? false,
    }))

    const hasAny = lineBids.some(
      (b) => !b.declined && (b.materialUnitPrice > 0 || b.laborUnitPrice > 0)
    )
    if (!hasAny) {
      return NextResponse.json({ error: "No prices" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const existingIdx = bundle.submissions.findIndex((s) => s.invitationId === invitation.id)

    const submission: SubcontractorRfqSubmission = {
      id: existingIdx >= 0 ? bundle.submissions[existingIdx].id : crypto.randomUUID(),
      rfqId: pkg.id,
      invitationId: invitation.id,
      subcontractorName: body.subcontractorName?.trim() || invitation.subcontractorName,
      contactEmail: body.contactEmail ?? "",
      contactPhone: body.contactPhone ?? invitation.contactPhone,
      notes: body.notes ?? "",
      lineBids,
      totalAmount: 0,
      submittedAt: existingIdx >= 0 ? bundle.submissions[existingIdx].submittedAt : now,
      updatedAt: now,
    }
    submission.totalAmount = computeSubmissionTotal(submission, pkg)

    if (existingIdx >= 0) {
      const prev = bundle.submissions[existingIdx]
      const history = [...(prev.revisionHistory ?? [])]
      if (prev.totalAmount !== submission.totalAmount || prev.updatedAt !== submission.updatedAt) {
        history.push({
          totalAmount: prev.totalAmount,
          updatedAt: prev.updatedAt,
          notes: prev.notes || undefined,
        })
      }
      submission.revisionHistory = history
      bundle.submissions[existingIdx] = submission
    } else {
      bundle.submissions.push(submission)
    }

    bundle.rfqInvitations[invIdx] = {
      ...invitation,
      status: "submitted",
      subcontractorName: submission.subcontractorName,
      contactPhone: submission.contactPhone || invitation.contactPhone,
    }

    await syncBundleToDb(supabase, found.orgId, bundle)
    return NextResponse.json({ ok: true, submission })
  } catch (error) {
    console.error("rfq POST:", error)
    return NextResponse.json({ error: "Szerverhiba" }, { status: 500 })
  }
}
