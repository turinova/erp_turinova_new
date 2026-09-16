import type { SupabaseClient } from '@supabase/supabase-js'

import { PRODUCT_LABELS_FEATURE } from '@/lib/labels/types'

export async function tenantHasProductLabels(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', PRODUCT_LABELS_FEATURE)
    .maybeSingle()

  if (error) {
    console.error('tenantHasProductLabels', error.message)
    return false
  }
  return Boolean(data)
}
