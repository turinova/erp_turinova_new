import type { SupabaseClient } from '@supabase/supabase-js'

import type { OpeningStockSearchItem } from '@/lib/opening-stock/parse'
import {
  getAccessoriesOnHandMap,
  getLinearsOnHandMap,
  getSheetsOnHandMap
} from '@/lib/stock/queries'

function safeQuery(q: string): string {
  return q.trim().replace(/[%_,]/g, '').slice(0, 80)
}

/**
 * Nyitó készlet kereső — nincs ár-szűrés (üres árú tétel is felvehető).
 */
export async function searchOpeningStockItems(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  warehouseId: string,
  opts?: { includeMaterials?: boolean; limit?: number }
): Promise<OpeningStockSearchItem[]> {
  const safe = safeQuery(q)
  if (safe.length < 1 || !warehouseId) return []

  const limit = Math.min(40, Math.max(5, opts?.limit ?? 25))
  const includeMaterials = opts?.includeMaterials === true
  const like = `%${safe}%`

  const productPromise = supabase
    .from('accessories')
    .select(
      'id, name, sku, barcode, barcode_internal, image_url, units ( shortform )'
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(
      `name.ilike.${like},sku.ilike.${like},barcode.ilike.${like},barcode_internal.ilike.${like}`
    )
    .limit(limit)

  const sheetPromise = includeMaterials
    ? supabase
        .from('sheet_materials')
        .select('id, name, length_mm, width_mm, thickness_mm, image_url')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('deleted_at', null)
        .ilike('name', like)
        .limit(limit)
    : Promise.resolve({ data: null as null | unknown[], error: null })

  const linearPromise = includeMaterials
    ? supabase
        .from('linear_materials')
        .select(
          'id, name, length_mm, width_mm, thickness_mm, stock_unit, image_url'
        )
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('deleted_at', null)
        .ilike('name', like)
        .limit(limit)
    : Promise.resolve({ data: null as null | unknown[], error: null })

  const [prodRes, sheetRes, linearRes] = await Promise.all([
    productPromise,
    sheetPromise,
    linearPromise
  ])

  if (prodRes.error) {
    console.error('searchOpeningStockItems products', prodRes.error.message)
  }
  if (sheetRes.error) {
    console.error('searchOpeningStockItems sheets', sheetRes.error.message)
  }
  if (linearRes.error) {
    console.error('searchOpeningStockItems linears', linearRes.error.message)
  }

  const products = (prodRes.data ?? []) as {
    id: string
    name: string
    sku: string
    image_url: string | null
    units: { shortform: string } | { shortform: string }[] | null
  }[]
  const sheets = (sheetRes.data ?? []) as {
    id: string
    name: string
    length_mm: number
    width_mm: number
    thickness_mm: number
    image_url: string | null
  }[]
  const linears = (linearRes.data ?? []) as {
    id: string
    name: string
    length_mm: number
    width_mm: number
    thickness_mm: number
    stock_unit: string | null
    image_url: string | null
  }[]

  const [prodOnHand, sheetOnHand, linearOnHand] = await Promise.all([
    getAccessoriesOnHandMap(
      supabase,
      tenantId,
      products.map((p) => p.id),
      warehouseId
    ),
    getSheetsOnHandMap(
      supabase,
      tenantId,
      sheets.map((s) => s.id),
      warehouseId
    ),
    getLinearsOnHandMap(
      supabase,
      tenantId,
      linears.map((l) => l.id),
      warehouseId
    )
  ])

  const out: OpeningStockSearchItem[] = []

  for (const p of products) {
    const units = p.units
    const unit = Array.isArray(units) ? units[0] : units
    out.push({
      kind: 'product',
      id: p.id,
      name: p.name,
      sku: p.sku,
      unitShortform: unit?.shortform ?? 'db',
      onHand: prodOnHand.get(p.id) ?? 0,
      imageUrl: p.image_url ?? null
    })
  }

  for (const s of sheets) {
    out.push({
      kind: 'sheet_material',
      id: s.id,
      name: s.name,
      sku: `${s.length_mm}×${s.width_mm}×${s.thickness_mm}`,
      unitShortform: 'tábla',
      onHand: sheetOnHand.get(s.id) ?? 0,
      imageUrl: s.image_url ?? null
    })
  }

  for (const l of linears) {
    out.push({
      kind: 'linear_material',
      id: l.id,
      name: l.name,
      sku: `${l.length_mm}×${l.width_mm}×${l.thickness_mm}`,
      unitShortform: l.stock_unit === 'fm' ? 'fm' : 'db',
      onHand: linearOnHand.get(l.id) ?? 0,
      imageUrl: l.image_url ?? null
    })
  }

  return out.slice(0, limit)
}
