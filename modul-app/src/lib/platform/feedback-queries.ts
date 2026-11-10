import type { SupabaseClient } from '@supabase/supabase-js'

import { FEEDBACK_TAGS, isFeedbackTagId } from '@/lib/partner/feedback-copy'
import { FEEDBACK_RESUBMIT_DAYS } from '@/lib/partner/feedback-visibility'

const MS_DAY = 24 * 60 * 60 * 1000
/** Ennyi válasz alatt az NPS szám erősen ugrál. */
export const NPS_MIN_RELIABLE_N = 30

export type PlatformFeedbackKindFilter = 'all' | 'nps' | 'suggestion' | 'detractor'

export type PlatformFeedbackListItem = {
  id: string
  kind: 'nps' | 'suggestion'
  score: number | null
  comment: string | null
  tags: string[]
  createdAt: string
  reviewedAt: string | null
  partnerUserId: string | null
  partnerName: string | null
  partnerEmail: string | null
  tenantId: string | null
  companyName: string | null
}

export type PlatformFeedbackTagCount = {
  id: string
  label: string
  count: number
}

export type PlatformNpsSummary = {
  /** -100..100; null ha nincs válasz */
  nps: number | null
  n: number
  promoters: number
  passives: number
  detractors: number
  windowDays: number
}

/** Partnerenként csak a legutolsó válasz számít az ablakban. */
export function computeNpsSummary(
  rows: Array<{ partnerUserId: string | null; score: number; createdAt: string }>,
  windowDays: number
): PlatformNpsSummary {
  const latest = new Map<string, { score: number; at: number }>()
  for (const r of rows) {
    const key = r.partnerUserId ?? `anon:${r.createdAt}`
    const at = new Date(r.createdAt).getTime()
    const prev = latest.get(key)
    if (!prev || at > prev.at) latest.set(key, { score: r.score, at })
  }
  let promoters = 0
  let passives = 0
  let detractors = 0
  for (const { score } of latest.values()) {
    if (score >= 9) promoters += 1
    else if (score >= 7) passives += 1
    else detractors += 1
  }
  const n = promoters + passives + detractors
  return {
    nps: n === 0 ? null : Math.round(((promoters - detractors) / n) * 100),
    n,
    promoters,
    passives,
    detractors,
    windowDays
  }
}

export async function listPlatformPartnerFeedback(
  admin: SupabaseClient,
  params: {
    page?: number
    limit?: number
    onlyUnreviewed?: boolean
    tag?: string | null
    kind?: PlatformFeedbackKindFilter
  } = {}
): Promise<{
  rows: PlatformFeedbackListItem[]
  total: number
  page: number
  limit: number
  unreviewedCount: number
  tagCounts: PlatformFeedbackTagCount[]
  npsSummary: PlatformNpsSummary
}> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const tag = params.tag && isFeedbackTagId(params.tag) ? params.tag : null
  const kind = params.kind ?? 'all'
  const windowSince = new Date(
    Date.now() - FEEDBACK_RESUBMIT_DAYS * MS_DAY
  ).toISOString()

  let query = admin
    .from('partner_product_feedback')
    .select(
      'id, kind, score, comment, tags, created_at, reviewed_at, partner_user_id, tenant_id',
      { count: 'exact' }
    )

  if (kind === 'nps') query = query.eq('kind', 'nps')
  if (kind === 'suggestion') query = query.eq('kind', 'suggestion')
  if (kind === 'detractor') query = query.eq('kind', 'nps').lte('score', 6)
  if (params.onlyUnreviewed) query = query.is('reviewed_at', null)
  if (tag) query = query.contains('tags', [tag])

  const [listRes, unreviewedRes, tagRowsRes, npsRowsRes] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, to),
    admin
      .from('partner_product_feedback')
      .select('id', { count: 'exact', head: true })
      .is('reviewed_at', null),
    admin.from('partner_product_feedback').select('tags'),
    admin
      .from('partner_product_feedback')
      .select('partner_user_id, score, created_at')
      .eq('kind', 'nps')
      .not('score', 'is', null)
      .gte('created_at', windowSince)
  ])

  if (listRes.error) {
    console.error('listPlatformPartnerFeedback', listRes.error.message)
    throw new Error('Nem sikerült betölteni a visszajelzéseket.')
  }

  const countById = new Map<string, number>()
  for (const r of tagRowsRes.data ?? []) {
    for (const t of (r.tags as string[] | null) ?? []) {
      countById.set(t, (countById.get(t) ?? 0) + 1)
    }
  }
  const tagCounts: PlatformFeedbackTagCount[] = FEEDBACK_TAGS.map((t) => ({
    id: t.id,
    label: t.label,
    count: countById.get(t.id) ?? 0
  }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)

  const npsSummary = computeNpsSummary(
    (npsRowsRes.data ?? []).map((r) => ({
      partnerUserId: (r.partner_user_id as string | null) ?? null,
      score: r.score as number,
      createdAt: r.created_at as string
    })),
    FEEDBACK_RESUBMIT_DAYS
  )

  const rowsRaw = listRes.data ?? []
  const partnerIds = [
    ...new Set(
      rowsRaw
        .map((r) => r.partner_user_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ]
  const tenantIds = [
    ...new Set(
      rowsRaw
        .map((r) => r.tenant_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ]

  const partnerById = new Map<string, { name: string; email: string }>()
  const companyByTenant = new Map<string, string>()

  await Promise.all([
    partnerIds.length > 0
      ? admin
          .from('partner_profiles')
          .select('user_id, name, email')
          .in('user_id', partnerIds)
          .then(({ data: partners }) => {
            for (const p of partners ?? []) {
              partnerById.set(p.user_id as string, {
                name: p.name as string,
                email: p.email as string
              })
            }
          })
      : Promise.resolve(),
    tenantIds.length > 0
      ? admin
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds)
          .then(({ data: tenants }) => {
            for (const t of tenants ?? []) {
              companyByTenant.set(t.id as string, t.name as string)
            }
          })
      : Promise.resolve()
  ])

  const rows: PlatformFeedbackListItem[] = rowsRaw.map((r) => {
    const partnerUserId = (r.partner_user_id as string | null) ?? null
    const partner = partnerUserId ? partnerById.get(partnerUserId) : undefined
    const tenantId = (r.tenant_id as string | null) ?? null
    return {
      id: r.id as string,
      kind: (r.kind as 'nps' | 'suggestion') ?? 'nps',
      score: (r.score as number | null) ?? null,
      comment: (r.comment as string | null) ?? null,
      tags: (r.tags as string[] | null) ?? [],
      createdAt: r.created_at as string,
      reviewedAt: (r.reviewed_at as string | null) ?? null,
      partnerUserId,
      partnerName: partner?.name ?? null,
      partnerEmail: partner?.email ?? null,
      tenantId,
      companyName: tenantId ? (companyByTenant.get(tenantId) ?? null) : null
    }
  })

  return {
    rows,
    total: listRes.count ?? 0,
    page,
    limit,
    unreviewedCount: unreviewedRes.count ?? 0,
    tagCounts,
    npsSummary
  }
}
