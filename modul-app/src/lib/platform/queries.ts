import type { SupabaseClient } from '@supabase/supabase-js'

import type { TenantStatus } from '@/lib/supabase/database.types'
import {
  onboardingProgress,
  type OnboardingFlags
} from '@/lib/platform/onboarding'
import { listTenantEntitledKeys } from '@/lib/platform/entitlements'
import { ALL_PAGE_KEYS } from '@/lib/permissions/pages'

export type PlatformTenantListItem = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  created_at: string
  memberCount: number
  onboardingPercent: number
  onboarding: OnboardingFlags | null
}

export type PlatformDashboardStats = {
  activeTenants: number
  /** Legalább egy tag last_sign_in az elmúlt 7 napban */
  tenantsActive7d: number
  /** Aktív tenant, ahol egyetlen tag sem lépett be soha */
  tenantsNeverLoggedIn: number
  quotes7d: number
  orders7d: number
}

/** @deprecated Prefer getPlatformOverviewStats — kompatibilitás. */
export async function getPlatformDashboardStats(
  admin: SupabaseClient
): Promise<PlatformDashboardStats> {
  const { getPlatformOverviewStats } = await import(
    '@/lib/platform/partner-overview'
  )
  const o = await getPlatformOverviewStats(admin)
  return {
    activeTenants: o.activeTenants,
    tenantsActive7d: o.tenantsActive7d,
    tenantsNeverLoggedIn: o.tenantsNeverLoggedIn,
    quotes7d: o.quotes7d.total.count,
    orders7d: o.orders7d.count
  }
}

export type PlatformAttentionItem = {
  id: string
  name: string
  /** Tenant status, or synthetic for partners */
  status: TenantStatus | 'active'
  reason: string
  href: string
  kind?: 'tenant' | 'partner'
}

export async function listPlatformTenants(
  admin: SupabaseClient,
  params: { q?: string; status?: TenantStatus | 'all'; page?: number; limit?: number }
): Promise<{ rows: PlatformTenantListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const status = params.status ?? 'all'

  let query = admin
    .from('tenants')
    .select('id, name, slug, status, created_at', { count: 'exact' })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPlatformTenants', error.message)
    throw new Error('Nem sikerült betölteni a cégeket.')
  }

  const tenants = data ?? []
  const ids = tenants.map((t) => t.id)

  const memberCountByTenant: Record<string, number> = {}
  const onboardingByTenant: Record<string, OnboardingFlags> = {}

  if (ids.length > 0) {
    const [{ data: memberships }, { data: onboarding }] = await Promise.all([
      admin
        .from('tenant_memberships')
        .select('tenant_id')
        .in('tenant_id', ids),
      admin
        .from('tenant_onboarding')
        .select(
          'tenant_id, company_profile_done, first_login_at, has_sheet_material, has_edge_material, has_quote, has_order'
        )
        .in('tenant_id', ids)
    ])

    for (const m of memberships ?? []) {
      memberCountByTenant[m.tenant_id] =
        (memberCountByTenant[m.tenant_id] ?? 0) + 1
    }
    for (const o of onboarding ?? []) {
      onboardingByTenant[o.tenant_id] = {
        company_profile_done: o.company_profile_done,
        first_login_at: o.first_login_at,
        has_sheet_material: o.has_sheet_material,
        has_edge_material: o.has_edge_material,
        has_quote: o.has_quote,
        has_order: o.has_order
      }
    }
  }

  const rows: PlatformTenantListItem[] = tenants.map((t) => {
    const flags = onboardingByTenant[t.id] ?? null
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status as TenantStatus,
      created_at: t.created_at,
      memberCount: memberCountByTenant[t.id] ?? 0,
      onboardingPercent: onboardingProgress(flags).percent,
      onboarding: flags
    }
  })

  return { rows, total: count ?? 0, page, limit }
}

/** Figyelmet igénylő cégek + partnerek — használat / gond, nem státusz-inventory. */
export async function listPlatformAttentionItems(
  admin: SupabaseClient
): Promise<PlatformAttentionItem[]> {
  const { rows } = await listPlatformTenants(admin, {
    status: 'all',
    page: 1,
    limit: 50
  })

  const { data: memberships } = await admin
    .from('tenant_memberships')
    .select('tenant_id, user_id')
  const { listAllAuthUsers, lastSignInMap } = await import(
    '@/lib/platform/auth-users'
  )
  const authUsers = await listAllAuthUsers(admin)
  const lastSignInByUser = lastSignInMap(authUsers)

  const tenantNeverLogin = new Set<string>()
  const tenantIds = new Set(rows.map((r) => r.id))
  const hasLogin = new Map<string, boolean>()
  for (const m of memberships ?? []) {
    if (!tenantIds.has(m.tenant_id)) continue
    const last = lastSignInByUser.get(m.user_id)
    if (last) hasLogin.set(m.tenant_id, true)
    else if (!hasLogin.has(m.tenant_id)) hasLogin.set(m.tenant_id, false)
  }
  for (const id of tenantIds) {
    if (!hasLogin.get(id)) tenantNeverLogin.add(id)
  }

  const items: PlatformAttentionItem[] = []
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000
  const now = Date.now()

  for (const t of rows) {
    if (t.status === 'churned') continue
    if (t.status === 'provisioning') {
      items.push({
        id: t.id,
        name: t.name,
        status: t.status,
        reason: 'Beállítás alatt',
        href: `/platform/tenants/${t.id}`,
        kind: 'tenant'
      })
      continue
    }
    if (t.status === 'suspended') {
      items.push({
        id: t.id,
        name: t.name,
        status: t.status,
        reason: 'Felfüggesztve',
        href: `/platform/tenants/${t.id}`,
        kind: 'tenant'
      })
      continue
    }
    if (tenantNeverLogin.has(t.id) && t.status === 'active') {
      items.push({
        id: t.id,
        name: t.name,
        status: t.status,
        reason: 'Még sosem lépett be senki',
        href: `/platform/tenants/${t.id}`,
        kind: 'tenant'
      })
      continue
    }
    if (
      t.onboardingPercent < 100 &&
      now - new Date(t.created_at).getTime() > weekMs
    ) {
      items.push({
        id: t.id,
        name: t.name,
        status: t.status,
        reason: `Onboarding ${t.onboardingPercent}%`,
        href: `/platform/tenants/${t.id}`,
        kind: 'tenant'
      })
    }
  }

  const { data: partners } = await admin
    .from('partner_profiles')
    .select('user_id, name, email, selected_tenant_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  for (const p of partners ?? []) {
    const last = lastSignInByUser.get(p.user_id) ?? null
    const age = now - new Date(p.created_at).getTime()
    if (!p.selected_tenant_id && age > threeDaysMs) {
      items.push({
        id: p.user_id,
        name: p.name || p.email,
        status: 'active',
        reason: 'Partner cég nélkül',
        href: `/platform/partnerek/${p.user_id}`,
        kind: 'partner'
      })
      continue
    }
    if (!last && age > weekMs) {
      items.push({
        id: p.user_id,
        name: p.name || p.email,
        status: 'active',
        reason: 'Partner sosem lépett be',
        href: `/platform/partnerek/${p.user_id}`,
        kind: 'partner'
      })
    }
  }

  return items.slice(0, 16)
}

export type HealthCheckResult = {
  id: string
  label: string
  ok: boolean
  detail: string
}

export async function runPlatformHealthChecks(
  admin: SupabaseClient
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  try {
    const { error } = await admin.from('tenants').select('id').limit(1)
    results.push({
      id: 'db',
      label: 'Postgres',
      ok: !error,
      detail: error ? error.message : 'Kapcsolat OK'
    })
  } catch (e) {
    results.push({
      id: 'db',
      label: 'Postgres',
      ok: false,
      detail: e instanceof Error ? e.message : 'Hiba'
    })
  }

  try {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    results.push({
      id: 'auth',
      label: 'Auth',
      ok: !error,
      detail: error ? error.message : 'Admin API OK'
    })
  } catch (e) {
    results.push({
      id: 'auth',
      label: 'Auth',
      ok: false,
      detail: e instanceof Error ? e.message : 'Hiba'
    })
  }

  try {
    const { data, error } = await admin.storage.listBuckets()
    const hasSheet = (data ?? []).some((b) => b.name === 'sheet-materials')
    results.push({
      id: 'storage',
      label: 'Storage',
      ok: !error && hasSheet,
      detail: error
        ? error.message
        : hasSheet
          ? 'sheet-materials bucket OK'
          : 'sheet-materials bucket hiányzik'
    })
  } catch (e) {
    results.push({
      id: 'storage',
      label: 'Storage',
      ok: false,
      detail: e instanceof Error ? e.message : 'Hiba'
    })
  }

  results.push({
    id: 'service_role',
    label: 'Service role env',
    ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    detail: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'Beállítva'
      : 'SUPABASE_SERVICE_ROLE_KEY hiányzik'
  })

  return results
}

export async function seedOwnerPageAccess(
  admin: SupabaseClient,
  tenantId: string,
  membershipId: string
) {
  const entitled = await listTenantEntitledKeys(admin, tenantId)
  const keys = entitled.length > 0 ? entitled : ALL_PAGE_KEYS
  const rows = keys.map((page_key) => ({
    tenant_id: tenantId,
    membership_id: membershipId,
    page_key,
    can_access: true
  }))
  const { error } = await admin
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })
  if (error) {
    console.error('seedOwnerPageAccess', error.message)
    throw new Error('Oldaljogok seedelése sikertelen.')
  }
}

export type PlatformTenantMember = {
  membershipId: string
  userId: string
  email: string
  role: string
  roleKey: string
  createdAt: string
  lastSignInAt: string | null
  emailConfirmed: boolean
  banned: boolean
}

export type PlatformTenantKpis = {
  memberCount: number
  quoteCount: number
  orderCount: number
  sheetCount: number
  edgeCount: number
  daysSinceCreated: number
  lastSignInAt: string | null
  activeLogins7d: number
  activeLogins30d: number
  /** Új ajánlatok bruttó 30 nap (HUF) */
  gmvQuotes30d: number
  /** Linked partner count (selected_tenant_id) */
  linkedPartners: number
  /** Portal beküldés 30 nap */
  portalSubmits30d: number
}

export type PlatformCompanySnapshot = {
  name: string
  email: string | null
  phone_number: string | null
  tax_number: string | null
  city: string | null
  address: string | null
  postal_code: string | null
  country: string
} | null

export type PlatformTenantDetail = {
  tenant: {
    id: string
    name: string
    slug: string
    status: TenantStatus
    created_at: string
    max_seats: number | null
  }
  onboarding: OnboardingFlags | null
  kpis: PlatformTenantKpis
  members: PlatformTenantMember[]
  company: PlatformCompanySnapshot
}

export async function getPlatformTenantDetail(
  admin: SupabaseClient,
  tenantId: string
): Promise<PlatformTenantDetail | null> {
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, name, slug, status, created_at, max_seats')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !tenant) return null

  const [
    { data: onboarding },
    { data: memberships },
    { data: company },
    { count: quoteCount },
    { count: orderCount },
    { count: sheetCount },
    { count: edgeCount },
    { data: quotes30d },
    { count: linkedPartners },
    { count: portalSubmits30d }
  ] = await Promise.all([
    admin
      .from('tenant_onboarding')
      .select(
        'company_profile_done, first_login_at, has_sheet_material, has_edge_material, has_quote, has_order'
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_memberships')
      .select('id, user_id, role, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    admin
      .from('tenant_companies')
      .select(
        'name, email, phone_number, tax_number, city, address, postal_code, country'
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('order_number', 'is', null)
      .is('deleted_at', null),
    admin
      .from('sheet_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('edge_materials')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    admin
      .from('quotes')
      .select('total_gross')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte(
        'created_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('selected_tenant_id', tenantId),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source', 'portal')
      .not('portal_submitted_at', 'is', null)
      .is('deleted_at', null)
      .gte(
        'portal_submitted_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
  ])

  const gmvQuotes30d = Math.round(
    ((quotes30d ?? []).reduce(
      (sum, q) => sum + (Number(q.total_gross) || 0),
      0
    ) *
      100) /
      100
  )

  const { listAllAuthUsers } = await import('@/lib/platform/auth-users')
  const listedUsers = await listAllAuthUsers(admin)
  const authById = new Map(
    listedUsers.map((u) => [
      u.id,
      {
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmed: Boolean(u.email_confirmed_at),
        banned: Boolean(u.banned_until)
      }
    ])
  )

  const { TENANT_ROLE_LABELS } = await import('@/lib/tenancy/memberships')

  const members: PlatformTenantMember[] = (memberships ?? []).map((m) => {
    const auth = authById.get(m.user_id)
    return {
      membershipId: m.id,
      userId: m.user_id,
      email: auth?.email ?? m.user_id.slice(0, 8),
      role:
        TENANT_ROLE_LABELS[m.role as keyof typeof TENANT_ROLE_LABELS] ?? m.role,
      roleKey: m.role,
      createdAt: m.created_at,
      lastSignInAt: auth?.lastSignInAt ?? null,
      emailConfirmed: auth?.emailConfirmed ?? false,
      banned: auth?.banned ?? false
    }
  })

  const now = Date.now()
  const day7 = now - 7 * 24 * 60 * 60 * 1000
  const day30 = now - 30 * 24 * 60 * 60 * 1000
  let lastSignInAt: string | null = null
  let activeLogins7d = 0
  let activeLogins30d = 0
  for (const m of members) {
    if (!m.lastSignInAt) continue
    const t = new Date(m.lastSignInAt).getTime()
    if (!lastSignInAt || t > new Date(lastSignInAt).getTime()) {
      lastSignInAt = m.lastSignInAt
    }
    if (t >= day7) activeLogins7d += 1
    if (t >= day30) activeLogins30d += 1
  }

  const daysSinceCreated = Math.max(
    0,
    Math.floor(
      (now - new Date(tenant.created_at).getTime()) / (24 * 60 * 60 * 1000)
    )
  )

  const flags: OnboardingFlags | null = onboarding
    ? {
        company_profile_done: onboarding.company_profile_done,
        first_login_at: onboarding.first_login_at,
        has_sheet_material: onboarding.has_sheet_material,
        has_edge_material: onboarding.has_edge_material,
        has_quote: onboarding.has_quote,
        has_order: onboarding.has_order
      }
    : null

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status as TenantStatus,
      created_at: tenant.created_at,
      max_seats:
        tenant.max_seats === null || tenant.max_seats === undefined
          ? null
          : Number(tenant.max_seats)
    },
    onboarding: flags,
    kpis: {
      memberCount: members.length,
      quoteCount: quoteCount ?? 0,
      orderCount: orderCount ?? 0,
      sheetCount: sheetCount ?? 0,
      edgeCount: edgeCount ?? 0,
      daysSinceCreated,
      lastSignInAt,
      activeLogins7d,
      activeLogins30d,
      gmvQuotes30d,
      linkedPartners: linkedPartners ?? 0,
      portalSubmits30d: portalSubmits30d ?? 0
    },
    members,
    company: company
      ? {
          name: company.name,
          email: company.email,
          phone_number: company.phone_number,
          tax_number: company.tax_number,
          city: company.city,
          address: company.address,
          postal_code: company.postal_code,
          country: company.country
        }
      : null
  }
}
