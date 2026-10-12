import type { SupabaseClient } from '@supabase/supabase-js'

import type { SaleProductSearchItem } from '@/lib/sales/queries'

type FrequentRow = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  price_net: number | string
  price_gross?: number | string | null
  tax_rate_percent: number | string
  unit_shortform: string
  image_url: string | null
  on_hand: number | string
  sale_count: number | string
}

export type PosManufacturerChip = {
  id: string
  name: string
  product_count: number
}

function mapFrequent(row: FrequentRow): SaleProductSearchItem {
  const priceNet = Number(row.price_net) || 0
  const storedGross =
    row.price_gross != null && Number.isFinite(Number(row.price_gross))
      ? Math.round(Number(row.price_gross))
      : undefined
  return {
    kind: 'product',
    id: row.id,
    name: row.name,
    sku: row.sku,
    price_net: priceNet,
    ...(storedGross != null ? { price_gross: storedGross } : {}),
    tax_rate_percent: Number(row.tax_rate_percent) || 0,
    unit_shortform: row.unit_shortform || 'db',
    on_hand: Number(row.on_hand) || 0,
    image_url: row.image_url ?? null
  }
}

export async function loadPosFrequentProducts(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string,
  opts?: { days?: number; limit?: number }
): Promise<SaleProductSearchItem[]> {
  if (!warehouseId) return []
  const { data, error } = await supabase.rpc('pos_frequent_products', {
    p_tenant_id: tenantId,
    p_warehouse_id: warehouseId,
    p_days: opts?.days ?? 7,
    p_limit: opts?.limit ?? 8
  })
  if (error) {
    if (/pos_frequent_products|schema cache|does not exist/i.test(error.message)) {
      return []
    }
    console.error('loadPosFrequentProducts', error.message)
    return []
  }
  return ((data ?? []) as FrequentRow[]).map(mapFrequent)
}

export async function loadPosManufacturerChips(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 6
): Promise<PosManufacturerChip[]> {
  const { data, error } = await supabase.rpc('pos_search_manufacturer_chips', {
    p_tenant_id: tenantId,
    p_limit: limit
  })
  if (error) {
    if (
      /pos_search_manufacturer_chips|schema cache|does not exist/i.test(
        error.message
      )
    ) {
      return []
    }
    console.error('loadPosManufacturerChips', error.message)
    return []
  }
  return ((data ?? []) as Array<{ id: string; name: string; product_count: number | string }>).map(
    (r) => ({
      id: r.id,
      name: r.name,
      product_count: Number(r.product_count) || 0
    })
  )
}

export type PosSearchMissRow = {
  q: string
  miss_count: number
  last_at: string
}

export async function loadPosSearchMissStats(
  supabase: SupabaseClient,
  tenantId: string,
  days = 14,
  limit = 15
): Promise<PosSearchMissRow[]> {
  const { data, error } = await supabase.rpc('pos_search_miss_stats', {
    p_tenant_id: tenantId,
    p_days: days,
    p_limit: limit
  })
  if (error) {
    if (/pos_search_miss_stats|schema cache|does not exist/i.test(error.message)) {
      return []
    }
    console.error('loadPosSearchMissStats', error.message)
    return []
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    q: String(row.q ?? ''),
    miss_count: Number(row.miss_count) || 0,
    last_at: String(row.last_at ?? '')
  }))
}

export async function logPosSearchEvent(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    warehouseId: string | null
    registerId: string | null
    userId: string | null
    q: string
    hitCount: number
    pickedAccessoryId?: string | null
    latencyMs?: number | null
  }
): Promise<void> {
  const q = input.q.trim()
  if (!q) return
  const { error } = await supabase.from('pos_search_events').insert({
    tenant_id: input.tenantId,
    warehouse_id: input.warehouseId,
    register_id: input.registerId,
    user_id: input.userId,
    q: q.slice(0, 200),
    hit_count: input.hitCount,
    picked_accessory_id: input.pickedAccessoryId ?? null,
    latency_ms: input.latencyMs ?? null
  })
  if (error && !/pos_search_events|schema cache|does not exist/i.test(error.message)) {
    console.warn('logPosSearchEvent', error.message)
  }
}

export async function loadAccessorySearchAliases(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('accessory_web')
    .select('web_search_aliases')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .maybeSingle()
  if (error) {
    console.error('loadAccessorySearchAliases', error.message)
    return []
  }
  const raw = data?.web_search_aliases
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : []
}

export async function saveAccessorySearchAliases(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  aliases: string[]
): Promise<void> {
  const cleaned = [
    ...new Set(
      aliases
        .map((a) => a.trim().replace(/\s+/g, ' '))
        .filter(Boolean)
        .slice(0, 40)
    )
  ]

  const { data: existing } = await supabase
    .from('accessory_web')
    .select('accessory_id')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('accessory_web')
      .update({ web_search_aliases: cleaned })
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('accessory_web').insert({
    tenant_id: tenantId,
    accessory_id: accessoryId,
    web_search_aliases: cleaned
  })
  if (error) throw new Error(error.message)
}
