import type { SupabaseClient } from '@supabase/supabase-js'

import {
  POS_SETTINGS_SELECT,
  type TenantPosSettings
} from '@/lib/pos/settings-types'

function normalizeSettings(row: Record<string, unknown>): TenantPosSettings {
  return {
    tenant_id: row.tenant_id as string,
    card_provider: (row.card_provider as TenantPosSettings['card_provider']) || 'manual',
    teya_env: (row.teya_env as TenantPosSettings['teya_env']) || 'production',
    teya_store_id: (row.teya_store_id as string | null) ?? null,
    teya_terminal_id: (row.teya_terminal_id as string | null) ?? null,
    teya_client_id: (row.teya_client_id as string | null) ?? null,
    teya_client_secret: (row.teya_client_secret as string | null) ?? null,
    teya_epos_instance_id:
      (row.teya_epos_instance_id as string) || 'modul-pos',
    allow_cash: row.allow_cash !== false,
    allow_card: row.allow_card !== false,
    allow_split: row.allow_split !== false,
    default_pay_mode:
      (row.default_pay_mode as TenantPosSettings['default_pay_mode']) ?? null,
    stock_policy: row.stock_policy === 'block' ? 'block' : 'warn',
    max_discount_percent: Math.min(
      100,
      Math.max(0, Number(row.max_discount_percent ?? 100))
    ),
    show_invoice_button: row.show_invoice_button !== false,
    require_customer: Boolean(row.require_customer),
    search_barcode_only: Boolean(row.search_barcode_only),
    allow_pos_quick_create: row.allow_pos_quick_create !== false
  }
}

export async function getPosSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantPosSettings | null> {
  const { data, error } = await supabase
    .from('tenant_pos_settings')
    .select(POS_SETTINGS_SELECT)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    // Migráció előtt: search_barcode_only oszlop hiányzik
    if (
      /search_barcode_only|allow_pos_quick_create/i.test(error.message)
    ) {
      const legacy = await supabase
        .from('tenant_pos_settings')
        .select(
          'tenant_id, card_provider, teya_env, teya_store_id, teya_terminal_id, teya_client_id, teya_client_secret, teya_epos_instance_id, allow_cash, allow_card, allow_split, default_pay_mode, stock_policy, max_discount_percent, show_invoice_button, require_customer, search_barcode_only'
        )
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (legacy.error) {
        // Még a search_barcode_only előtt
        if (/search_barcode_only/i.test(legacy.error.message)) {
          const older = await supabase
            .from('tenant_pos_settings')
            .select(
              'tenant_id, card_provider, teya_env, teya_store_id, teya_terminal_id, teya_client_id, teya_client_secret, teya_epos_instance_id, allow_cash, allow_card, allow_split, default_pay_mode, stock_policy, max_discount_percent, show_invoice_button, require_customer'
            )
            .eq('tenant_id', tenantId)
            .maybeSingle()
          if (older.error) {
            console.error('getPosSettings', older.error.message)
            throw new Error('Nem sikerült betölteni a POS beállításokat.')
          }
          if (!older.data) return null
          return normalizeSettings(older.data as Record<string, unknown>)
        }
        console.error('getPosSettings', legacy.error.message)
        throw new Error('Nem sikerült betölteni a POS beállításokat.')
      }
      if (!legacy.data) return null
      return normalizeSettings(legacy.data as Record<string, unknown>)
    }
    console.error('getPosSettings', error.message)
    throw new Error('Nem sikerült betölteni a POS beállításokat.')
  }
  if (!data) return null
  return normalizeSettings(data as Record<string, unknown>)
}

export async function getOrCreatePosSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantPosSettings> {
  const existing = await getPosSettings(supabase, tenantId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('tenant_pos_settings')
    .insert({
      tenant_id: tenantId,
      card_provider: 'manual',
      teya_env: 'production',
      teya_epos_instance_id: 'modul-pos',
      allow_cash: true,
      allow_card: true,
      allow_split: true,
      stock_policy: 'warn',
      max_discount_percent: 100,
      show_invoice_button: true,
      require_customer: false,
      search_barcode_only: false,
      allow_pos_quick_create: true
    })
    .select(POS_SETTINGS_SELECT)
    .single()

  if (error || !data) {
    // Migráció előtt: új oszlopok nélkül
    if (
      error &&
      /search_barcode_only|allow_pos_quick_create/i.test(error.message)
    ) {
      const { data: legacy, error: legacyErr } = await supabase
        .from('tenant_pos_settings')
        .insert({
          tenant_id: tenantId,
          card_provider: 'manual',
          teya_env: 'production',
          teya_epos_instance_id: 'modul-pos',
          allow_cash: true,
          allow_card: true,
          allow_split: true,
          stock_policy: 'warn',
          max_discount_percent: 100,
          show_invoice_button: true,
          require_customer: false
        })
        .select(
          'tenant_id, card_provider, teya_env, teya_store_id, teya_terminal_id, teya_client_id, teya_client_secret, teya_epos_instance_id, allow_cash, allow_card, allow_split, default_pay_mode, stock_policy, max_discount_percent, show_invoice_button, require_customer'
        )
        .single()
      if (legacyErr || !legacy) {
        console.error('getOrCreatePosSettings', legacyErr?.message)
        throw new Error('Nem sikerült létrehozni a POS beállításokat.')
      }
      return normalizeSettings(legacy as Record<string, unknown>)
    }
    console.error('getOrCreatePosSettings', error?.message)
    throw new Error('Nem sikerült létrehozni a POS beállításokat.')
  }
  return normalizeSettings(data as Record<string, unknown>)
}
