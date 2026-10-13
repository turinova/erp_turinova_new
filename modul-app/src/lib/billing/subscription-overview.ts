import type { SupabaseClient } from '@supabase/supabase-js'

import {
  deriveAccessStatus,
  parseAccessSource,
  toDateOnly,
  type DerivedAccessStatus
} from '@/lib/billing/access'
import { currentUtcYearMonth } from '@/lib/billing/estimate'
import {
  filterSubscriptionExtras,
  normalizePlanKey,
  type SubscriptionExtra
} from '@/lib/billing/plan-subscription-copy'
import type { PlanKey } from '@/lib/platform/plan-bundles'

export type SmsUsageSummary = {
  year: number
  month: number
  sentCount: number
  unitPriceHuf: number
  estimatedCostHuf: number
}

export type TenantSubscriptionOverview = {
  accessUntil: string | null
  accessSource: 'trial' | 'paid' | 'manual' | null
  derivedStatus: DerivedAccessStatus
  planKey: PlanKey | null
  planName: string | null
  /** Planen kívüli bekapcsolt extras (à la carte). */
  extras: SubscriptionExtra[]
  /** Aktuális hónap SMS — ha az SMS entitlement él. */
  smsUsage: SmsUsageSummary | null
}

export async function getTenantSubscriptionOverview(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantSubscriptionOverview> {
  const ym = currentUtcYearMonth()
  const start = new Date(Date.UTC(ym.year, ym.month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(ym.year, ym.month, 1)).toISOString()

  const [
    { data: tenant },
    { data: catalog },
    { data: enabledRows },
    { data: smsAddon },
    { count: smsCount }
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('access_until, access_source, product_plans ( key, name )')
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('product_addons')
      .select('id, key, name')
      .eq('active', true)
      .order('name', { ascending: true }),
    supabase
      .from('tenant_addons')
      .select('addon_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('product_addons')
      .select('id, price_unit_huf')
      .eq('key', 'quote_ready_sms')
      .maybeSingle(),
    supabase
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'delivered'])
      .gte('created_at', start)
      .lt('created_at', end)
  ])

  const planRaw = tenant?.product_plans as
    | { key: string; name: string }
    | { key: string; name: string }[]
    | null
  const planRow = Array.isArray(planRaw) ? planRaw[0] : planRaw
  const planKey = normalizePlanKey(planRow?.key ?? null)

  const enabledIds = new Set(
    (enabledRows ?? []).map((r) => r.addon_id as string)
  )

  const enabledAddons = (catalog ?? [])
    .filter((a) => enabledIds.has(a.id as string))
    .map((a) => ({
      key: a.key as string,
      name: a.name as string
    }))

  const extras = filterSubscriptionExtras({
    planKey,
    enabled: enabledAddons
  })

  const accessUntil = toDateOnly(tenant?.access_until as string | null)
  const accessSource = parseAccessSource(
    tenant?.access_source as string | null
  )
  const derivedStatus = deriveAccessStatus({
    accessUntil,
    accessSource
  })

  const smsEnabled =
    smsAddon?.id != null && enabledIds.has(smsAddon.id as string)
  const unitPriceHuf = Number(smsAddon?.price_unit_huf) || 89
  const sentCount = smsCount ?? 0

  return {
    accessUntil,
    accessSource,
    derivedStatus,
    planKey,
    planName: planRow?.name ?? null,
    extras,
    smsUsage: smsEnabled
      ? {
          year: ym.year,
          month: ym.month,
          sentCount,
          unitPriceHuf,
          estimatedCostHuf: sentCount * unitPriceHuf
        }
      : null
  }
}
