import type { SupabaseClient } from '@supabase/supabase-js'

import {
  lastSignInMap,
  listAllAuthUsersCached
} from '@/lib/platform/auth-users'

export type PeriodStats = {
  count: number
  gmv: number
}

export type SourceSplit = {
  opti: PeriodStats
  portal: PeriodStats
  other: PeriodStats
  total: PeriodStats
}

export type PlatformOverviewStats = {
  /** Élő (active) cégek */
  activeTenants: number
  /** Legalább 1 tag login az elmúlt 24ó / 7d / 30d */
  tenantsActive24h: number
  tenantsActive7d: number
  tenantsActive30d: number
  tenantsActive7dPrev: number
  /** Aktív tenant, ahol senki sem lépett be soha */
  tenantsNeverLoggedIn: number
  /** Seat-ek akik beléptek 7d */
  seatsActive7d: number
  seatsActive7dPrev: number

  quotes24h: SourceSplit
  quotes7d: SourceSplit
  quotes7dPrev: SourceSplit
  quotes30d: SourceSplit

  orders24h: PeriodStats
  orders7d: PeriodStats
  orders7dPrev: PeriodStats
  orders30d: PeriodStats

  payments7d: number
  payments7dPrev: number

  partnersTotal: number
  partnersLinked: number
  partnersUnlinked: number
  partnersActive7d: number
  partnersActive7dPrev: number
  portalSubmits7d: PeriodStats
  portalSubmits7dPrev: PeriodStats
  portalDraftsAlive: number
  tenantsWithPartnerOrders: number

  topTenantsGmv30d: Array<{
    tenantId: string
    name: string
    gmv: number
    quoteCount: number
  }>
}

function emptyPeriod(): PeriodStats {
  return { count: 0, gmv: 0 }
}

function emptySplit(): SourceSplit {
  return {
    opti: emptyPeriod(),
    portal: emptyPeriod(),
    other: emptyPeriod(),
    total: emptyPeriod()
  }
}

function addTo(
  target: PeriodStats,
  gross: number
) {
  target.count += 1
  target.gmv += gross
}

function sourceBucket(
  split: SourceSplit,
  source: string | null,
  gross: number
) {
  addTo(split.total, gross)
  if (source === 'portal') addTo(split.portal, gross)
  else if (source === 'opti') addTo(split.opti, gross)
  else addTo(split.other, gross)
}

function inRange(iso: string | null | undefined, from: number, to: number) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from && t < to
}

function roundGmv(n: number) {
  return Math.round(n * 100) / 100
}

function finalizeSplit(s: SourceSplit): SourceSplit {
  return {
    opti: { count: s.opti.count, gmv: roundGmv(s.opti.gmv) },
    portal: { count: s.portal.count, gmv: roundGmv(s.portal.gmv) },
    other: { count: s.other.count, gmv: roundGmv(s.other.gmv) },
    total: { count: s.total.count, gmv: roundGmv(s.total.gmv) }
  }
}

function finalizePeriod(p: PeriodStats): PeriodStats {
  return { count: p.count, gmv: roundGmv(p.gmv) }
}

/** Platform áttekintés — aktivitás, GMV, partner csatorna. */
export async function getPlatformOverviewStats(
  admin: SupabaseClient
): Promise<PlatformOverviewStats> {
  const now = Date.now()
  const h24 = now - 24 * 60 * 60 * 1000
  const d7 = now - 7 * 24 * 60 * 60 * 1000
  const d14 = now - 14 * 24 * 60 * 60 * 1000
  const d30 = now - 30 * 24 * 60 * 60 * 1000
  const since30Iso = new Date(d30).toISOString()

  const [
    { count: activeTenants },
    { data: activeTenantRows },
    { data: memberships },
    { data: quotes },
    { data: payments },
    { data: partners },
    { count: portalDraftsAlive },
    { data: partnerEntitlements },
    authUsers
  ] = await Promise.all([
    admin
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    admin.from('tenants').select('id, name').eq('status', 'active'),
    admin.from('tenant_memberships').select('tenant_id, user_id'),
    admin
      .from('quotes')
      .select(
        'id, tenant_id, source, total_gross, created_at, ordered_at, portal_submitted_at, order_number'
      )
      .is('deleted_at', null)
      .or(
        `created_at.gte.${since30Iso},ordered_at.gte.${since30Iso},portal_submitted_at.gte.${since30Iso}`
      ),
    admin
      .from('quote_payments')
      .select('amount, payment_date')
      .is('deleted_at', null)
      .gte('payment_date', since30Iso),
    admin
      .from('partner_profiles')
      .select('user_id, selected_tenant_id, created_at'),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null),
    admin
      .from('tenant_entitlements')
      .select('tenant_id')
      .eq('feature_key', 'partner_orders'),
    listAllAuthUsersCached(admin)
  ])

  const activeIds = new Set((activeTenantRows ?? []).map((t) => t.id))
  const tenantName = new Map(
    (activeTenantRows ?? []).map((t) => [t.id, t.name as string])
  )
  const signIn = lastSignInMap(authUsers)

  const tenantHasAnyLogin = new Map<string, boolean>()
  const tenantActive24h = new Set<string>()
  const tenantActive7d = new Set<string>()
  const tenantActive7dPrev = new Set<string>()
  const tenantActive30d = new Set<string>()
  const seats7d = new Set<string>()
  const seats7dPrev = new Set<string>()

  for (const m of memberships ?? []) {
    if (!activeIds.has(m.tenant_id)) continue
    const last = signIn.get(m.user_id) ?? null
    if (last) {
      tenantHasAnyLogin.set(m.tenant_id, true)
      const t = new Date(last).getTime()
      if (t >= h24) tenantActive24h.add(m.tenant_id)
      if (t >= d7) {
        tenantActive7d.add(m.tenant_id)
        seats7d.add(m.user_id)
      } else if (t >= d14) {
        tenantActive7dPrev.add(m.tenant_id)
        seats7dPrev.add(m.user_id)
      }
      if (t >= d30) tenantActive30d.add(m.tenant_id)
    } else if (!tenantHasAnyLogin.has(m.tenant_id)) {
      tenantHasAnyLogin.set(m.tenant_id, false)
    }
  }

  // Prev window tenants that were only active in prev (already tracked);
  // also count tenants active in prev even if also in current — for Δ we compare set sizes of activity in each window.
  for (const m of memberships ?? []) {
    if (!activeIds.has(m.tenant_id)) continue
    const last = signIn.get(m.user_id) ?? null
    if (!last) continue
    const t = new Date(last).getTime()
    if (t >= d14 && t < d7) {
      tenantActive7dPrev.add(m.tenant_id)
      seats7dPrev.add(m.user_id)
    }
  }

  let tenantsNeverLoggedIn = 0
  for (const id of activeIds) {
    if (!tenantHasAnyLogin.get(id)) tenantsNeverLoggedIn += 1
  }

  const quotes24h = emptySplit()
  const quotes7d = emptySplit()
  const quotes7dPrev = emptySplit()
  const quotes30d = emptySplit()
  const orders24h = emptyPeriod()
  const orders7d = emptyPeriod()
  const orders7dPrev = emptyPeriod()
  const orders30d = emptyPeriod()
  const portalSubmits7d = emptyPeriod()
  const portalSubmits7dPrev = emptyPeriod()

  const gmv30ByTenant = new Map<string, { gmv: number; quoteCount: number }>()

  for (const q of quotes ?? []) {
    const gross = Number(q.total_gross) || 0
    const source = q.source as string

    if (inRange(q.created_at, h24, now)) sourceBucket(quotes24h, source, gross)
    if (inRange(q.created_at, d7, now)) sourceBucket(quotes7d, source, gross)
    if (inRange(q.created_at, d14, d7)) sourceBucket(quotes7dPrev, source, gross)
    if (inRange(q.created_at, d30, now)) {
      sourceBucket(quotes30d, source, gross)
      if (activeIds.has(q.tenant_id)) {
        const cur = gmv30ByTenant.get(q.tenant_id) ?? {
          gmv: 0,
          quoteCount: 0
        }
        cur.gmv += gross
        cur.quoteCount += 1
        gmv30ByTenant.set(q.tenant_id, cur)
      }
    }

    // Orders: prefer ordered_at; fallback order_number + created/updated not used
    const orderedAt =
      q.ordered_at ??
      (q.order_number ? q.created_at : null)
    if (inRange(orderedAt, h24, now)) addTo(orders24h, gross)
    if (inRange(orderedAt, d7, now)) addTo(orders7d, gross)
    if (inRange(orderedAt, d14, d7)) addTo(orders7dPrev, gross)
    if (inRange(orderedAt, d30, now)) addTo(orders30d, gross)

    if (q.source === 'portal') {
      if (inRange(q.portal_submitted_at, d7, now)) {
        addTo(portalSubmits7d, gross)
      }
      if (inRange(q.portal_submitted_at, d14, d7)) {
        addTo(portalSubmits7dPrev, gross)
      }
    }
  }

  let payments7d = 0
  let payments7dPrev = 0
  for (const p of payments ?? []) {
    const amount = Number(p.amount) || 0
    if (inRange(p.payment_date, d7, now)) payments7d += amount
    if (inRange(p.payment_date, d14, d7)) payments7dPrev += amount
  }

  const partnerRows = partners ?? []
  let partnersLinked = 0
  let partnersActive7d = 0
  let partnersActive7dPrev = 0
  for (const p of partnerRows) {
    if (p.selected_tenant_id) partnersLinked += 1
    const last = signIn.get(p.user_id) ?? null
    if (last) {
      const t = new Date(last).getTime()
      if (t >= d7) partnersActive7d += 1
      else if (t >= d14) partnersActive7dPrev += 1
      if (t >= d14 && t < d7) partnersActive7dPrev += 1
    }
  }
  // Fix double-count on partnersActive7dPrev — recount cleanly
  partnersActive7d = 0
  partnersActive7dPrev = 0
  for (const p of partnerRows) {
    const last = signIn.get(p.user_id) ?? null
    if (!last) continue
    const t = new Date(last).getTime()
    if (t >= d7) partnersActive7d += 1
    if (t >= d14 && t < d7) partnersActive7dPrev += 1
  }

  const entitlementTenantIds = new Set(
    (partnerEntitlements ?? []).map((e) => e.tenant_id)
  )
  let tenantsWithPartnerOrders = 0
  for (const id of entitlementTenantIds) {
    if (activeIds.has(id)) tenantsWithPartnerOrders += 1
  }

  const topTenantsGmv30d = [...gmv30ByTenant.entries()]
    .map(([tenantId, v]) => ({
      tenantId,
      name: tenantName.get(tenantId) ?? tenantId.slice(0, 8),
      gmv: roundGmv(v.gmv),
      quoteCount: v.quoteCount
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 5)

  return {
    activeTenants: activeTenants ?? 0,
    tenantsActive24h: tenantActive24h.size,
    tenantsActive7d: tenantActive7d.size,
    tenantsActive30d: tenantActive30d.size,
    tenantsActive7dPrev: tenantActive7dPrev.size,
    tenantsNeverLoggedIn,
    seatsActive7d: seats7d.size,
    seatsActive7dPrev: seats7dPrev.size,
    quotes24h: finalizeSplit(quotes24h),
    quotes7d: finalizeSplit(quotes7d),
    quotes7dPrev: finalizeSplit(quotes7dPrev),
    quotes30d: finalizeSplit(quotes30d),
    orders24h: finalizePeriod(orders24h),
    orders7d: finalizePeriod(orders7d),
    orders7dPrev: finalizePeriod(orders7dPrev),
    orders30d: finalizePeriod(orders30d),
    payments7d: roundGmv(payments7d),
    payments7dPrev: roundGmv(payments7dPrev),
    partnersTotal: partnerRows.length,
    partnersLinked,
    partnersUnlinked: partnerRows.length - partnersLinked,
    partnersActive7d,
    partnersActive7dPrev,
    portalSubmits7d: finalizePeriod(portalSubmits7d),
    portalSubmits7dPrev: finalizePeriod(portalSubmits7dPrev),
    portalDraftsAlive: portalDraftsAlive ?? 0,
    tenantsWithPartnerOrders,
    topTenantsGmv30d
  }
}

export function formatPlatformHuf(amount: number): string {
  return (
    new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 0
    }).format(Math.round(amount)) + ' Ft'
  )
}

export function deltaLabel(current: number, previous: number): string | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) return current > 0 ? '+100%' : null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return '±0%'
  return pct > 0 ? `+${pct}%` : `${pct}%`
}
