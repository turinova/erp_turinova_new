import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import {
  evaluateShopReady,
  mapAccessoryWebFields,
  type AccessoryWebFields,
  type ShopReadyLevel,
  WEB_SELECT_COLUMNS
} from '@/lib/accessories/web-shop'
import { listAccessoryAttributeInputs } from '@/lib/webshop/queries'
import type { AttributeInput } from '@/lib/webshop/types'

export type AccessoryListItem = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  manufacturer_id: string
  manufacturer_name: string
  tax_rate_id: string
  tax_rate_name: string
  tax_rate_percent: number
  unit_id: string
  unit_name: string
  unit_shortform: string
  price_net: number
  price_gross: number
  purchase_price_net: number | null
  margin_factor: number | null
  image_url: string | null
  active: boolean
  sellable_pos: boolean
  created_at: string
  updated_at: string
  web_category_id: string | null
  attribute_value_ids: string[]
  attribute_inputs: AttributeInput[]
} & AccessoryWebFields & {
    shop_ready_level: ShopReadyLevel
    shop_ready_score: number
    shop_ready_missing: string[]
  }

export type AccessoryTaxOption = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

export type AccessoryUnitOption = {
  id: string
  name: string
  shortform: string
}

export type AccessoryManufacturerOption = {
  id: string
  name: string
}

const ACCESSORY_SELECT = `
  id,
  name,
  sku,
  barcode,
  barcode_internal,
  manufacturer_id,
  tax_rate_id,
  unit_id,
  price_net,
  purchase_price_net,
  margin_factor,
  image_url,
  active,
  sellable_pos,
  created_at,
  updated_at,
  web_category_id,
  ${WEB_SELECT_COLUMNS},
  manufacturers ( name ),
  tax_rates ( name, rate_percent ),
  units ( name, shortform )
`

function mapAccessoryRow(
  row: Record<string, unknown>,
  attributeValueIds: string[] = [],
  attributeInputs: AttributeInput[] = []
): AccessoryListItem {
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  const unit = Array.isArray(row.units) ? row.units[0] : row.units
  const priceNet = Number(row.price_net)
  const taxPercent = Number(
    (tax as { rate_percent?: number } | null)?.rate_percent ?? 0
  )
  const manufacturerName =
    (manufacturer as { name?: string } | null)?.name ?? '—'
  const web = mapAccessoryWebFields(row)
  const ready = evaluateShopReady({
    ...web,
    name: String(row.name ?? ''),
    image_url: (row.image_url as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    manufacturer_name: manufacturerName === '—' ? null : manufacturerName,
    price_net: priceNet,
    active: row.active === true
  })

  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    barcode: (row.barcode as string | null) ?? null,
    barcode_internal: (row.barcode_internal as string | null) ?? null,
    manufacturer_id: String(row.manufacturer_id),
    manufacturer_name: manufacturerName,
    tax_rate_id: String(row.tax_rate_id),
    tax_rate_name: (tax as { name?: string } | null)?.name ?? '—',
    tax_rate_percent: taxPercent,
    unit_id: String(row.unit_id),
    unit_name: (unit as { name?: string } | null)?.name ?? '—',
    unit_shortform: (unit as { shortform?: string } | null)?.shortform ?? 'db',
    price_net: priceNet,
    price_gross: grossFromNet(priceNet, taxPercent),
    purchase_price_net:
      row.purchase_price_net == null ? null : Number(row.purchase_price_net),
    margin_factor:
      row.margin_factor == null ? null : Number(row.margin_factor),
    image_url: (row.image_url as string | null) ?? null,
    active: row.active === true,
    sellable_pos: row.sellable_pos !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    web_category_id: (row.web_category_id as string | null) ?? null,
    attribute_value_ids: attributeValueIds,
    attribute_inputs: attributeInputs,
    ...web,
    shop_ready_level: ready.level,
    shop_ready_score: ready.score,
    shop_ready_missing: ready.missing
  }
}

export async function listAccessories(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const { data, error } = await supabase
    .from('accessories')
    .select(ACCESSORY_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessories', error.message)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  return (data ?? []).map((row) =>
    mapAccessoryRow(row as unknown as Record<string, unknown>)
  )
}

export async function getAccessory(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<AccessoryListItem | null> {
  const { data, error } = await supabase
    .from('accessories')
    .select(ACCESSORY_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getAccessory', error.message)
    throw new Error('Nem sikerült betölteni a terméket.')
  }
  if (!data) return null

  const [{ data: attrLinks }, attributeInputs] = await Promise.all([
    supabase
      .from('accessory_attribute_values')
      .select('attribute_value_id')
      .eq('tenant_id', tenantId)
      .eq('accessory_id', id),
    listAccessoryAttributeInputs(supabase, tenantId, id)
  ])

  return mapAccessoryRow(
    data as unknown as Record<string, unknown>,
    (attrLinks ?? []).map((r) => r.attribute_value_id as string),
    attributeInputs
  )
}

export async function listAccessoryTaxOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryTaxOption[]> {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })

  if (error) {
    console.error('listAccessoryTaxOptions', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    rate_percent: Number(row.rate_percent),
    is_default: row.is_default
  }))
}

export async function listAccessoryUnitOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryUnitOption[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, shortform')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessoryUnitOptions', error.message)
    throw new Error('Nem sikerült betölteni az egységeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    shortform: row.shortform
  }))
}

export async function listAccessoryManufacturerOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryManufacturerOption[]> {
  const { data, error } = await supabase
    .from('manufacturers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessoryManufacturerOptions', error.message)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return data ?? []
}

export async function listActiveAccessoryOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const rows = await listAccessories(supabase, tenantId)
  return rows.filter((r) => r.active)
}
