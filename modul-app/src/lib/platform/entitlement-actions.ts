'use server'

import { revalidatePath } from 'next/cache'

import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  getDefaultPlanId,
  materializePlanTenants,
  materializeTenantEntitlements,
  writeEntitlementAudit
} from '@/lib/platform/entitlements'

export type EntitlementActionResult =
  | { ok: true; message?: string; count?: number }
  | { ok: false; message: string }

const PLATFORM = '/platform'
const PLANS = '/platform/csomagok'
const ADDONS = '/platform/add-onok'
const TENANTS = '/platform/tenants'

function slugifyKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function updatePlanFeatures(input: {
  planId: string
  featureKeys: string[]
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const keys = [...new Set(input.featureKeys)]
  if (!keys.includes('/home')) {
    keys.push('/home')
  }

  const { error: delError } = await ctx.admin
    .from('product_plan_features')
    .delete()
    .eq('plan_id', input.planId)

  if (delError) {
    console.error('updatePlanFeatures delete', delError.message)
    return { ok: false, message: 'Plan feature törlés sikertelen.' }
  }

  if (keys.length > 0) {
    const { error } = await ctx.admin.from('product_plan_features').insert(
      keys.map((feature_key) => ({
        plan_id: input.planId,
        feature_key
      }))
    )
    if (error) {
      console.error('updatePlanFeatures insert', error.message)
      return { ok: false, message: 'Plan feature mentés sikertelen.' }
    }
  }

  await ctx.admin
    .from('product_plans')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.planId)

  await writeEntitlementAudit(ctx.admin, {
    actorUserId: ctx.user.id,
    action: 'plan.features_updated',
    details: { planId: input.planId, featureKeys: keys }
  })

  revalidatePath(PLANS)
  revalidatePath(PLATFORM)
  return {
    ok: true,
    message:
      'Plan elmentve. A meglévő cégekre csak az „Alkalmaz a plan cégeire” gombbal íródik át.'
  }
}

export async function updatePlanPricing(input: {
  planId: string
  priceMonthlyHuf: number
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const price = Math.round(Number(input.priceMonthlyHuf))
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, message: 'Érvénytelen havidíj.' }
  }

  const { error } = await ctx.admin
    .from('product_plans')
    .update({
      price_monthly_huf: price,
      currency: 'HUF',
      updated_at: new Date().toISOString()
    })
    .eq('id', input.planId)

  if (error) {
    console.error('updatePlanPricing', error.message)
    return { ok: false, message: 'Havidíj mentése sikertelen.' }
  }

  await writeEntitlementAudit(ctx.admin, {
    actorUserId: ctx.user.id,
    action: 'plan.pricing_updated',
    details: { planId: input.planId, priceMonthlyHuf: price }
  })

  revalidatePath(PLANS)
  revalidatePath(PLATFORM)
  return { ok: true, message: 'Havidíj mentve.' }
}

export async function applyPlanToTenants(
  planId: string
): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const result = await materializePlanTenants(ctx.admin, planId)
  if (!result.ok) return result

  await writeEntitlementAudit(ctx.admin, {
    actorUserId: ctx.user.id,
    action: 'plan.applied_to_tenants',
    details: { planId, count: result.count }
  })

  revalidatePath(PLANS)
  revalidatePath(TENANTS)
  revalidatePath(PLATFORM)
  return {
    ok: true,
    count: result.count,
    message: `${result.count} cég entitlementje frissítve (override-ok megmaradtak).`
  }
}

export async function setTenantPlan(input: {
  tenantId: string
  planId: string
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.admin
    .from('tenants')
    .update({
      plan_id: input.planId,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.tenantId)

  if (error) {
    return { ok: false, message: 'Plan hozzárendelés sikertelen.' }
  }

  const mat = await materializeTenantEntitlements(ctx.admin, input.tenantId)
  if (!mat.ok) return mat

  if (mat.keys.includes('/pos') || mat.keys.includes('pos')) {
    const { grantPosPageAccess } = await import('@/lib/pos/entitlement')
    await grantPosPageAccess(ctx.admin, input.tenantId)
  }

  await writeEntitlementAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.plan_set',
    details: { planId: input.planId, keys: mat.keys }
  })

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  revalidatePath(TENANTS)
  return { ok: true, message: 'Plan beállítva és alkalmazva.' }
}

export async function setTenantAddon(input: {
  tenantId: string
  addonId: string
  enabled: boolean
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: addonRow } = await ctx.admin
    .from('product_addons')
    .select('id, key')
    .eq('id', input.addonId)
    .maybeSingle()

  if (!addonRow?.key) {
    return { ok: false, message: 'Add-on nem található.' }
  }

  const addonKey = addonRow.key as string

  if (input.enabled) {
    const {
      LAPSZABASZAT_ADDON_KEY,
      LAPSZABASZAT_DEPENDENT_ADDON_KEYS,
      tenantHasAddonKey
    } = await import('@/lib/lapszabaszat/entitlement')

    if (
      (LAPSZABASZAT_DEPENDENT_ADDON_KEYS as readonly string[]).includes(
        addonKey
      )
    ) {
      const hasCore = await tenantHasAddonKey(
        ctx.admin,
        input.tenantId,
        LAPSZABASZAT_ADDON_KEY
      )
      if (!hasCore) {
        return {
          ok: false,
          message:
            'Előbb kapcsold be a Lapszabászat add-ont — ez az add-on arra épül.'
        }
      }
    }

    const { error } = await ctx.admin.from('tenant_addons').upsert(
      {
        tenant_id: input.tenantId,
        addon_id: input.addonId,
        enabled_at: new Date().toISOString(),
        enabled_by: ctx.user.id
      },
      { onConflict: 'tenant_id,addon_id' }
    )
    if (error) {
      console.error('setTenantAddon enable', error.message)
      return { ok: false, message: 'Add-on bekapcsolás sikertelen.' }
    }

    // A partnerfiók és az SMS a Lapszabászat része. Külön entitlementek
    // maradnak, de a fő modul bekapcsolásakor automatikusan aktiváljuk őket.
    if (addonKey === 'lapszabaszat') {
      const { data: includedAddons, error: includedError } = await ctx.admin
        .from('product_addons')
        .select('id')
        .in('key', ['partner_orders', 'quote_ready_sms'])

      if (includedError) {
        console.error(
          'setTenantAddon included addons lookup',
          includedError.message
        )
        return {
          ok: false,
          message: 'A kapcsolódó funkciók bekapcsolása sikertelen.'
        }
      }

      if (includedAddons && includedAddons.length > 0) {
        const { error: includedUpsertError } = await ctx.admin
          .from('tenant_addons')
          .upsert(
            includedAddons.map((included) => ({
              tenant_id: input.tenantId,
              addon_id: included.id,
              enabled_at: new Date().toISOString(),
              enabled_by: ctx.user.id
            })),
            { onConflict: 'tenant_id,addon_id' }
          )

        if (includedUpsertError) {
          console.error(
            'setTenantAddon included addons enable',
            includedUpsertError.message
          )
          return {
            ok: false,
            message: 'A kapcsolódó funkciók bekapcsolása sikertelen.'
          }
        }
      }
    }
  } else {
    if (addonKey === 'lapszabaszat') {
      const { disableLapszabaszatDependents } = await import(
        '@/lib/lapszabaszat/entitlement'
      )
      await disableLapszabaszatDependents(ctx.admin, input.tenantId)
    }

    const { error } = await ctx.admin
      .from('tenant_addons')
      .delete()
      .eq('tenant_id', input.tenantId)
      .eq('addon_id', input.addonId)
    if (error) {
      return { ok: false, message: 'Add-on kikapcsolás sikertelen.' }
    }
  }

  const mat = await materializeTenantEntitlements(ctx.admin, input.tenantId)
  if (!mat.ok) return mat

  if (input.enabled) {
    if (addonKey === 'footcounter') {
      const { grantBelepokPageAccess } = await import(
        '@/lib/footcounter/entitlement'
      )
      await grantBelepokPageAccess(ctx.admin, input.tenantId)
    }
    if (addonKey === 'pos') {
      const { grantPosPageAccess } = await import('@/lib/pos/entitlement')
      await grantPosPageAccess(ctx.admin, input.tenantId)
    }
    if (addonKey === 'jelenlet') {
      const { grantJelenletPageAccess } = await import(
        '@/lib/jelenlet/entitlement'
      )
      await grantJelenletPageAccess(ctx.admin, input.tenantId)
      try {
        await ctx.admin.rpc('seed_hr_hu_holidays_for_tenant', {
          p_tenant_id: input.tenantId
        })
      } catch (e) {
        console.error('seed_hr_hu_holidays_for_tenant', e)
      }
      try {
        await ctx.admin.rpc('seed_hr_employee_types_for_tenant', {
          p_tenant_id: input.tenantId
        })
      } catch (e) {
        console.error('seed_hr_employee_types_for_tenant', e)
      }
    }
    if (addonKey === 'lapszabaszat') {
      const { grantLapszabaszatPageAccess } = await import(
        '@/lib/lapszabaszat/entitlement'
      )
      await grantLapszabaszatPageAccess(ctx.admin, input.tenantId)
    }
  }

  await writeEntitlementAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: input.enabled ? 'tenant.addon_enabled' : 'tenant.addon_disabled',
    details: { addonId: input.addonId, addonKey, keys: mat.keys }
  })

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  revalidatePath(ADDONS)
  return {
    ok: true,
    message: input.enabled ? 'Add-on bekapcsolva.' : 'Add-on kikapcsolva.'
  }
}

/**
 * Per-feature ki/be egy cégnél.
 * desired === base → override törlése; különben override upsert.
 * /home nem kapcsolható ki.
 */
export async function setTenantFeatureOverrides(input: {
  tenantId: string
  /** feature_key → desired effective enabled */
  desired: Record<string, boolean>
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const state = await import('@/lib/platform/entitlement-queries').then((m) =>
    m.getTenantEntitlementState(ctx.admin, input.tenantId)
  )
  const baseSet = new Set(state.baseKeys)

  const toUpsert: Array<{
    tenant_id: string
    feature_key: string
    enabled: boolean
    updated_at: string
    updated_by: string
  }> = []
  const toDelete: string[] = []

  for (const [featureKey, want] of Object.entries(input.desired)) {
    if (featureKey === '/home') continue
    const inBase = baseSet.has(featureKey)
    if (want === inBase) {
      toDelete.push(featureKey)
    } else {
      toUpsert.push({
        tenant_id: input.tenantId,
        feature_key: featureKey,
        enabled: want,
        updated_at: new Date().toISOString(),
        updated_by: ctx.user.id
      })
    }
  }

  if (toDelete.length > 0) {
    const { error } = await ctx.admin
      .from('tenant_feature_overrides')
      .delete()
      .eq('tenant_id', input.tenantId)
      .in('feature_key', toDelete)
    if (error) {
      console.error('setTenantFeatureOverrides delete', error.message)
      return { ok: false, message: 'Override törlés sikertelen.' }
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await ctx.admin
      .from('tenant_feature_overrides')
      .upsert(toUpsert, { onConflict: 'tenant_id,feature_key' })
    if (error) {
      console.error('setTenantFeatureOverrides upsert', error.message)
      return { ok: false, message: 'Override mentés sikertelen.' }
    }
  }

  const mat = await materializeTenantEntitlements(ctx.admin, input.tenantId)
  if (!mat.ok) return mat

  await writeEntitlementAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.feature_overrides_set',
    details: {
      upserted: toUpsert.map((r) => ({ key: r.feature_key, enabled: r.enabled })),
      cleared: toDelete,
      keys: mat.keys
    }
  })

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return { ok: true, message: 'Cég feature-ök mentve.' }
}

export async function clearTenantFeatureOverride(input: {
  tenantId: string
  featureKey: string
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.admin
    .from('tenant_feature_overrides')
    .delete()
    .eq('tenant_id', input.tenantId)
    .eq('feature_key', input.featureKey)

  if (error) {
    return { ok: false, message: 'Override törlés sikertelen.' }
  }

  const mat = await materializeTenantEntitlements(ctx.admin, input.tenantId)
  if (!mat.ok) return mat

  await writeEntitlementAudit(ctx.admin, {
    tenantId: input.tenantId,
    actorUserId: ctx.user.id,
    action: 'tenant.feature_override_cleared',
    details: { featureKey: input.featureKey, keys: mat.keys }
  })

  revalidatePath(`${TENANTS}/${input.tenantId}`)
  return { ok: true, message: 'Visszaállítva a plan/add-on alapra.' }
}

export async function createProductAddon(input: {
  name: string
  key?: string
  description?: string
  featureKeys: string[]
  priceMonthlyHuf?: number
  priceUnitHuf?: number | null
  unitKey?: string | null
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (name.length < 2) {
    return { ok: false, message: 'Az add-on neve legalább 2 karakter legyen.' }
  }

  const key = slugifyKey(input.key?.trim() || name)
  if (!key) {
    return { ok: false, message: 'Érvényes kulcs kell.' }
  }

  const priceMonthly = Math.round(Number(input.priceMonthlyHuf ?? 0))
  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
    return { ok: false, message: 'Érvénytelen havidíj.' }
  }

  let priceUnit: number | null = null
  let unitKey: string | null = null
  if (input.unitKey === 'sms_sent') {
    unitKey = 'sms_sent'
    priceUnit = Math.round(Number(input.priceUnitHuf ?? 0))
    if (!Number.isFinite(priceUnit) || priceUnit < 0) {
      return { ok: false, message: 'Érvénytelen egységár.' }
    }
  }

  const { data: addon, error } = await ctx.admin
    .from('product_addons')
    .insert({
      key,
      name,
      description: input.description?.trim() || null,
      active: true,
      price_monthly_huf: priceMonthly,
      price_unit_huf: priceUnit,
      unit_key: unitKey,
      currency: 'HUF'
    })
    .select('id')
    .single()

  if (error || !addon) {
    const msg = error?.message ?? ''
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ok: false, message: 'Ez az add-on kulcs már foglalt.' }
    }
    return { ok: false, message: 'Add-on létrehozása sikertelen.' }
  }

  const keys = [...new Set(input.featureKeys)]
  if (keys.length > 0) {
    const { error: featError } = await ctx.admin
      .from('product_addon_features')
      .insert(
        keys.map((feature_key) => ({
          addon_id: addon.id,
          feature_key
        }))
      )
    if (featError) {
      await ctx.admin.from('product_addons').delete().eq('id', addon.id)
      return { ok: false, message: 'Add-on feature mentés sikertelen.' }
    }
  }

  await writeEntitlementAudit(ctx.admin, {
    actorUserId: ctx.user.id,
    action: 'addon.created',
    details: { addonId: addon.id, key, featureKeys: keys }
  })

  revalidatePath(ADDONS)
  return { ok: true, message: 'Add-on létrehozva.' }
}

export async function updateProductAddon(input: {
  addonId: string
  name: string
  description?: string
  active: boolean
  featureKeys: string[]
  priceMonthlyHuf: number
  priceUnitHuf?: number | null
  unitKey?: string | null
}): Promise<EntitlementActionResult> {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const name = input.name.trim()
  if (name.length < 2) {
    return { ok: false, message: 'Az add-on neve legalább 2 karakter legyen.' }
  }

  const priceMonthly = Math.round(Number(input.priceMonthlyHuf))
  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
    return { ok: false, message: 'Érvénytelen havidíj.' }
  }

  let priceUnit: number | null = null
  let unitKey: string | null = null
  if (input.unitKey === 'sms_sent') {
    unitKey = 'sms_sent'
    priceUnit = Math.round(Number(input.priceUnitHuf ?? 0))
    if (!Number.isFinite(priceUnit) || priceUnit < 0) {
      return { ok: false, message: 'Érvénytelen egységár.' }
    }
  }

  const { error } = await ctx.admin
    .from('product_addons')
    .update({
      name,
      description: input.description?.trim() || null,
      active: input.active,
      price_monthly_huf: priceMonthly,
      price_unit_huf: priceUnit,
      unit_key: unitKey,
      currency: 'HUF',
      updated_at: new Date().toISOString()
    })
    .eq('id', input.addonId)

  if (error) {
    return { ok: false, message: 'Add-on mentés sikertelen.' }
  }

  await ctx.admin
    .from('product_addon_features')
    .delete()
    .eq('addon_id', input.addonId)

  const keys = [...new Set(input.featureKeys)]
  if (keys.length > 0) {
    const { error: featError } = await ctx.admin
      .from('product_addon_features')
      .insert(
        keys.map((feature_key) => ({
          addon_id: input.addonId,
          feature_key
        }))
      )
    if (featError) {
      return { ok: false, message: 'Add-on feature mentés sikertelen.' }
    }
  }

  // Rematerialize tenants that have this addon enabled
  const { data: linked } = await ctx.admin
    .from('tenant_addons')
    .select('tenant_id')
    .eq('addon_id', input.addonId)

  for (const row of linked ?? []) {
    await materializeTenantEntitlements(ctx.admin, row.tenant_id)
  }

  await writeEntitlementAudit(ctx.admin, {
    actorUserId: ctx.user.id,
    action: 'addon.updated',
    details: {
      addonId: input.addonId,
      featureKeys: keys,
      rematerialized: (linked ?? []).length
    }
  })

  revalidatePath(ADDONS)
  revalidatePath(TENANTS)
  return { ok: true, message: 'Add-on frissítve.' }
}

/** Új tenant create után: default plan + materialize. */
export async function assignDefaultPlanAndMaterialize(
  admin: Parameters<typeof materializeTenantEntitlements>[0],
  tenantId: string,
  actorUserId: string
): Promise<EntitlementActionResult> {
  const planId = await getDefaultPlanId(admin)
  if (!planId) {
    return { ok: false, message: 'Nincs default plan (Alap).' }
  }

  const { error } = await admin
    .from('tenants')
    .update({ plan_id: planId, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    return { ok: false, message: 'Default plan hozzárendelés sikertelen.' }
  }

  const mat = await materializeTenantEntitlements(admin, tenantId)
  if (!mat.ok) return mat

  if (mat.keys.includes('/pos') || mat.keys.includes('pos')) {
    const { grantPosPageAccess } = await import('@/lib/pos/entitlement')
    await grantPosPageAccess(admin, tenantId)
  }

  await writeEntitlementAudit(admin, {
    tenantId,
    actorUserId,
    action: 'tenant.default_plan_assigned',
    details: { planId, keys: mat.keys }
  })

  return { ok: true }
}
