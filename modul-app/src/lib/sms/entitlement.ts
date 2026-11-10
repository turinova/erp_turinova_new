import type { SupabaseClient } from '@supabase/supabase-js'

import { QUOTE_READY_SMS_FEATURE } from '@/lib/sms/types'

export async function tenantHasQuoteReadySms(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', QUOTE_READY_SMS_FEATURE)
    .maybeSingle()

  if (error) {
    console.error('tenantHasQuoteReadySms', error.message)
    return false
  }
  return Boolean(data)
}

/** Bármely SMS-küldő jogosultság (készre jelentés add-on vagy ügyfélrendelés). */
export async function tenantHasAnySms(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', [QUOTE_READY_SMS_FEATURE, 'customer_special_orders'])
    .limit(1)

  if (error) {
    console.error('tenantHasAnySms', error.message)
    return false
  }
  return (data ?? []).length > 0
}
