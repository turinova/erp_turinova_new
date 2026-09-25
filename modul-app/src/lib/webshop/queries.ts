import type { SupabaseClient } from '@supabase/supabase-js'

import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import type {
  AttributeInput,
  AttributeValueRow,
  AttributeValueType,
  CategoryAttributeRole,
  CategoryTemplateItem,
  ProductAttributeRow,
  WebCategoryRow
} from '@/lib/webshop/types'

const VALUE_TYPES: AttributeValueType[] = ['list', 'number', 'range', 'boolean']

export function asValueType(v: unknown): AttributeValueType {
  return VALUE_TYPES.includes(v as AttributeValueType)
    ? (v as AttributeValueType)
    : 'list'
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listWebCategories(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WebCategoryRow[]> {
  const { data, error } = await supabase
    .from('web_categories')
    .select(
      'id, name, parent_id, google_taxonomy_id, sort_order, active, measure_image_url'
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('listWebCategories', error.message)
    throw new Error('Nem sikerült betölteni a kategóriákat.')
  }

  const rows = data ?? []
  const byId = new Map(rows.map((r) => [r.id as string, r]))

  const [{ data: counts, error: countError }, { data: tpl, error: tplError }] =
    await Promise.all([
      supabase
        .from('accessories')
        .select('web_category_id')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .not('web_category_id', 'is', null),
      supabase
        .from('web_category_attributes')
        .select('category_id, attribute_id, role, sort_order')
        .eq('tenant_id', tenantId)
    ])

  if (countError) {
    console.error('listWebCategories counts', countError.message)
  }
  if (tplError) {
    console.error('listWebCategories template', tplError.message)
  }

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    const id = row.web_category_id as string
    countMap.set(id, (countMap.get(id) ?? 0) + 1)
  }

  const childMap = new Map<string, number>()
  for (const r of rows) {
    const p = (r.parent_id as string | null) ?? null
    if (p && byId.has(p)) childMap.set(p, (childMap.get(p) ?? 0) + 1)
  }

  const tplMap = new Map<string, CategoryTemplateItem[]>()
  for (const t of tpl ?? []) {
    const categoryId = t.category_id as string
    const list = tplMap.get(categoryId) ?? []
    list.push({
      attributeId: t.attribute_id as string,
      role: (t.role === 'spec' ? 'spec' : 'key') as CategoryAttributeRole,
      sortOrder: Number(t.sort_order ?? 100)
    })
    tplMap.set(categoryId, list)
  }

  return rows.map((r) => {
    const rawParent = (r.parent_id as string | null) ?? null
    // Törölt szülőre mutató hivatkozás = nincs szülő (öröklés sem).
    const parentId = rawParent && byId.has(rawParent) ? rawParent : null
    return {
      id: r.id as string,
      name: r.name as string,
      parentId,
      parentName: parentId ? ((byId.get(parentId)?.name as string) ?? null) : null,
      googleTaxonomyId: (r.google_taxonomy_id as string | null) ?? null,
      sortOrder: Number(r.sort_order ?? 100),
      active: r.active !== false,
      productCount: countMap.get(r.id as string) ?? 0,
      childCount: childMap.get(r.id as string) ?? 0,
      measureImageUrl: (r.measure_image_url as string | null) ?? null,
      template: tplMap.get(r.id as string) ?? []
    }
  })
}

export async function listProductAttributes(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductAttributeRow[]> {
  const { data: attrs, error } = await supabase
    .from('product_attributes')
    .select(
      'id, name, code, is_variant_axis, sort_order, active, value_type, unit, measure_hint, allow_multiple'
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('listProductAttributes', error.message)
    throw new Error('Nem sikerült betölteni a tulajdonságokat.')
  }

  const [
    { data: values, error: valuesError },
    { data: used },
    { data: usedLinks }
  ] = await Promise.all([
      supabase
        .from('attribute_values')
        .select('id, attribute_id, label, sort_order, active')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true }),
      supabase
        .from('accessory_attribute_inputs')
        .select('attribute_id')
        .eq('tenant_id', tenantId)
        .limit(5000),
      supabase
        .from('accessory_attribute_values')
        .select('attribute_value_id')
        .eq('tenant_id', tenantId)
        .limit(5000)
    ])

  if (valuesError) {
    console.error('listProductAttributes values', valuesError.message)
    throw new Error('Nem sikerült betölteni a tulajdonság-értékeket.')
  }

  const usedAttr = new Set((used ?? []).map((u) => u.attribute_id as string))
  const valueToAttr = new Map(
    (values ?? []).map((v) => [v.id as string, v.attribute_id as string])
  )
  for (const l of usedLinks ?? []) {
    const attrId = valueToAttr.get(l.attribute_value_id as string)
    if (attrId) usedAttr.add(attrId)
  }

  const byAttr = new Map<string, AttributeValueRow[]>()
  for (const v of values ?? []) {
    const attributeId = v.attribute_id as string
    const list = byAttr.get(attributeId) ?? []
    list.push({
      id: v.id as string,
      attributeId,
      label: v.label as string,
      sortOrder: Number(v.sort_order ?? 100),
      active: v.active !== false
    })
    byAttr.set(attributeId, list)
  }

  return (attrs ?? []).map((a) => {
    const values = byAttr.get(a.id as string) ?? []
    return {
      id: a.id as string,
      name: a.name as string,
      code: a.code as string,
      isVariantAxis: a.is_variant_axis === true,
      sortOrder: Number(a.sort_order ?? 100),
      active: a.active !== false,
      valueType: asValueType(a.value_type),
      unit: (a.unit as string | null) ?? null,
      measureHint: (a.measure_hint as string | null) ?? null,
      allowMultiple: a.allow_multiple === true,
      inUse: usedAttr.has(a.id as string),
      values
    }
  })
}

export async function listAccessoryAttributeValueIds(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('accessory_attribute_values')
    .select('attribute_value_id')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

  if (error) {
    console.error('listAccessoryAttributeValueIds', error.message)
    return []
  }
  return (data ?? []).map((r) => r.attribute_value_id as string)
}

export function mapAttributeInputRow(r: Record<string, unknown>): AttributeInput {
  return {
    attributeId: String(r.attribute_id),
    valueNum: numOrNull(r.value_num),
    valueMax: numOrNull(r.value_max),
    valueBool: typeof r.value_bool === 'boolean' ? r.value_bool : null
  }
}

export async function listAccessoryAttributeInputs(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<AttributeInput[]> {
  const { data, error } = await supabase
    .from('accessory_attribute_inputs')
    .select('attribute_id, value_num, value_max, value_bool')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

  if (error) {
    console.error('listAccessoryAttributeInputs', error.message)
    return []
  }
  return (data ?? []).map((r) => mapAttributeInputRow(r as Record<string, unknown>))
}

export type WebshopOverviewStats = {
  sellableWeb: number
  blocked: number
  ready: number
  excellent: number
  categories: number
  attributes: number
}

export async function getWebshopOverviewStats(
  supabase: SupabaseClient,
  tenantId: string,
  levels: { sellable_web: boolean; shop_ready_level: string }[]
): Promise<WebshopOverviewStats> {
  const { count: catCount } = await supabase
    .from('web_categories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const { count: attrCount } = await supabase
    .from('product_attributes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  let sellableWeb = 0
  let blocked = 0
  let ready = 0
  let excellent = 0
  for (const row of levels) {
    if (!row.sellable_web) continue
    sellableWeb += 1
    if (row.shop_ready_level === 'blocked') blocked += 1
    if (
      row.shop_ready_level === 'competitive' ||
      row.shop_ready_level === 'agent_excellent'
    ) {
      ready += 1
    }
    if (row.shop_ready_level === 'agent_excellent') excellent += 1
  }

  return {
    sellableWeb,
    blocked,
    ready,
    excellent,
    categories: catCount ?? 0,
    attributes: attrCount ?? 0
  }
}

export type StockNotifyRow = {
  id: string
  email: string
  variantLabel: string | null
  createdAt: string
  productName: string
  productId: string
  inStock: boolean
}

export const STOCK_NOTIFY_LIMIT = 25

/** Nyitott „Szólj, ha megérkezik” kérések; a tábla hiánya (migráció előtt) üres listát ad. */
export async function listOpenStockNotifyRequests(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ rows: StockNotifyRow[]; total: number }> {
  const { data, error, count } = await supabase
    .from('storefront_stock_notify_requests')
    .select(
      'id, email, variant_label, created_at, accessory_id, accessories ( name )',
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .is('notified_at', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(STOCK_NOTIFY_LIMIT)

  if (error) {
    if (error.code !== '42P01') console.error('listOpenStockNotifyRequests', error.message)
    return { rows: [], total: 0 }
  }

  const raw = (data ?? []) as unknown as Record<string, unknown>[]
  let stock = new Map<string, number>()
  try {
    stock = await getAccessoriesOnHandMap(
      supabase,
      tenantId,
      raw.map((r) => String(r.accessory_id))
    )
  } catch (e) {
    console.error('listOpenStockNotifyRequests stock', e)
  }

  const rows = raw.map((row) => {
    const acc = Array.isArray(row.accessories) ? row.accessories[0] : row.accessories
    const a = acc as { name?: string } | null
    const productId = String(row.accessory_id)
    return {
      id: String(row.id),
      email: String(row.email),
      variantLabel: (row.variant_label as string | null) ?? null,
      createdAt: String(row.created_at),
      productName: a?.name ?? '—',
      productId,
      inStock: (stock.get(productId) ?? 0) > 0
    } satisfies StockNotifyRow
  })

  return { rows, total: count ?? rows.length }
}
