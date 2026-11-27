import type { SupabaseClient } from '@supabase/supabase-js'

export type TenantFlags = {
  lapszabaszat: boolean
  partnerOrders: boolean
  jelenlet: boolean
  footcounter: boolean
}

export async function loadTenantFlags(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantFlags> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', [
      'lapszabaszat',
      'partner_orders',
      'jelenlet',
      'footcounter',
      '/ajanlatok',
      '/opti',
      '/belepok',
      '/jelenlet'
    ])

  if (error) throw new Error(`loadTenantFlags: ${error.message}`)

  const keys = new Set((data ?? []).map((r) => r.feature_key as string))
  return {
    lapszabaszat:
      keys.has('lapszabaszat') ||
      keys.has('/ajanlatok') ||
      keys.has('/opti'),
    partnerOrders: keys.has('partner_orders'),
    jelenlet: keys.has('jelenlet') || keys.has('/jelenlet'),
    footcounter: keys.has('footcounter') || keys.has('/belepok')
  }
}
