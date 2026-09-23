import type { SupabaseClient } from '@supabase/supabase-js'

import type { TenantInvoiceSettings } from '@/lib/invoicing/types'

export async function getInvoiceSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantInvoiceSettings | null> {
  const { data, error } = await supabase
    .from('tenant_invoice_settings')
    .select(
      'tenant_id, provider, agent_key, api_url, default_send_email, default_language'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    console.error('getInvoiceSettings', error.message)
    throw new Error('Nem sikerült betölteni a számlázási beállításokat.')
  }
  return data as TenantInvoiceSettings | null
}

export async function getOrCreateInvoiceSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantInvoiceSettings> {
  const existing = await getInvoiceSettings(supabase, tenantId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('tenant_invoice_settings')
    .insert({
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      default_send_email: true,
      default_language: 'hu'
    })
    .select(
      'tenant_id, provider, agent_key, api_url, default_send_email, default_language'
    )
    .single()

  if (error || !data) {
    console.error('getOrCreateInvoiceSettings', error?.message)
    throw new Error('Nem sikerült létrehozni a számlázási beállításokat.')
  }
  return data as TenantInvoiceSettings
}

export function hasAgentKey(settings: TenantInvoiceSettings | null): boolean {
  return Boolean(settings?.agent_key?.trim())
}
