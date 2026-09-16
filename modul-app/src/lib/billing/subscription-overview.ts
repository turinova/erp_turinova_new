import type { SupabaseClient } from '@supabase/supabase-js'

import { currentUtcYearMonth } from '@/lib/billing/estimate'

export type SubscriptionBillingStatus =
  | 'none'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'

export type SubscriptionAddonRow = {
  key: string
  name: string
  description: string | null
  enabled: boolean
}

export type SmsUsageSummary = {
  year: number
  month: number
  sentCount: number
  unitPriceHuf: number
  estimatedCostHuf: number
}

export type TenantSubscriptionOverview = {
  billingStatus: SubscriptionBillingStatus
  trialEndsAt: string | null
  paidThrough: string | null
  plan: { key: string; name: string } | null
  addons: SubscriptionAddonRow[]
  /** Aktuális hónap SMS usage — csak ha az SMS add-on be van kapcsolva. */
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
      .select(
        'billing_status, trial_ends_at, paid_through, product_plans ( key, name )'
      )
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('product_addons')
      .select('id, key, name, description')
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

  const enabledIds = new Set(
    (enabledRows ?? []).map((r) => r.addon_id as string)
  )

  const addons: SubscriptionAddonRow[] = (catalog ?? []).map((a) => ({
    key: a.key as string,
    name: a.name as string,
    description: (a.description as string | null) ?? null,
    enabled: enabledIds.has(a.id as string)
  }))

  const status = (tenant?.billing_status as string) || 'none'
  const billingStatus: SubscriptionBillingStatus =
    status === 'trial' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled'
      ? status
      : 'none'

  const smsEnabled =
    smsAddon?.id != null && enabledIds.has(smsAddon.id as string)
  const unitPriceHuf = Number(smsAddon?.price_unit_huf) || 95
  const sentCount = smsCount ?? 0

  return {
    billingStatus,
    trialEndsAt: tenant?.trial_ends_at ?? null,
    paidThrough: tenant?.paid_through ?? null,
    plan: planRow ? { key: planRow.key, name: planRow.name } : null,
    addons,
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
