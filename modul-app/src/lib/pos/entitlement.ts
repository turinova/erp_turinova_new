import type { SupabaseClient } from '@supabase/supabase-js'

import { POS_FEATURE, POS_PAGE_KEYS } from '@/lib/pos/types'

export async function tenantHasPos(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', [POS_FEATURE, ...POS_PAGE_KEYS])
    .limit(1)

  if (error) {
    console.error('tenantHasPos', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function grantPosPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantPosPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).flatMap((m) =>
    POS_PAGE_KEYS.map((page_key) => ({
      tenant_id: tenantId,
      membership_id: m.id as string,
      page_key,
      can_access: true
    }))
  )

  if (rows.length === 0) return

  const { error: upsertError } = await admin
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })

  if (upsertError) {
    console.error('grantPosPageAccess upsert', upsertError.message)
  }
}
