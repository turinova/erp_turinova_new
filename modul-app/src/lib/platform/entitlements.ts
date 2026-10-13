import type { SupabaseClient } from '@supabase/supabase-js'

import { ALWAYS_ALLOWED_PAGE_KEYS } from '@/lib/permissions/pages'
import {
  MANAGED_BUNDLE_ADDON_KEYS,
  bundledAddonKeysForPlan,
  retainedAddonKeysForPlan
} from '@/lib/platform/plan-bundles'

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
  price_monthly_huf: number
  currency: string
}

export type ProductAddon = {
  id: string
  key: string
  name: string
  description: string | null
  active: boolean
  price_monthly_huf: number
  price_unit_huf: number | null
  unit_key: string | null
  currency: string
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

/**
 * Planváltáskor: bundelt add-onok be, felesleges managed add-onok ki
 * (à la carte megmarad plan szerint). Side-effect page grant / HR seed.
 */
export async function syncPlanBundledAddons(
  admin: SupabaseClient,
  tenantId: string,
  planKey: string,
  actorUserId: string | null
): Promise<{ ok: true; enabled: string[]; disabled: string[] } | { ok: false; message: string }> {
  const { data: addonCatalog, error: catalogError } = await admin
    .from('product_addons')
    .select('id, key')
    .in('key', [...MANAGED_BUNDLE_ADDON_KEYS])

  if (catalogError) {
    console.error('syncPlanBundledAddons catalog', catalogError.message)
    return { ok: false, message: 'Add-on katalógus betöltése sikertelen.' }
  }

  const byKey = new Map(
    (addonCatalog ?? []).map((a) => [a.key as string, a.id as string])
  )

  const { data: currentRows, error: currentError } = await admin
    .from('tenant_addons')
    .select('addon_id, product_addons(key)')
    .eq('tenant_id', tenantId)

  if (currentError) {
    console.error('syncPlanBundledAddons current', currentError.message)
    return { ok: false, message: 'Tenant add-on lista sikertelen.' }
  }

  const currentlyEnabled = new Set<string>()
  for (const row of currentRows ?? []) {
    const raw = row.product_addons as
      | { key: string }
      | { key: string }[]
      | null
    const addon = Array.isArray(raw) ? raw[0] : raw
    if (addon?.key) currentlyEnabled.add(addon.key)
  }

  const toEnable = bundledAddonKeysForPlan(planKey)
  const keep = retainedAddonKeysForPlan(planKey)
  const enabled: string[] = []
  const disabled: string[] = []

  for (const key of toEnable) {
    const addonId = byKey.get(key)
    if (!addonId) continue
    const { error } = await admin.from('tenant_addons').upsert(
      {
        tenant_id: tenantId,
        addon_id: addonId,
        enabled_at: new Date().toISOString(),
        enabled_by: actorUserId
      },
      { onConflict: 'tenant_id,addon_id' }
    )
    if (error) {
      console.error('syncPlanBundledAddons enable', key, error.message)
      return { ok: false, message: `Add-on bekapcsolás sikertelen: ${key}` }
    }
    if (!currentlyEnabled.has(key)) enabled.push(key)
  }

  for (const key of MANAGED_BUNDLE_ADDON_KEYS) {
    if (keep.has(key)) continue
    if (!currentlyEnabled.has(key) && !toEnable.includes(key)) continue
    const addonId = byKey.get(key)
    if (!addonId) continue
    // Only remove if currently enabled
    if (!currentlyEnabled.has(key)) continue
    const { error } = await admin
      .from('tenant_addons')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('addon_id', addonId)
    if (error) {
      console.error('syncPlanBundledAddons disable', key, error.message)
      return { ok: false, message: `Add-on kikapcsolás sikertelen: ${key}` }
    }
    disabled.push(key)
  }

  // Side effects for newly enabled (and for already-on bundle so page_access friss)
  const grantKeys = [...new Set([...toEnable, ...enabled])]
  for (const addonKey of grantKeys) {
    if (addonKey === 'footcounter') {
      const { grantBelepokPageAccess } = await import(
        '@/lib/footcounter/entitlement'
      )
      await grantBelepokPageAccess(admin, tenantId)
    }
    if (addonKey === 'pda_pos') {
      const { grantPdaPosPageAccess } = await import(
        '@/lib/pos/pda-entitlement'
      )
      await grantPdaPosPageAccess(admin, tenantId)
    }
    if (addonKey === 'jelenlet') {
      const { grantJelenletPageAccess } = await import(
        '@/lib/jelenlet/entitlement'
      )
      await grantJelenletPageAccess(admin, tenantId)
      try {
        await admin.rpc('seed_hr_hu_holidays_for_tenant', {
          p_tenant_id: tenantId
        })
      } catch (e) {
        console.error('seed_hr_hu_holidays_for_tenant', e)
      }
      try {
        await admin.rpc('seed_hr_employee_types_for_tenant', {
          p_tenant_id: tenantId
        })
      } catch (e) {
        console.error('seed_hr_employee_types_for_tenant', e)
      }
    }
    if (addonKey === 'lapszabaszat') {
      const { grantLapszabaszatPageAccess } = await import(
        '@/lib/lapszabaszat/entitlement'
      )
      await grantLapszabaszatPageAccess(admin, tenantId)
    }
  }

  return { ok: true, enabled, disabled }
}

export async function materializePlanTenants(
  admin: SupabaseClient,
  planId: string
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const { data: plan } = await admin
    .from('product_plans')
    .select('id, key')
    .eq('id', planId)
    .maybeSingle()

  const { data: tenants, error } = await admin
    .from('tenants')
    .select('id')
    .eq('plan_id', planId)

  if (error) {
    return { ok: false, message: 'Tenant lista sikertelen.' }
  }

  let count = 0
  for (const t of tenants ?? []) {
    if (plan?.key) {
      const sync = await syncPlanBundledAddons(admin, t.id, plan.key, null)
      if (!sync.ok) return sync
    }
    const result = await materializeTenantEntitlements(admin, t.id)
    if (!result.ok) {
      return { ok: false, message: result.message }
    }
    if (result.keys.includes('/pos') || result.keys.includes('pos')) {
      const { grantPosPageAccess } = await import('@/lib/pos/entitlement')
      await grantPosPageAccess(admin, t.id)
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
