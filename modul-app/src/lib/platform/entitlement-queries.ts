import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  ProductAddon,
  ProductFeature,
  ProductPlan
} from '@/lib/platform/entitlements'

export async function listProductFeatures(
  admin: SupabaseClient
): Promise<ProductFeature[]> {
  const { data, error } = await admin
    .from('product_features')
    .select('key, label, category, page_key, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('listProductFeatures', error.message)
    return []
  }
  return (data ?? []) as ProductFeature[]
}

export async function listProductPlans(
  admin: SupabaseClient
): Promise<Array<ProductPlan & { featureKeys: string[]; tenantCount: number }>> {
  const { data: plans, error } = await admin
    .from('product_plans')
    .select('id, key, name, description, is_default')
    .order('name', { ascending: true })

  if (error || !plans) {
    console.error('listProductPlans', error?.message)
    return []
  }

  const result = []
  for (const plan of plans) {
    const [{ data: features }, { count }] = await Promise.all([
      admin
        .from('product_plan_features')
        .select('feature_key')
        .eq('plan_id', plan.id),
      admin
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', plan.id)
    ])
    result.push({
      ...(plan as ProductPlan),
      featureKeys: (features ?? []).map((f) => f.feature_key as string),
      tenantCount: count ?? 0
    })
  }
  return result
}

export async function getProductPlanDetail(
  admin: SupabaseClient,
  planId: string
): Promise<(ProductPlan & { featureKeys: string[] }) | null> {
  const { data: plan, error } = await admin
    .from('product_plans')
    .select('id, key, name, description, is_default')
    .eq('id', planId)
    .maybeSingle()

  if (error || !plan) return null

  const { data: features } = await admin
    .from('product_plan_features')
    .select('feature_key')
    .eq('plan_id', planId)

  return {
    ...(plan as ProductPlan),
    featureKeys: (features ?? []).map((f) => f.feature_key as string)
  }
}

export async function listProductAddons(
  admin: SupabaseClient
): Promise<Array<ProductAddon & { featureKeys: string[]; enabledCount: number }>> {
  const { data: addons, error } = await admin
    .from('product_addons')
    .select('id, key, name, description, active')
    .order('name', { ascending: true })

  if (error || !addons) {
    console.error('listProductAddons', error?.message)
    return []
  }

  const result = []
  for (const addon of addons) {
    const [{ data: features }, { count }] = await Promise.all([
      admin
        .from('product_addon_features')
        .select('feature_key')
        .eq('addon_id', addon.id),
      admin
        .from('tenant_addons')
        .select('tenant_id', { count: 'exact', head: true })
        .eq('addon_id', addon.id)
    ])
    result.push({
      ...(addon as ProductAddon),
      featureKeys: (features ?? []).map((f) => f.feature_key as string),
      enabledCount: count ?? 0
    })
  }
  return result
}

export type TenantFeatureRow = {
  key: string
  label: string
  category: string
  /** Plan ∪ add-on alap (override előtt). */
  inBase: boolean
  /** Effektív (materializált). */
  entitled: boolean
  /** Van-e explicit override. */
  override: boolean | null
}

export type TenantEntitlementState = {
  plan: ProductPlan | null
  entitledKeys: string[]
  baseKeys: string[]
  enabledAddonIds: string[]
  addons: Array<ProductAddon & { featureKeys: string[]; enabled: boolean }>
  features: TenantFeatureRow[]
}

export async function getTenantEntitlementState(
  admin: SupabaseClient,
  tenantId: string
): Promise<TenantEntitlementState> {
  const { data: tenant } = await admin
    .from('tenants')
    .select('plan_id')
    .eq('id', tenantId)
    .maybeSingle()

  let plan: ProductPlan | null = null
  if (tenant?.plan_id) {
    const { data } = await admin
      .from('product_plans')
      .select('id, key, name, description, is_default')
      .eq('id', tenant.plan_id)
      .maybeSingle()
    plan = (data as ProductPlan) ?? null
  }

  const [
    { data: entitled },
    { data: enabledRows },
    { data: overrideRows },
    addons,
    catalog
  ] = await Promise.all([
    admin
      .from('tenant_entitlements')
      .select('feature_key')
      .eq('tenant_id', tenantId),
    admin
      .from('tenant_addons')
      .select('addon_id')
      .eq('tenant_id', tenantId),
    admin
      .from('tenant_feature_overrides')
      .select('feature_key, enabled')
      .eq('tenant_id', tenantId),
    listProductAddons(admin),
    listProductFeatures(admin)
  ])

  const enabledAddonIds = (enabledRows ?? []).map((r) => r.addon_id as string)
  const enabledSet = new Set(enabledAddonIds)
  const activeAddons = addons
    .filter((a) => a.active)
    .map((a) => ({
      ...a,
      enabled: enabledSet.has(a.id)
    }))

  const baseKeys = new Set<string>()
  if (tenant?.plan_id) {
    const { data: planFeatures } = await admin
      .from('product_plan_features')
      .select('feature_key')
      .eq('plan_id', tenant.plan_id)
    for (const row of planFeatures ?? []) {
      baseKeys.add(row.feature_key as string)
    }
  }
  for (const addon of activeAddons) {
    if (!addon.enabled) continue
    for (const key of addon.featureKeys) baseKeys.add(key)
  }
  baseKeys.add('/home')

  const entitledSet = new Set(
    (entitled ?? []).map((r) => r.feature_key as string)
  )
  const overrideMap = new Map(
    (overrideRows ?? []).map((r) => [
      r.feature_key as string,
      Boolean(r.enabled)
    ])
  )

  const features: TenantFeatureRow[] = catalog.map((f) => ({
    key: f.key,
    label: f.label,
    category: f.category,
    inBase: baseKeys.has(f.key),
    entitled: entitledSet.has(f.key),
    override: overrideMap.has(f.key)
      ? (overrideMap.get(f.key) as boolean)
      : null
  }))

  return {
    plan,
    entitledKeys: [...entitledSet],
    baseKeys: [...baseKeys],
    enabledAddonIds,
    addons: activeAddons,
    features
  }
}
