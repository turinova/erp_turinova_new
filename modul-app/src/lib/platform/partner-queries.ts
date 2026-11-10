import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getAuthUsersByIds,
  lastSignInMap,
  listAllAuthUsersCached
} from '@/lib/platform/auth-users'

const MS_DAY = 24 * 60 * 60 * 1000

export type PlatformPartnerListItem = {
  userId: string
  name: string
  email: string
  mobile: string | null
  selectedTenantId: string | null
  companyName: string | null
  status: 'active' | 'disabled'
  mustSetPassword: boolean
  isLegacy: boolean
  createdAt: string
  lastSignInAt: string | null
  submittedCount: number
  draftCount: number
  lastSubmittedAt: string | null
  submitted7d: number
  gmv7d: number
}

export type PlatformPartnerView = 'live' | 'new' | 'legacy' | 'all'

/** Fülek számai — triage, nem teljesítmény KPI. */
export type PlatformPartnersSummary = {
  /** Belépett vagy beküldött — organikus és claimelt migrált is */
  live: number
  /**
   * Friss / Új: organikus created_at ≤7nap, vagy claimelt migrált
   * lastSignIn ≤7nap.
   */
  new7d: number
  /** Migrált várólista: must_set_password vagy soha nem lépett be */
  legacy: number
  /** Összes partner */
  all: number
}

export type PlatformPartnerRecentQuote = {
  id: string
  quoteNumber: string
  status: string
  totalGross: number
  portalSubmittedAt: string | null
  createdAt: string
  projectName: string | null
}

export type PlatformPartnerDetail = {
  profile: {
    userId: string
    name: string
    email: string
    mobile: string | null
    billingName: string | null
    billingCity: string | null
    billingPostalCode: string | null
    billingStreet: string | null
    billingHouseNumber: string | null
    billingTaxNumber: string | null
    selectedTenantId: string | null
    status: 'active' | 'disabled'
    disabledAt: string | null
    disabledReason: string | null
    mustSetPassword: boolean
    legacyPortalCustomerId: string | null
    termsAcceptedAt: string | null
    createdAt: string
    updatedAt: string
  }
  companyName: string | null
  lastSignInAt: string | null
  emailConfirmed: boolean
  draftCount: number
  submittedCount: number
  lastSubmittedAt: string | null
  gmvSubmitted: number
  submitted7d: number
  gmv7d: number
  submitted30d: number
  gmv30d: number
  recentQuotes: PlatformPartnerRecentQuote[]
}

type PartnerActivity = {
  liveIds: Set<string>
  lastActivityAt: Map<string, number>
  lastSignInAt: Map<string, string | null>
  submittedIds: Set<string>
}

async function loadPartnerActivity(
  admin: SupabaseClient,
  partnerIds: string[]
): Promise<PartnerActivity> {
  const liveIds = new Set<string>()
  const lastActivityAt = new Map<string, number>()
  const lastSignInAt = new Map<string, string | null>()
  const submittedIds = new Set<string>()
  if (partnerIds.length === 0) {
    return { liveIds, lastActivityAt, lastSignInAt, submittedIds }
  }

  // PostgREST .in limit — darabolás
  for (let i = 0; i < partnerIds.length; i += 100) {
    const chunk = partnerIds.slice(i, i + 100)
    const { data: quotes } = await admin
      .from('quotes')
      .select('partner_profile_id, portal_submitted_at')
      .eq('source', 'portal')
      .is('deleted_at', null)
      .not('portal_submitted_at', 'is', null)
      .in('partner_profile_id', chunk)
    for (const row of quotes ?? []) {
      const pid = row.partner_profile_id as string | null
      const at = row.portal_submitted_at as string | null
      if (!pid || !at) continue
      submittedIds.add(pid)
      const t = new Date(at).getTime()
      const prev = lastActivityAt.get(pid) ?? 0
      if (t > prev) lastActivityAt.set(pid, t)
    }
  }

  // Sok partner esetén listUsers cache gyorsabb, mint N× getUserById
  if (partnerIds.length > 40) {
    const users = await listAllAuthUsersCached(admin)
    const signIns = lastSignInMap(users)
    for (const id of partnerIds) {
      const signIn = signIns.get(id) ?? null
      lastSignInAt.set(id, signIn)
      if (signIn) {
        const t = new Date(signIn).getTime()
        const prev = lastActivityAt.get(id) ?? 0
        if (t > prev) lastActivityAt.set(id, t)
      }
      if (signIn || submittedIds.has(id)) liveIds.add(id)
    }
  } else {
    const authById = await getAuthUsersByIds(admin, partnerIds)
    for (const id of partnerIds) {
      const signIn = authById.get(id)?.lastSignInAt ?? null
      lastSignInAt.set(id, signIn)
      if (signIn) {
        const t = new Date(signIn).getTime()
        const prev = lastActivityAt.get(id) ?? 0
        if (t > prev) lastActivityAt.set(id, t)
      }
      if (signIn || submittedIds.has(id)) liveIds.add(id)
    }
  }

  return { liveIds, lastActivityAt, lastSignInAt, submittedIds }
}

function isFreshPartner(opts: {
  isLegacy: boolean
  mustSetPassword: boolean
  createdAt: string
  lastSignInAt: string | null
  since7Ms: number
}): boolean {
  if (!opts.isLegacy) {
    return new Date(opts.createdAt).getTime() >= opts.since7Ms
  }
  if (opts.mustSetPassword || !opts.lastSignInAt) return false
  return new Date(opts.lastSignInAt).getTime() >= opts.since7Ms
}

function isLegacyPending(opts: {
  isLegacy: boolean
  mustSetPassword: boolean
  lastSignInAt: string | null
}): boolean {
  if (!opts.isLegacy) return false
  return opts.mustSetPassword || !opts.lastSignInAt
}

export async function getPlatformPartnersSummary(
  admin: SupabaseClient
): Promise<PlatformPartnersSummary> {
  const since7Ms = Date.now() - 7 * MS_DAY

  const { data: rows, error } = await admin
    .from('partner_profiles')
    .select('user_id, created_at, must_set_password, legacy_portal_customer_id')

  if (error) {
    console.error('getPlatformPartnersSummary', error.message)
    throw new Error('Nem sikerült betölteni a partner összesítőt.')
  }

  const profiles = rows ?? []
  const ids = profiles.map((r) => r.user_id as string)
  const activity = await loadPartnerActivity(admin, ids)

  let live = 0
  let new7d = 0
  let legacy = 0

  for (const r of profiles) {
    const id = r.user_id as string
    const isLegacy = Boolean(r.legacy_portal_customer_id)
    const mustSet = Boolean(r.must_set_password)
    const signIn = activity.lastSignInAt.get(id) ?? null

    if (activity.liveIds.has(id)) live += 1
    if (
      isFreshPartner({
        isLegacy,
        mustSetPassword: mustSet,
        createdAt: r.created_at as string,
        lastSignInAt: signIn,
        since7Ms
      })
    ) {
      new7d += 1
    }
    if (isLegacyPending({ isLegacy, mustSetPassword: mustSet, lastSignInAt: signIn })) {
      legacy += 1
    }
  }

  return {
    live,
    new7d,
    legacy,
    all: profiles.length
  }
}

export async function listPlatformPartners(
  admin: SupabaseClient,
  params: {
    q?: string
    view?: PlatformPartnerView
    status?: 'all' | 'active' | 'disabled'
    /** Csak akiknek selected_tenant_id = ez. */
    tenantId?: string
    page?: number
    limit?: number
  }
): Promise<{
  rows: PlatformPartnerListItem[]
  total: number
  page: number
  limit: number
}> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const view = params.view ?? 'live'
  const status = params.status ?? 'all'
  const since7 = Date.now() - 7 * MS_DAY

  const profileSelect =
    'user_id, name, email, mobile, selected_tenant_id, status, created_at, must_set_password, legacy_portal_customer_id'

  // PostgREST builder típus túl mély a TS-nek — any a filter láncra.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyCommonFilters(query: any) {
    let q = query
    if (params.tenantId) {
      q = q.eq('selected_tenant_id', params.tenantId)
    }
    if (status === 'active' || status === 'disabled') {
      q = q.eq('status', status)
    }
    const search = params.q?.trim()
    if (search) {
      const safe = search.replace(/[%_,]/g, '')
      if (safe) {
        q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
      }
    }
    return q
  }

  async function enrichRows(
    rowsRaw: Record<string, unknown>[]
  ): Promise<PlatformPartnerListItem[]> {
    const tenantIds = [
      ...new Set(
        rowsRaw
          .map((r) => r.selected_tenant_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    ]
    const partnerIds = rowsRaw.map((r) => r.user_id as string)

    const companyByTenant = new Map<string, string>()
    if (tenantIds.length > 0) {
      const { data: tenants } = await admin
        .from('tenants')
        .select('id, name')
        .in('id', tenantIds)
      for (const t of tenants ?? []) {
        companyByTenant.set(t.id, t.name)
      }
    }

    type Agg = {
      draft: number
      submitted: number
      lastSubmittedAt: string | null
      submitted7d: number
      gmv7d: number
    }
    const aggByPartner = new Map<string, Agg>()

    if (partnerIds.length > 0) {
      for (let i = 0; i < partnerIds.length; i += 100) {
        const chunk = partnerIds.slice(i, i + 100)
        const { data: quotes } = await admin
          .from('quotes')
          .select('partner_profile_id, portal_submitted_at, total_gross')
          .eq('source', 'portal')
          .in('partner_profile_id', chunk)
          .is('deleted_at', null)

        for (const qrow of quotes ?? []) {
          const pid = qrow.partner_profile_id as string | null
          if (!pid) continue
          let agg = aggByPartner.get(pid)
          if (!agg) {
            agg = {
              draft: 0,
              submitted: 0,
              lastSubmittedAt: null,
              submitted7d: 0,
              gmv7d: 0
            }
            aggByPartner.set(pid, agg)
          }
          if (qrow.portal_submitted_at) {
            agg.submitted += 1
            const submittedAt = qrow.portal_submitted_at as string
            if (
              !agg.lastSubmittedAt ||
              new Date(submittedAt).getTime() >
                new Date(agg.lastSubmittedAt).getTime()
            ) {
              agg.lastSubmittedAt = submittedAt
            }
            if (new Date(submittedAt).getTime() >= since7) {
              agg.submitted7d += 1
              agg.gmv7d += Number(qrow.total_gross) || 0
            }
          } else {
            agg.draft += 1
          }
        }
      }
    }

    const authById = await getAuthUsersByIds(admin, partnerIds)

    return rowsRaw.map((r) => {
      const uid = r.user_id as string
      const agg = aggByPartner.get(uid)
      const tenantId = r.selected_tenant_id as string | null
      return {
        userId: uid,
        name: r.name as string,
        email: r.email as string,
        mobile: (r.mobile as string | null) ?? null,
        selectedTenantId: tenantId,
        companyName: tenantId ? (companyByTenant.get(tenantId) ?? null) : null,
        status: ((r.status as 'active' | 'disabled') ?? 'active') as
          | 'active'
          | 'disabled',
        mustSetPassword: Boolean(r.must_set_password),
        isLegacy: Boolean(r.legacy_portal_customer_id),
        createdAt: r.created_at as string,
        lastSignInAt: authById.get(uid)?.lastSignInAt ?? null,
        submittedCount: agg?.submitted ?? 0,
        draftCount: agg?.draft ?? 0,
        lastSubmittedAt: agg?.lastSubmittedAt ?? null,
        submitted7d: agg?.submitted7d ?? 0,
        gmv7d: Math.round((agg?.gmv7d ?? 0) * 100) / 100
      }
    })
  }

  // Élő / Új / Migrált: aktivitás-alapú osztályozás — memóriában lapozva
  if (view === 'live' || view === 'new' || view === 'legacy') {
    let classifiedQuery = admin.from('partner_profiles').select(profileSelect)
    classifiedQuery = applyCommonFilters(classifiedQuery)

    const { data, error } = await classifiedQuery.order('created_at', {
      ascending: false
    })
    if (error) {
      console.error(`listPlatformPartners ${view}`, error.message)
      throw new Error('Nem sikerült betölteni a partnereket.')
    }

    const allRaw = (data ?? []) as Record<string, unknown>[]
    const partnerIds = allRaw.map((r) => r.user_id as string)
    const activity = await loadPartnerActivity(admin, partnerIds)
    const since7Ms = Date.now() - 7 * MS_DAY

    const filtered = allRaw.filter((r) => {
      const id = r.user_id as string
      const isLegacy = Boolean(r.legacy_portal_customer_id)
      const mustSet = Boolean(r.must_set_password)
      const signIn = activity.lastSignInAt.get(id) ?? null

      if (view === 'live') return activity.liveIds.has(id)
      if (view === 'new') {
        return isFreshPartner({
          isLegacy,
          mustSetPassword: mustSet,
          createdAt: r.created_at as string,
          lastSignInAt: signIn,
          since7Ms
        })
      }
      return isLegacyPending({
        isLegacy,
        mustSetPassword: mustSet,
        lastSignInAt: signIn
      })
    })

    if (view === 'live') {
      filtered.sort((a, b) => {
        const ta = activity.lastActivityAt.get(a.user_id as string) ?? 0
        const tb = activity.lastActivityAt.get(b.user_id as string) ?? 0
        return tb - ta
      })
    } else if (view === 'new') {
      filtered.sort((a, b) => {
        const idA = a.user_id as string
        const idB = b.user_id as string
        const signA = activity.lastSignInAt.get(idA)
        const signB = activity.lastSignInAt.get(idB)
        const ta = Math.max(
          new Date(a.created_at as string).getTime(),
          signA ? new Date(signA).getTime() : 0
        )
        const tb = Math.max(
          new Date(b.created_at as string).getTime(),
          signB ? new Date(signB).getTime() : 0
        )
        return tb - ta
      })
    }

    const total = filtered.length
    const slice = filtered.slice((page - 1) * limit, page * limit)
    const rows = await enrichRows(slice)
    return { rows, total, page, limit }
  }

  let query = admin
    .from('partner_profiles')
    .select(profileSelect, { count: 'exact' })
  query = applyCommonFilters(query)

  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPlatformPartners', error.message)
    throw new Error('Nem sikerült betölteni a partnereket.')
  }

  const rows = await enrichRows((data ?? []) as Record<string, unknown>[])
  return { rows, total: count ?? 0, page, limit }
}

export async function getPlatformPartnerDetail(
  admin: SupabaseClient,
  userId: string
): Promise<PlatformPartnerDetail | null> {
  const { data: profile, error } = await admin
    .from('partner_profiles')
    .select(
      `
      user_id,
      name,
      email,
      mobile,
      billing_name,
      billing_city,
      billing_postal_code,
      billing_street,
      billing_house_number,
      billing_tax_number,
      selected_tenant_id,
      status,
      disabled_at,
      disabled_reason,
      must_set_password,
      legacy_portal_customer_id,
      terms_accepted_at,
      created_at,
      updated_at
    `
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getPlatformPartnerDetail', error.message)
    throw new Error('Nem sikerült betölteni a partnert.')
  }
  if (!profile) return null

  let companyName: string | null = null
  if (profile.selected_tenant_id) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('name')
      .eq('id', profile.selected_tenant_id)
      .maybeSingle()
    companyName = tenant?.name ?? null
  }

  const since7 = Date.now() - 7 * MS_DAY
  const since30 = Date.now() - 30 * MS_DAY

  const [{ data: quotes }, { data: recentRows }] = await Promise.all([
    admin
      .from('quotes')
      .select('portal_submitted_at, total_gross')
      .eq('partner_profile_id', userId)
      .eq('source', 'portal')
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select(
        'id, quote_number, status, total_gross, portal_submitted_at, created_at, project_name'
      )
      .eq('partner_profile_id', userId)
      .eq('source', 'portal')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  let draftCount = 0
  let submittedCount = 0
  let lastSubmittedAt: string | null = null
  let gmvSubmitted = 0
  let submitted7d = 0
  let gmv7d = 0
  let submitted30d = 0
  let gmv30d = 0

  for (const q of quotes ?? []) {
    if (q.portal_submitted_at) {
      submittedCount += 1
      const gross = Number(q.total_gross) || 0
      gmvSubmitted += gross
      const t = new Date(q.portal_submitted_at).getTime()
      if (!lastSubmittedAt || t > new Date(lastSubmittedAt).getTime()) {
        lastSubmittedAt = q.portal_submitted_at
      }
      if (t >= since30) {
        submitted30d += 1
        gmv30d += gross
      }
      if (t >= since7) {
        submitted7d += 1
        gmv7d += gross
      }
    } else {
      draftCount += 1
    }
  }

  const recentQuotes: PlatformPartnerRecentQuote[] = (recentRows ?? []).map(
    (row) => ({
      id: row.id as string,
      quoteNumber: row.quote_number as string,
      status: row.status as string,
      totalGross: Number(row.total_gross) || 0,
      portalSubmittedAt: (row.portal_submitted_at as string | null) ?? null,
      createdAt: row.created_at as string,
      projectName: (row.project_name as string | null) ?? null
    })
  )

  const { data: authData } = await admin.auth.admin.getUserById(userId)
  const authUser = authData?.user

  return {
    profile: {
      userId: profile.user_id,
      name: profile.name,
      email: profile.email,
      mobile: profile.mobile,
      billingName: profile.billing_name,
      billingCity: profile.billing_city,
      billingPostalCode: profile.billing_postal_code,
      billingStreet: profile.billing_street,
      billingHouseNumber: profile.billing_house_number,
      billingTaxNumber: profile.billing_tax_number,
      selectedTenantId: profile.selected_tenant_id,
      status: (profile.status as 'active' | 'disabled') ?? 'active',
      disabledAt: profile.disabled_at ?? null,
      disabledReason: profile.disabled_reason ?? null,
      mustSetPassword: Boolean(profile.must_set_password),
      legacyPortalCustomerId: profile.legacy_portal_customer_id ?? null,
      termsAcceptedAt: profile.terms_accepted_at ?? null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    },
    companyName,
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    emailConfirmed: Boolean(authUser?.email_confirmed_at),
    draftCount,
    submittedCount,
    lastSubmittedAt,
    gmvSubmitted: Math.round(gmvSubmitted * 100) / 100,
    submitted7d,
    gmv7d: Math.round(gmv7d * 100) / 100,
    submitted30d,
    gmv30d: Math.round(gmv30d * 100) / 100,
    recentQuotes
  }
}
