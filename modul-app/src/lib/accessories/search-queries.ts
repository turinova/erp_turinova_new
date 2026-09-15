import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'

export type AccessorySearchItem = {
  id: string
  name: string
  sku: string
  manufacturer_name: string
  unit_shortform: string
  price_net: number
  tax_rate_percent: number
  price_gross: number
}

export type SearchAccessoriesParams = {
  tenantId: string
  q: string
  page?: number
  limit?: number
}

export type SearchAccessoriesResult = {
  rows: AccessorySearchItem[]
  total: number
  page: number
  limit: number
}

export async function searchAccessories(
  supabase: SupabaseClient,
  params: SearchAccessoriesParams
): Promise<SearchAccessoriesResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q.trim()

  if (!q) {
    return { rows: [], total: 0, page, limit }
  }

  const safe = q.replace(/[%_,]/g, '')
  if (!safe) {
    return { rows: [], total: 0, page, limit }
  }

  const { data: manufacturerMatches } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .ilike('name', `%${safe}%`)
    .limit(50)

  const manufacturerIds = (manufacturerMatches ?? []).map((m) => m.id)
  const orParts = [
    `name.ilike.%${safe}%`,
    `sku.ilike.%${safe}%`,
    `barcode.ilike.%${safe}%`,
    `barcode_internal.ilike.%${safe}%`
  ]
  if (manufacturerIds.length > 0) {
    orParts.push(`manufacturer_id.in.(${manufacturerIds.join(',')})`)
  }

  const { data, error, count } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      price_net,
      manufacturers ( name ),
      tax_rates ( rate_percent ),
      units ( shortform )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(orParts.join(','))
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('searchAccessories', error.message)
    throw new Error('Nem sikerült keresni a termékek között.')
  }

  const rows: AccessorySearchItem[] = (data ?? []).map((row) => {
    const manufacturers = row.manufacturers as
      | { name: string }
      | { name: string }[]
      | null
    const manufacturer = Array.isArray(manufacturers)
      ? manufacturers[0]
      : manufacturers
    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const units = row.units as
      | { shortform: string }
      | { shortform: string }[]
      | null
    const unit = Array.isArray(units) ? units[0] : units
    const priceNet = Number(row.price_net) || 0
    const taxPercent = Number(tax?.rate_percent ?? 0)

    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      manufacturer_name: manufacturer?.name ?? '—',
      unit_shortform: unit?.shortform ?? 'db',
      price_net: priceNet,
      tax_rate_percent: taxPercent,
      price_gross: grossFromNet(priceNet, taxPercent)
    }
  })

  return { rows, total: count ?? 0, page, limit }
}
