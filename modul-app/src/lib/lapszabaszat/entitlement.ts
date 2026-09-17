import type { SupabaseClient } from '@supabase/supabase-js'

import {
  LAPSZABASZAT_ADDON_KEY,
  LAPSZABASZAT_DEPENDENT_ADDON_KEYS,
  LAPSZABASZAT_FEATURE,
  LAPSZABASZAT_PAGE_KEYS
} from '@/lib/lapszabaszat/types'

export async function tenantHasLapszabaszat(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', LAPSZABASZAT_FEATURE)
    .maybeSingle()

  if (error) {
    console.error('tenantHasLapszabaszat', error.message)
    return false
  }
  return Boolean(data)
}

export async function grantLapszabaszatPageAccess(
  admin: SupabaseClient,
  tenantId: string
): Promise<void> {
  const { data: memberships, error } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('grantLapszabaszatPageAccess memberships', error.message)
    return
  }

  const rows = (memberships ?? []).flatMap((m) =>
    LAPSZABASZAT_PAGE_KEYS.map((page_key) => ({
      tenant_id: tenantId,
      membership_id: m.id as string,
      page_key,
      can_access: true
    }))
  )

  if (rows.length === 0) return

  const { error: upsertErr } = await admin
    .from('tenant_membership_page_access')
    .upsert(rows, { onConflict: 'membership_id,page_key' })

  if (upsertErr) {
    console.error('grantLapszabaszatPageAccess upsert', upsertErr.message)
  }
}

export async function resolveAddonIdByKey(
  admin: SupabaseClient,
  key: string
): Promise<string | null> {
  const { data } = await admin
    .from('product_addons')
    .select('id')
    .eq('key', key)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function tenantHasAddonKey(
  admin: SupabaseClient,
  tenantId: string,
  addonKey: string
): Promise<boolean> {
  const addonId = await resolveAddonIdByKey(admin, addonKey)
  if (!addonId) return false
  const { data } = await admin
    .from('tenant_addons')
    .select('addon_id')
    .eq('tenant_id', tenantId)
    .eq('addon_id', addonId)
    .maybeSingle()
  return Boolean(data)
}

/** Kikapcsolja a Lapszabászatra épülő add-onokat. */
export async function disableLapszabaszatDependents(
  admin: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const removed: string[] = []
  for (const key of LAPSZABASZAT_DEPENDENT_ADDON_KEYS) {
    const id = await resolveAddonIdByKey(admin, key)
    if (!id) continue
    const { data } = await admin
      .from('tenant_addons')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('addon_id', id)
      .select('addon_id')
    if (data?.length) removed.push(key)
  }
  return removed
}

export { LAPSZABASZAT_ADDON_KEY, LAPSZABASZAT_DEPENDENT_ADDON_KEYS }
