import type { SupabaseClient } from '@supabase/supabase-js'

import {
  searchAccessories,
  type AccessorySearchItem
} from '@/lib/accessories/search-queries'
import {
  formatLinearSizeLabel,
  searchLinearMaterials,
  type LinearMaterialSearchItem
} from '@/lib/linear-materials/search-queries'
import { formatMoneyFt } from '@/lib/sheet-materials/parse'
import {
  formatSheetSizeLabel,
  searchSheetMaterials,
  type SheetMaterialSearchItem
} from '@/lib/sheet-materials/search-queries'

export type UnifiedSearchKind = 'sheet' | 'linear' | 'accessory'

export type UnifiedMaterialSearchItem = {
  kind: UnifiedSearchKind
  id: string
  name: string
  manufacturer_name: string
  type_label: string
  /** SKU — csak termék. */
  sku: string | null
  length_mm: number | null
  width_mm: number | null
  thickness_mm: number | null
  on_stock: boolean | null
  /** Bruttó Ft/m — csak szálas. */
  price_gross_per_m: number | null
  /** Bruttó Ft/m² — csak táblás. */
  price_gross_sqm: number | null
  /** Egész tábla / egész szál / termék egységár bruttó. */
  price_gross_piece: number
  /** Egység shortform — termék. */
  unit_shortform: string | null
}

export type SearchMaterialsUnifiedParams = {
  tenantId: string
  q: string
  page?: number
  limit?: number
  /** all = mindhárom forrás; egyébként csak a választott. */
  kind?: UnifiedSearchKind | 'all'
}

export type SearchMaterialsUnifiedResult = {
  rows: UnifiedMaterialSearchItem[]
  total: number
  page: number
  limit: number
}

/** Max találat forrásonként a merge előtt — kicsi cap = gyorsabb PostgREST. */
const SOURCE_FETCH_CAP = 40

function mapSheet(row: SheetMaterialSearchItem): UnifiedMaterialSearchItem {
  return {
    kind: 'sheet',
    id: row.id,
    name: row.name,
    manufacturer_name: row.manufacturer_name,
    type_label: 'Bútorlap',
    sku: null,
    length_mm: row.length_mm,
    width_mm: row.width_mm,
    thickness_mm: row.thickness_mm,
    on_stock: row.on_stock,
    price_gross_per_m: null,
    price_gross_sqm: row.price_gross_sqm,
    price_gross_piece: row.price_gross_sheet,
    unit_shortform: null
  }
}

function mapLinear(row: LinearMaterialSearchItem): UnifiedMaterialSearchItem {
  return {
    kind: 'linear',
    id: row.id,
    name: row.name,
    manufacturer_name: row.manufacturer_name,
    type_label: row.material_type_label,
    sku: null,
    length_mm: row.length_mm,
    width_mm: row.width_mm,
    thickness_mm: row.thickness_mm,
    on_stock: row.on_stock,
    price_gross_per_m: row.price_gross_per_m,
    price_gross_sqm: null,
    price_gross_piece: row.price_gross_piece,
    unit_shortform: null
  }
}

function mapAccessory(row: AccessorySearchItem): UnifiedMaterialSearchItem {
  return {
    kind: 'accessory',
    id: row.id,
    name: row.name,
    manufacturer_name: row.manufacturer_name,
    type_label: 'Termék',
    sku: row.sku,
    length_mm: null,
    width_mm: null,
    thickness_mm: null,
    on_stock: null,
    price_gross_per_m: null,
    price_gross_sqm: null,
    price_gross_piece: row.price_gross,
    unit_shortform: row.unit_shortform
  }
}

function sortKey(row: UnifiedMaterialSearchItem): string {
  return `${row.name}\u0000${row.manufacturer_name}\u0000${row.kind}\u0000${row.id}`.toLocaleLowerCase('hu')
}

export function formatUnifiedSizeLabel(row: UnifiedMaterialSearchItem): string {
  if (row.kind === 'accessory') {
    return row.sku ? `SKU ${row.sku}` : '—'
  }
  if (
    row.length_mm == null ||
    row.width_mm == null ||
    row.thickness_mm == null
  ) {
    return '—'
  }
  if (row.kind === 'linear') {
    return formatLinearSizeLabel(row.length_mm, row.width_mm, row.thickness_mm)
  }
  return formatSheetSizeLabel(row.length_mm, row.width_mm, row.thickness_mm)
}

export function formatUnifiedPrice(value: number | null): string {
  if (value === null) return '—'
  return formatMoneyFt(value)
}

/**
 * Táblás + szálas + termék párhuzamos keresés, közös ABC lista, lapozás a merge után.
 * `kind` szűrővel csak a releváns forrást kérdezi le.
 */
export async function searchMaterialsUnified(
  supabase: SupabaseClient,
  params: SearchMaterialsUnifiedParams
): Promise<SearchMaterialsUnifiedResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const q = params.q.trim()
  const kind = params.kind ?? 'all'

  if (!q) {
    return { rows: [], total: 0, page, limit }
  }

  const wantSheet = kind === 'all' || kind === 'sheet'
  const wantLinear = kind === 'all' || kind === 'linear'
  const wantAccessory = kind === 'all' || kind === 'accessory'

  const safe = q.replace(/[%_,]/g, '')
  if (!safe) {
    return { rows: [], total: 0, page, limit }
  }

  // Egy gyártó prequery — ne 3× párhuzamosan.
  const { data: manufacturerMatches } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .ilike('name', `%${safe}%`)
    .limit(50)
  const manufacturerIds = (manufacturerMatches ?? []).map((m) => m.id)

  const [sheets, linears, accessories] = await Promise.all([
    wantSheet
      ? searchSheetMaterials(supabase, {
          tenantId: params.tenantId,
          q,
          page: 1,
          limit: SOURCE_FETCH_CAP,
          manufacturerIds
        })
      : Promise.resolve({ rows: [], total: 0, page: 1, limit: SOURCE_FETCH_CAP }),
    wantLinear
      ? searchLinearMaterials(supabase, {
          tenantId: params.tenantId,
          q,
          page: 1,
          limit: SOURCE_FETCH_CAP,
          manufacturerIds
        })
      : Promise.resolve({ rows: [], total: 0, page: 1, limit: SOURCE_FETCH_CAP }),
    wantAccessory
      ? searchAccessories(supabase, {
          tenantId: params.tenantId,
          q,
          page: 1,
          limit: SOURCE_FETCH_CAP,
          manufacturerIds
        })
      : Promise.resolve({ rows: [], total: 0, page: 1, limit: SOURCE_FETCH_CAP })
  ])

  const combined = [
    ...sheets.rows.map(mapSheet),
    ...linears.rows.map(mapLinear),
    ...accessories.rows.map(mapAccessory)
  ].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'hu'))

  const total = combined.length
  const from = (page - 1) * limit
  const rows = combined.slice(from, from + limit)

  return { rows, total, page, limit }
}

export function parseSearchKindParam(
  value: string | undefined | null
): UnifiedSearchKind | 'all' {
  if (value === 'sheet' || value === 'linear' || value === 'accessory') {
    return value
  }
  return 'all'
}
