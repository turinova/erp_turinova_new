import type { SupabaseClient } from '@supabase/supabase-js'

import { getAuthUsersByIds } from '@/lib/platform/auth-users'

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

export type PlatformPartnersSummary = {
  active: number
  disabled: number
  unlinked: number
  mustSetPassword: number
  legacy: number
  draftsAlive: number
  submits7d: number
  gmv7d: number
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

export async function getPlatformPartnersSummary(
  admin: SupabaseClient
): Promise<PlatformPartnersSummary> {
  const since7 = new Date(Date.now() - 7 * MS_DAY).toISOString()

  const [
    { count: active },
    { count: disabled },
    { count: unlinked },
    { count: mustSetPassword },
    { count: legacy },
    { count: draftsAlive },
    { count: submits7d },
    { data: gmv7dRows }
  ] = await Promise.all([
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'disabled'),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .is('selected_tenant_id', null)
      .eq('status', 'active'),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('must_set_password', true),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .not('legacy_portal_customer_id', 'is', null),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'portal')
      .is('deleted_at', null)
      .not('portal_submitted_at', 'is', null)
      .gte('portal_submitted_at', since7),
    admin
      .from('quotes')
      .select('total_gross')
      .eq('source', 'portal')
      .is('deleted_at', null)
      .not('portal_submitted_at', 'is', null)
      .gte('portal_submitted_at', since7)
  ])

  let gmv7d = 0
  for (const row of gmv7dRows ?? []) {
    gmv7d += Number(row.total_gross) || 0
  }

  return {
    active: active ?? 0,
    disabled: disabled ?? 0,
    unlinked: unlinked ?? 0,
    mustSetPassword: mustSetPassword ?? 0,
    legacy: legacy ?? 0,
    draftsAlive: draftsAlive ?? 0,
    submits7d: submits7d ?? 0,
    gmv7d: Math.round(gmv7d * 100) / 100
  }
}

export async function listPlatformPartners(
  admin: SupabaseClient,
  params: {
    q?: string
    link?: 'all' | 'linked' | 'unlinked'
    status?: 'all' | 'active' | 'disabled'
    password?: 'all' | 'must_set'
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
  const from = (page - 1) * limit
  const to = from + limit - 1
  const link = params.link ?? 'all'
  const status = params.status ?? 'all'
  const password = params.password ?? 'all'
  const since7 = Date.now() - 7 * MS_DAY

  let query = admin
    .from('partner_profiles')
    .select(
      'user_id, name, email, mobile, selected_tenant_id, status, created_at, must_set_password, legacy_portal_customer_id',
      { count: 'exact' }
    )

  if (params.tenantId) {
    query = query.eq('selected_tenant_id', params.tenantId)
  } else if (link === 'linked') {
    query = query.not('selected_tenant_id', 'is', null)
  } else if (link === 'unlinked') {
    query = query.is('selected_tenant_id', null)
  }

  if (status === 'active' || status === 'disabled') {
    query = query.eq('status', status)
  }

  if (password === 'must_set') {
    query = query.eq('must_set_password', true)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPlatformPartners', error.message)
    throw new Error('Nem sikerült betölteni a partnereket.')
  }

  const rowsRaw = data ?? []
  const tenantIds = [
    ...new Set(
      rowsRaw
        .map((r) => r.selected_tenant_id)
        .filter((id): id is string => Boolean(id))
    )
  ]
  const partnerIds = rowsRaw.map((r) => r.user_id)

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
    const { data: quotes } = await admin
      .from('quotes')
      .select('partner_profile_id, portal_submitted_at, total_gross')
      .eq('source', 'portal')
      .in('partner_profile_id', partnerIds)
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

  const authById = await getAuthUsersByIds(
    admin,
    rowsRaw.map((r) => r.user_id)
  )

  const rows: PlatformPartnerListItem[] = rowsRaw.map((r) => {
    const agg = aggByPartner.get(r.user_id)
    return {
      userId: r.user_id,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      selectedTenantId: r.selected_tenant_id,
      companyName: r.selected_tenant_id
        ? (companyByTenant.get(r.selected_tenant_id) ?? null)
        : null,
      status: (r.status as 'active' | 'disabled') ?? 'active',
      mustSetPassword: Boolean(r.must_set_password),
      isLegacy: Boolean(r.legacy_portal_customer_id),
      createdAt: r.created_at,
      lastSignInAt: authById.get(r.user_id)?.lastSignInAt ?? null,
      submittedCount: agg?.submitted ?? 0,
      draftCount: agg?.draft ?? 0,
      lastSubmittedAt: agg?.lastSubmittedAt ?? null,
      submitted7d: agg?.submitted7d ?? 0,
      gmv7d: Math.round((agg?.gmv7d ?? 0) * 100) / 100
    }
  })

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
