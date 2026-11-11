import type { SupabaseClient } from '@supabase/supabase-js'

import { getInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import { normalizeAutoProformaDueDays } from '@/lib/partner/auto-proforma-rules'
import type { UnifiedSearchKind } from '@/lib/search/materials-search'

export type AutoProformaReadiness = {
  hasAgentKey: boolean
  /** Átutalás aktív és a partner is választhatja. */
  transferActive: boolean
}

export type PartnerAutoProformaView = AutoProformaReadiness & {
  enabled: boolean
  dueDays: number
}

export async function getAutoProformaReadiness(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AutoProformaReadiness> {
  const [invoiceSettings, transfer] = await Promise.all([
    getInvoiceSettings(supabase, tenantId).catch(() => null),
    supabase
      .from('payment_methods')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('kind', 'transfer')
      .eq('active', true)
      .eq('partner_visible', true)
      .is('deleted_at', null)
      .maybeSingle()
  ])
  return {
    hasAgentKey: hasAgentKey(invoiceSettings),
    transferActive: Boolean(transfer.data)
  }
}

export async function getPartnerAutoProformaView(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PartnerAutoProformaView> {
  const [row, readiness] = await Promise.all([
    supabase
      .from('tenant_partner_settings')
      .select('auto_proforma_on_transfer, auto_proforma_due_days')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    getAutoProformaReadiness(supabase, tenantId)
  ])
  return {
    ...readiness,
    enabled: Boolean(row.data?.auto_proforma_on_transfer),
    dueDays: normalizeAutoProformaDueDays(row.data?.auto_proforma_due_days)
  }
}

export type TenantPartnerSettings = {
  tenantId: string
  searchSheet: boolean
  searchLinear: boolean
  searchAccessory: boolean
}

export type PartnerSearchKinds = {
  sheet: boolean
  linear: boolean
  accessory: boolean
}

const DEFAULT_KINDS: PartnerSearchKinds = {
  sheet: true,
  linear: true,
  accessory: true
}

export function defaultPartnerSearchKinds(): PartnerSearchKinds {
  return { ...DEFAULT_KINDS }
}

export function partnerSearchKindsFromSettings(
  row: TenantPartnerSettings | null
): PartnerSearchKinds {
  if (!row) return defaultPartnerSearchKinds()
  return {
    sheet: row.searchSheet,
    linear: row.searchLinear,
    accessory: row.searchAccessory
  }
}

/** Engedélyezett kind lista (üres soha — fallback mindhárom). */
export function allowedUnifiedKinds(
  kinds: PartnerSearchKinds
): UnifiedSearchKind[] {
  const out: UnifiedSearchKind[] = []
  if (kinds.sheet) out.push('sheet')
  if (kinds.linear) out.push('linear')
  if (kinds.accessory) out.push('accessory')
  return out.length > 0 ? out : (['sheet', 'linear', 'accessory'] as const)
}

/**
 * Partner kérés `kind` + tenant beállítás → tényleges keresési kind.
 * `all` = csak az engedélyezett források uniója (searchMaterialsUnified-ban
 * a want* flag-ekkel szűrünk).
 */
export function resolvePartnerSearchKind(
  requested: UnifiedSearchKind | 'all',
  kinds: PartnerSearchKinds
): UnifiedSearchKind | 'all' {
  const allowed = new Set(allowedUnifiedKinds(kinds))
  if (requested === 'all') return 'all'
  if (allowed.has(requested)) return requested
  if (allowed.size === 1) return [...allowed][0]!
  return 'all'
}

const SETTINGS_TTL_MS = 60_000
const settingsCache = new Map<
  string,
  { at: number; value: TenantPartnerSettings | null }
>()

export function invalidateTenantPartnerSettingsCache(tenantId?: string) {
  if (tenantId) settingsCache.delete(tenantId)
  else settingsCache.clear()
}

export async function getTenantPartnerSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantPartnerSettings | null> {
  const cached = settingsCache.get(tenantId)
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) {
    return cached.value
  }

  const { data, error } = await supabase
    .from('tenant_partner_settings')
    .select(
      'tenant_id, search_sheet, search_linear, search_accessory'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getTenantPartnerSettings', error.message)
    throw new Error('Nem sikerült betölteni a partner beállításokat.')
  }

  const value = data
    ? {
        tenantId: data.tenant_id as string,
        searchSheet: Boolean(data.search_sheet),
        searchLinear: Boolean(data.search_linear),
        searchAccessory: Boolean(data.search_accessory)
      }
    : null

  settingsCache.set(tenantId, { at: Date.now(), value })
  return value
}
