import type { SupabaseClient } from '@supabase/supabase-js'

import { ALWAYS_ALLOWED_PAGE_KEYS } from '@/lib/permissions/pages'

export type ProductFeature = {
  key: string
  label: string
  category: string
  page_key: string | null
  sort_order: number
  active: boolean
}

export type ProductPlan = {
  id: string
  key: string
  name: string
  description: string | null
  is_default: boolean
}

export type ProductAddon = {
  id: string
  key: string
  name: string
  description: string | null
  active: boolean
}

/** Effektív feature kulcsok a tenantnél (materializált). */
export async function listTenantEntitledKeys(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('listTenantEntitledKeys', error.message)
    return []
  }

  return (data ?? []).map((r) => r.feature_key as string)
}

/** Oldal path-ek a materializált entitlementből (+ always). */
export async function listTenantEntitledPageKeys(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key, product_features(page_key)')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('listTenantEntitledPageKeys', error.message)
    return [...ALWAYS_ALLOWED_PAGE_KEYS]
  }

  const pages = new Set<string>(ALWAYS_ALLOWED_PAGE_KEYS)
  for (const row of data ?? []) {
    const feat = row.product_features as
      | { page_key: string | null }
      | { page_key: string | null }[]
      | null
    const f = Array.isArray(feat) ? feat[0] : feat
    const pageKey = f?.page_key ?? (row.feature_key as string)
    if (pageKey) pages.add(pageKey)
  }
  return [...pages]
}

/**
 * Plan ∪ add-onok, majd tenant_feature_overrides alkalmazása.
 * Override-okat NEM törli — csak a materializált tenant_entitlements-t írja.
 * Service-role / admin klienssel hívd.
 */
export async function materializeTenantEntitlements(
  admin: SupabaseClient,
  tenantId: string
): Promise<{ ok: true; keys: string[] } | { ok: false; message: string }> {
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, plan_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError || !tenant) {
    return { ok: false, message: 'Tenant nem található.' }
  }

  const keys = new Set<string>()

  if (tenant.plan_id) {
    const { data: planFeatures, error } = await admin
      .from('product_plan_features')
      .select('feature_key')
      .eq('plan_id', tenant.plan_id)
    if (error) {
      console.error('materialize plan features', error.message)
      return { ok: false, message: 'Plan feature-ök betöltése sikertelen.' }
    }
    for (const row of planFeatures ?? []) {
      keys.add(row.feature_key as string)
    }
  }

  const { data: addonRows, error: addonError } = await admin
    .from('tenant_addons')
    .select('addon_id')
    .eq('tenant_id', tenantId)

  if (addonError) {
    console.error('materialize tenant_addons', addonError.message)
    return { ok: false, message: 'Add-on lista betöltése sikertelen.' }
  }

  const addonIds = (addonRows ?? []).map((r) => r.addon_id as string)
  if (addonIds.length > 0) {
    const { data: addonFeatures, error } = await admin
      .from('product_addon_features')
      .select('feature_key')
      .in('addon_id', addonIds)
    if (error) {
      console.error('materialize addon features', error.message)
      return { ok: false, message: 'Add-on feature-ök betöltése sikertelen.' }
    }
    for (const row of addonFeatures ?? []) {
      keys.add(row.feature_key as string)
    }
  }

  const { data: overrides, error: overrideError } = await admin
    .from('tenant_feature_overrides')
    .select('feature_key, enabled')
    .eq('tenant_id', tenantId)

  if (overrideError) {
    console.error('materialize overrides', overrideError.message)
    return { ok: false, message: 'Override betöltés sikertelen.' }
  }

  for (const row of overrides ?? []) {
    const key = row.feature_key as string
    if (row.enabled) keys.add(key)
    else keys.delete(key)
  }

  // Mindig legyen kezdőlap
  keys.add('/home')

  const { error: delError } = await admin
    .from('tenant_entitlements')
    .delete()
    .eq('tenant_id', tenantId)

  if (delError) {
    console.error('materialize delete', delError.message)
    return { ok: false, message: 'Régi entitlement törlése sikertelen.' }
  }

  const rows = [...keys].map((feature_key) => ({
    tenant_id: tenantId,
    feature_key
  }))

  if (rows.length > 0) {
    const { error: insError } = await admin
      .from('tenant_entitlements')
      .insert(rows)
    if (insError) {
      console.error('materialize insert', insError.message)
      return { ok: false, message: 'Entitlement mentése sikertelen.' }
    }
  }

  return { ok: true, keys: [...keys] }
}

export async function materializePlanTenants(
  admin: SupabaseClient,
  planId: string
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id')
    .eq('plan_id', planId)

  if (error) {
    return { ok: false, message: 'Tenant lista sikertelen.' }
  }

  let count = 0
  for (const t of tenants ?? []) {
    const result = await materializeTenantEntitlements(admin, t.id)
    if (!result.ok) {
      return { ok: false, message: result.message }
    }
    count += 1
  }
  return { ok: true, count }
}

export async function getDefaultPlanId(
  admin: SupabaseClient
): Promise<string | null> {
  const { data } = await admin
    .from('product_plans')
    .select('id')
    .eq('is_default', true)
    .maybeSingle()
  return data?.id ?? null
}

export async function writeEntitlementAudit(
  admin: SupabaseClient,
  input: {
    tenantId?: string | null
    actorUserId: string
    action: string
    details?: Record<string, unknown>
  }
) {
  const { error } = await admin.from('entitlement_audit_log').insert({
    tenant_id: input.tenantId ?? null,
    actor_user_id: input.actorUserId,
    action: input.action,
    details: input.details ?? {}
  })
  if (error) {
    console.error('writeEntitlementAudit', error.message)
  }
}

export function intersectPages(
  membershipPages: string[],
  entitledPages: string[]
): string[] {
  const entitled = new Set(entitledPages)
  const always = new Set(ALWAYS_ALLOWED_PAGE_KEYS)
  return membershipPages.filter((k) => always.has(k) || entitled.has(k))
}
