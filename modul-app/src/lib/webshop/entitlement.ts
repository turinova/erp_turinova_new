import type { SupabaseClient } from '@supabase/supabase-js'

import {
  WEBSHOP_FEATURE,
  WEBSHOP_PAGE_KEYS
} from '@/lib/webshop/types'

export async function tenantHasWebshop(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .in('feature_key', [WEBSHOP_FEATURE, ...WEBSHOP_PAGE_KEYS])
    .limit(1)

  if (error) {
    console.error('tenantHasWebshop', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function grantWebshopPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantWebshopPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).flatMap((m) =>
    WEBSHOP_PAGE_KEYS.map((page_key) => ({
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
    console.error('grantWebshopPageAccess upsert', upsertError.message)
  }
}

/** Addon kikapcsoláskor: publish freeze, adat megmarad. */
export async function freezeWebshopPublish(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { error } = await admin
    .from('accessory_web')
    .update({
      sellable_web: false,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('sellable_web', true)

  if (error) {
    console.error('freezeWebshopPublish', error.message)
  }
}
