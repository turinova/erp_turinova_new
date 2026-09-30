import type { SupabaseClient } from '@supabase/supabase-js'

import type { OptiCustomerOption } from '@/lib/customers/queries'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'

export async function searchCustomersForSelect(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  limit = 25
): Promise<OptiCustomerOption[]> {
  const { data, error } = await supabase.rpc('search_customers_for_select', {
    p_tenant_id: tenantId,
    p_q: q.trim(),
    p_limit: Math.min(50, Math.max(1, limit))
  })

  if (error) {
    console.error('searchCustomersForSelect', error.message)
    throw new Error('Nem sikerült keresni az ügyfeleket.')
  }

  return ((data ?? []) as OptiCustomerOption[]).map((row) => ({
    ...row,
    billing_country: row.billing_country || 'Magyarország'
  }))
}

type SheetRpcRow = {
  id: string
  name: string
  length_mm: number | string
  width_mm: number | string
  thickness_mm: number | string
  on_stock: boolean
  image_url: string | null
  grain_direction: boolean
  rotatable: boolean
  kerf_mm: number | string
  trim_top_mm: number | string
  trim_right_mm: number | string
  trim_bottom_mm: number | string
  trim_left_mm: number | string
  price_net: number | string
  usage_limit: number | string
  waste_multi: number | string
  manufacturer_name: string
  vat_rate_percent: number | string
}

export async function searchSheetMaterialsForOpti(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  limit = 40
): Promise<OptiSheetMaterialOption[]> {
  const { data, error } = await supabase.rpc('search_sheet_materials_for_opti', {
    p_tenant_id: tenantId,
    p_q: q.trim(),
    p_limit: Math.min(80, Math.max(1, limit))
  })

  if (error) {
    console.error('searchSheetMaterialsForOpti', error.message)
    throw new Error('Nem sikerült keresni a táblás anyagokat.')
  }

  return ((data ?? []) as SheetRpcRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    length_mm: Number(r.length_mm),
    width_mm: Number(r.width_mm),
    thickness_mm: Number(r.thickness_mm),
    on_stock: Boolean(r.on_stock),
    image_url: r.image_url ?? null,
    grain_direction: Boolean(r.grain_direction),
    rotatable: r.rotatable !== false,
    kerf_mm: Number(r.kerf_mm ?? 3),
    trim_top_mm: Number(r.trim_top_mm),
    trim_right_mm: Number(r.trim_right_mm),
    trim_bottom_mm: Number(r.trim_bottom_mm),
    trim_left_mm: Number(r.trim_left_mm),
    price_net: Number(r.price_net),
    usage_limit: Number(r.usage_limit),
    waste_multi: Number(r.waste_multi),
    manufacturer_name: r.manufacturer_name || 'Ismeretlen',
    vat_rate_percent: Number(r.vat_rate_percent ?? 0)
  }))
}
