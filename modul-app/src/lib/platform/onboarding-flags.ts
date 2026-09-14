'use server'

import { createClient } from '@/lib/supabase/server'

/** Tenant app soft flag update (RLS: can_write_tenant). */
export async function markOnboardingFlag(
  tenantId: string,
  patch: Partial<{
    company_profile_done: boolean
    first_login_at: string
    has_sheet_material: boolean
    has_edge_material: boolean
    has_quote: boolean
    has_order: boolean
  }>
): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  const { data: row } = await supabase
    .from('tenant_onboarding')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!row) {
    await supabase.from('tenant_onboarding').insert({
      tenant_id: tenantId,
      ...patch,
      updated_at: new Date().toISOString()
    })
    return
  }

  await supabase
    .from('tenant_onboarding')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
}

/** Idempotens: csak ha még nincs first_login_at. */
export async function ensureFirstLoginMarked(tenantId: string): Promise<void> {
  const supabase = await createClient()
  if (!supabase) return

  const { data: row } = await supabase
    .from('tenant_onboarding')
    .select('tenant_id, first_login_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (row?.first_login_at) return

  const now = new Date().toISOString()
  if (!row) {
    await supabase.from('tenant_onboarding').insert({
      tenant_id: tenantId,
      first_login_at: now,
      updated_at: now
    })
    return
  }

  await supabase
    .from('tenant_onboarding')
    .update({ first_login_at: now, updated_at: now })
    .eq('tenant_id', tenantId)
    .is('first_login_at', null)
}
