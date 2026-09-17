import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BESZERZES_FEATURE,
  BESZERZES_PAGE_KEYS
} from '@/lib/beszerzes/types'

/** True if tenant has beszerzés addon / procurement pages entitled. */
export async function tenantHasBeszerzes(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const keys = [BESZERZES_FEATURE, ...BESZERZES_PAGE_KEYS]

  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', keys)
    .limit(1)

  if (error) {
    console.error('tenantHasBeszerzes', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}
