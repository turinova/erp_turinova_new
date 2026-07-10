import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  ClientProjectCounts,
  SubcontractorRfqStatsMap,
  SubcontractorRfqStatsRow,
} from "@/types/list-stats"

/** Ügyfél ↔ projekt darabszámok (lista oldalhoz, bundle nélkül). */
export async function fetchClientProjectCounts(
  supabase: SupabaseClient,
  orgId: string
): Promise<ClientProjectCounts> {
  const { data, error } = await supabase
    .from("projects")
    .select("client_id, client_name")
    .eq("organization_id", orgId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message)

  const byClientId: Record<string, number> = {}
  const byClientName: Record<string, number> = {}

  for (const row of data ?? []) {
    if (row.client_id) {
      byClientId[row.client_id] = (byClientId[row.client_id] ?? 0) + 1
    }
    const name = (row.client_name as string | null)?.trim().toLowerCase()
    if (name) {
      byClientName[name] = (byClientName[name] ?? 0) + 1
    }
  }

  return { byClientId, byClientName }
}

/** Alvállalkozónkénti RFQ statisztikák (lista oldalhoz, bundle nélkül). */
export async function fetchSubcontractorRfqStats(
  supabase: SupabaseClient,
  orgId: string
): Promise<SubcontractorRfqStatsMap> {
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", orgId)
    .is("deleted_at", null)

  if (projErr) throw new Error(projErr.message)

  const projectIds = (projects ?? []).map((p) => p.id)
  if (projectIds.length === 0) return {}

  const { data: rfqs, error: rfqErr } = await supabase
    .from("rfqs")
    .select("id")
    .in("project_id", projectIds)

  if (rfqErr) throw new Error(rfqErr.message)

  const rfqIds = (rfqs ?? []).map((r) => r.id)
  if (rfqIds.length === 0) return {}

  const [invRes, subRes] = await Promise.all([
    supabase
      .from("rfq_invitations")
      .select("id, rfq_id, subcontractor_id, subcontractor_name, status, created_at")
      .in("rfq_id", rfqIds),
    supabase
      .from("rfq_submissions")
      .select("id, rfq_id, invitation_id, subcontractor_id, submitted_at")
      .in("rfq_id", rfqIds),
  ])

  if (invRes.error) throw new Error(invRes.error.message)
  if (subRes.error) throw new Error(subRes.error.message)

  const submissionsByInvitation = new Map<string, { submittedAt: string }>()
  for (const s of subRes.data ?? []) {
    if (s.invitation_id) {
      submissionsByInvitation.set(s.invitation_id, {
        submittedAt: s.submitted_at as string,
      })
    }
  }

  const stats: SubcontractorRfqStatsMap = {}

  const bump = (key: string): SubcontractorRfqStatsRow => {
    if (!stats[key]) {
      stats[key] = {
        invitationCount: 0,
        submittedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        lastSubmissionAt: null,
      }
    }
    return stats[key]
  }

  for (const inv of invRes.data ?? []) {
    if (!inv.subcontractor_id) continue
    const key = inv.subcontractor_id as string
    const s = bump(key)
    s.invitationCount += 1
    if (inv.status === "accepted") s.acceptedCount += 1
    if (inv.status === "rejected") s.rejectedCount += 1

    const submission = submissionsByInvitation.get(inv.id as string)
    if (submission) {
      s.submittedCount += 1
      if (!s.lastSubmissionAt || submission.submittedAt > s.lastSubmissionAt) {
        s.lastSubmissionAt = submission.submittedAt
      }
    }
  }

  return stats
}
