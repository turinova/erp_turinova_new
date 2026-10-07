import type { SupabaseClient } from '@supabase/supabase-js'

import { PDA_POS_FEATURE, PDA_POS_PAGE } from '@/lib/pos/pda-types'

export async function tenantHasPdaPos(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', PDA_POS_FEATURE)
    .maybeSingle()

  if (error) {
    console.error('tenantHasPdaPos', error.message)
    return false
  }
  return Boolean(data)
}

export async function grantPdaPosPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantPdaPosPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).map((m) => ({
    tenant_id: tenantId,
    membership_id: m.id as string,
    page_key: PDA_POS_PAGE,
    can_access: true
  }))

  if (rows.length === 0) return

  const { error: upsertErr } = await admin
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })

  if (upsertErr) {
    console.error('grantPdaPosPageAccess upsert', upsertErr.message)
  }
}
