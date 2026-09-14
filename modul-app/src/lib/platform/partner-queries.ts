import type { SupabaseClient } from '@supabase/supabase-js'

import {
  lastSignInMap,
  listAllAuthUsers
} from '@/lib/platform/auth-users'

export type PlatformPartnerListItem = {
  userId: string
  name: string
  email: string
  mobile: string | null
  selectedTenantId: string | null
  companyName: string | null
  createdAt: string
  lastSignInAt: string | null
  submittedCount: number
  draftCount: number
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
}

export async function listPlatformPartners(
  admin: SupabaseClient,
  params: {
    q?: string
    link?: 'all' | 'linked' | 'unlinked'
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

  let query = admin
    .from('partner_profiles')
    .select(
      'user_id, name, email, mobile, selected_tenant_id, created_at',
      { count: 'exact' }
    )

  if (link === 'linked') {
    query = query.not('selected_tenant_id', 'is', null)
  } else if (link === 'unlinked') {
    query = query.is('selected_tenant_id', null)
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

  const draftByPartner = new Map<string, number>()
  const submittedByPartner = new Map<string, number>()
  if (partnerIds.length > 0) {
    const { data: quotes } = await admin
      .from('quotes')
      .select('partner_profile_id, portal_submitted_at')
      .eq('source', 'portal')
      .in('partner_profile_id', partnerIds)
      .is('deleted_at', null)

    for (const qrow of quotes ?? []) {
      const pid = qrow.partner_profile_id as string | null
      if (!pid) continue
      if (qrow.portal_submitted_at) {
        submittedByPartner.set(pid, (submittedByPartner.get(pid) ?? 0) + 1)
      } else {
        draftByPartner.set(pid, (draftByPartner.get(pid) ?? 0) + 1)
      }
    }
  }

  const authUsers = await listAllAuthUsers(admin)
  const signIn = lastSignInMap(authUsers)

  const rows: PlatformPartnerListItem[] = rowsRaw.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    mobile: r.mobile,
    selectedTenantId: r.selected_tenant_id,
    companyName: r.selected_tenant_id
      ? (companyByTenant.get(r.selected_tenant_id) ?? null)
      : null,
    createdAt: r.created_at,
    lastSignInAt: signIn.get(r.user_id) ?? null,
    submittedCount: submittedByPartner.get(r.user_id) ?? 0,
    draftCount: draftByPartner.get(r.user_id) ?? 0
  }))

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

  const { data: quotes } = await admin
    .from('quotes')
    .select('portal_submitted_at, total_gross')
    .eq('partner_profile_id', userId)
    .eq('source', 'portal')
    .is('deleted_at', null)

  let draftCount = 0
  let submittedCount = 0
  let lastSubmittedAt: string | null = null
  let gmvSubmitted = 0
  for (const q of quotes ?? []) {
    if (q.portal_submitted_at) {
      submittedCount += 1
      gmvSubmitted += Number(q.total_gross) || 0
      if (
        !lastSubmittedAt ||
        new Date(q.portal_submitted_at).getTime() >
          new Date(lastSubmittedAt).getTime()
      ) {
        lastSubmittedAt = q.portal_submitted_at
      }
    } else {
      draftCount += 1
    }
  }

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
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    },
    companyName,
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    emailConfirmed: Boolean(authUser?.email_confirmed_at),
    draftCount,
    submittedCount,
    lastSubmittedAt,
    gmvSubmitted: Math.round(gmvSubmitted * 100) / 100
  }
}
