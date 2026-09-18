import type { SupabaseClient } from '@supabase/supabase-js'

import {
  JELENLET_FEATURE,
  JELENLET_PAGE_KEYS
} from '@/lib/jelenlet/types'

export async function tenantHasJelenlet(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', [JELENLET_FEATURE, ...JELENLET_PAGE_KEYS])
    .limit(1)

  if (error) {
    console.error('tenantHasJelenlet', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function grantJelenletPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantJelenletPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).flatMap((m) =>
    JELENLET_PAGE_KEYS.map((page_key) => ({
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
    console.error('grantJelenletPageAccess upsert', upsertError.message)
  }
}
