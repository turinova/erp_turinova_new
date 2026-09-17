import { createHash, randomBytes } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { FOOTCOUNTER_FEATURE, FOOTCOUNTER_PAGE } from '@/lib/footcounter/types'

export function hashFootcounterToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Opaque device token — show once in platform UI. */
export function generateFootcounterToken(): string {
  return `fc_${randomBytes(24).toString('base64url')}`
}

export async function tenantHasFootcounter(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', FOOTCOUNTER_FEATURE)
    .maybeSingle()

  if (error) {
    console.error('tenantHasFootcounter', error.message)
    return false
  }
  return Boolean(data)
}

export async function grantBelepokPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantBelepokPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).map((m) => ({
    tenant_id: tenantId,
    membership_id: m.id as string,
    page_key: FOOTCOUNTER_PAGE,
    can_access: true
  }))

  if (rows.length === 0) return

  const { error: upsertErr } = await admin
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })

  if (upsertErr) {
    console.error('grantBelepokPageAccess upsert', upsertErr.message)
  }
}
