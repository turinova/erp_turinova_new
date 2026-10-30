import type { SupabaseClient } from '@supabase/supabase-js'

import type { A4BarcodeSource, A4SheetCellDraft } from '@/lib/a4-barcode-sheets/types'

export type A4SheetListItem = {
  id: string
  name: string
  cols: number
  rows: number
  margin_mm: number
  cell_count: number
  updated_at: string
}

export type A4SheetDetail = {
  id: string
  name: string
  cols: number
  rows: number
  margin_mm: number
  show_name: boolean
  show_sku: boolean
  show_price: boolean
  updated_at: string
  cells: A4SheetCellDraft[]
}

export type A4ProductSearchItem = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  price_gross: number
  unit_shortform: string
  active: boolean
}

export async function listA4BarcodeSheets(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { page?: number; limit?: number; q?: string }
): Promise<{ rows: A4SheetListItem[]; total: number }> {
  const page = Math.max(1, opts?.page ?? 1)
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = opts?.q?.trim() ?? ''

  let query = supabase
    .from('a4_barcode_sheets')
    .select('id, name, cols, rows, margin_mm, updated_at', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) query = query.ilike('name', `%${safe}%`)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listA4BarcodeSheets', error.message)
    throw new Error(
      /relation .* does not exist|Could not find the table/i.test(error.message)
        ? 'A vonalkód lap tábla nincs telepítve. Futtasd a 20260624_a4_barcode_sheets migrációt.'
        : 'Nem sikerült betölteni a vonalkód lapokat.'
    )
  }

  const ids = (data ?? []).map((r) => r.id as string)
  const countBySheet = new Map<string, number>()
  if (ids.length > 0) {
    const { data: cells } = await supabase
      .from('a4_barcode_sheet_cells')
      .select('sheet_id')
      .eq('tenant_id', tenantId)
      .in('sheet_id', ids)
    for (const c of cells ?? []) {
      const sid = c.sheet_id as string
      countBySheet.set(sid, (countBySheet.get(sid) ?? 0) + 1)
    }
  }

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      cols: Number(r.cols),
      rows: Number(r.rows),
      margin_mm: Number(r.margin_mm),
      cell_count: countBySheet.get(r.id as string) ?? 0,
      updated_at: r.updated_at as string
    })),
    total: count ?? 0
  }
}

export async function getA4BarcodeSheet(
  supabase: SupabaseClient,
  tenantId: string,
  sheetId: string
): Promise<A4SheetDetail | null> {
  const { data: sheet, error } = await supabase
    .from('a4_barcode_sheets')
    .select(
      'id, name, cols, rows, margin_mm, show_name, show_sku, show_price, updated_at'
    )
    .eq('tenant_id', tenantId)
    .eq('id', sheetId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getA4BarcodeSheet', error.message)
    throw new Error('Nem sikerült betölteni a vonalkód lapot.')
  }
  if (!sheet) return null

  const { data: cellRows, error: cellErr } = await supabase
    .from('a4_barcode_sheet_cells')
    .select(
      'row_i, col_i, accessory_id, barcode_value, barcode_source, name_snap, sku_snap, price_snap, unit_snap, show_name, show_sku, show_price, show_barcode'
    )
    .eq('tenant_id', tenantId)
    .eq('sheet_id', sheetId)
    .order('row_i', { ascending: true })
    .order('col_i', { ascending: true })

  if (cellErr) {
    console.error('getA4BarcodeSheet cells', cellErr.message)
    throw new Error('Nem sikerült betölteni a cellákat.')
  }

  const accessoryIds = [
    ...new Set(
      (cellRows ?? [])
        .map((c) => c.accessory_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ]

  const deletedIds = new Set<string>()
  const priceById = new Map<string, number>()
  if (accessoryIds.length > 0) {
    const { data: accs } = await supabase
      .from('accessories')
      .select('id, deleted_at, price_net, tax_rates ( rate_percent )')
      .eq('tenant_id', tenantId)
      .in('id', accessoryIds)

    for (const a of accs ?? []) {
      if (a.deleted_at) deletedIds.add(a.id as string)
      const rate =
        (a.tax_rates as { rate_percent?: number } | null)?.rate_percent ?? 0
      const net = Number(a.price_net) || 0
      priceById.set(a.id as string, Math.round(net * (1 + rate / 100)))
    }
    for (const id of accessoryIds) {
      if (!priceById.has(id) && !deletedIds.has(id)) {
        // Missing row → treat as deleted
        deletedIds.add(id)
      }
    }
  }

  const cells: A4SheetCellDraft[] = (cellRows ?? []).map((c) => {
    const aid = (c.accessory_id as string | null) ?? null
    const snapPrice =
      c.price_snap == null ? null : Number(c.price_snap)
    const livePrice = aid ? priceById.get(aid) ?? null : null
    return {
      row: Number(c.row_i),
      col: Number(c.col_i),
      accessoryId: aid,
      barcodeValue: String(c.barcode_value ?? ''),
      barcodeSource: (c.barcode_source as A4BarcodeSource) || 'auto',
      nameSnap: String(c.name_snap ?? ''),
      skuSnap: String(c.sku_snap ?? ''),
      priceGross: livePrice ?? snapPrice,
      unitSnap: String(c.unit_snap ?? '').trim() || 'db',
      showName: c.show_name !== false,
      showSku: Boolean(c.show_sku),
      showPrice: c.show_price !== false,
      showBarcode: c.show_barcode !== false,
      accessoryDeleted: aid ? deletedIds.has(aid) : false
    }
  })

  return {
    id: sheet.id as string,
    name: sheet.name as string,
    cols: Number(sheet.cols),
    rows: Number(sheet.rows),
    margin_mm: Number(sheet.margin_mm),
    show_name: Boolean(sheet.show_name),
    show_sku: Boolean(sheet.show_sku),
    show_price: Boolean(sheet.show_price),
    updated_at: sheet.updated_at as string,
    cells
  }
}

export async function searchA4Products(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  limit = 15
): Promise<A4ProductSearchItem[]> {
  const term = q.trim().replace(/[%_,()"\\*]/g, ' ').replace(/\s+/g, ' ').trim()
  if (term.length < 2) return []

  const capped = Math.max(1, Math.min(limit, 25))
  const { data, error } = await supabase.rpc('search_accessories_page', {
    p_tenant_id: tenantId,
    p_q: term,
    p_limit: capped,
    p_offset: 0
  })

  if (error) {
    console.error('searchA4Products', error.message)
    throw new Error(
      /Could not find the function|PGRST202/i.test(error.message)
        ? 'A termékkereső RPC nincs telepítve.'
        : 'Nem sikerült keresni a termékek között.'
    )
  }

  return ((data ?? []) as Record<string, unknown>[])
    .filter((r) => r.active !== false)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ''),
      sku: String(r.sku ?? ''),
      barcode: r.barcode == null ? null : String(r.barcode),
      barcode_internal:
        r.barcode_internal == null ? null : String(r.barcode_internal),
      price_gross: Number(r.price_gross) || 0,
      unit_shortform: String(r.unit_shortform ?? 'db').trim() || 'db',
      active: r.active !== false
    }))
}
