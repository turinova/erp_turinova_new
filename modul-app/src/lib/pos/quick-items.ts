import type { SupabaseClient } from '@supabase/supabase-js'

import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'

/** Lightspeed-szerű gyorsrács: max ennyi tile. */
export const POS_QUICK_ITEMS_MAX = 24

/** Pult-felirat max (manuális override). Üres = teljes katalógusnév. */
export const POS_LABEL_MAX = 48

export type PosQuickItemInput = {
  accessoryId: string
  posLabel?: string | null
}

export type PosQuickItemAdmin = {
  id: string
  accessory_id: string
  sort_order: number
  pos_label: string | null
  name: string
  sku: string
  active: boolean
  sellable_pos: boolean
  image_url: string | null
  /** Pulton megjelenő név: manuális label vagy teljes katalógusnév. */
  display_name: string
}

/**
 * Pultnév: manuális label → különben teljes katalógusnév (méret/szín megmarad).
 * Nincs agresszív token-vágás.
 */
export function resolvePosDisplayName(
  catalogName: string,
  posLabel?: string | null
): string {
  const label = posLabel?.trim()
  if (label) return label.slice(0, POS_LABEL_MAX)
  const t = catalogName.trim().replace(/\s+/g, ' ')
  return t || '—'
}

/** Javasolt rövid felirat settingshez (nem default megjelenés). */
export function smartPosLabel(
  fullName: string,
  max = POS_LABEL_MAX
): string {
  const t = fullName.trim().replace(/\s+/g, ' ')
  if (!t) return '—'
  if (t.length <= max) return t

  const parts = t.split(' ').filter(Boolean)
  let out = ''
  for (let i = 0; i < parts.length; i++) {
    const next = out ? `${out} ${parts[i]}` : parts[i]!
    if (next.length > max) break
    out = next
    if (i >= 1 && out.length >= 14) break
  }
  if (out.length >= 8) return out
  return t.slice(0, max).trim()
}

const SIZE_RE =
  /\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m|fm|″|"|')\b/gi
const RAL_RE = /\bRAL\s?\d{3,4}\b/gi
const DIA_RE = /[Øø]\s?\d+(?:[.,]\d+)?\s?(?:mm|cm)?/gi

/** Névből kiemelt méret / szín tokenek (tile chip). */
export function extractPosNameHints(catalogName: string): string[] {
  const raw = catalogName.trim()
  if (!raw) return []
  const found: string[] = []
  const seen = new Set<string>()

  function pushMatch(re: RegExp) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) != null) {
      const t = m[0]!.replace(/\s+/g, ' ').trim()
      const key = t.toLocaleLowerCase('hu')
      if (!t || seen.has(key)) continue
      seen.add(key)
      found.push(t)
      if (found.length >= 3) return
    }
  }

  pushMatch(SIZE_RE)
  if (found.length < 3) pushMatch(DIA_RE)
  if (found.length < 3) pushMatch(RAL_RE)
  return found
}

export async function listPosQuickItemsAdmin(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PosQuickItemAdmin[]> {
  const { data, error } = await supabase
    .from('pos_quick_items')
    .select(
      `
      id,
      accessory_id,
      sort_order,
      pos_label,
      accessories (
        name,
        sku,
        active,
        sellable_pos,
        image_url,
        deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  if (error) {
    // Régi DB: pos_label még nincs
    if (
      error.message.includes('pos_quick_items') ||
      error.message.includes('pos_label')
    ) {
      return listPosQuickItemsAdminLegacy(supabase, tenantId)
    }
    console.error('listPosQuickItemsAdmin', error.message)
    throw new Error('Nem sikerült betölteni a gyors termékeket.')
  }

  return (data ?? [])
    .map((row) => mapAdminRow(row))
    .filter((r): r is PosQuickItemAdmin => r != null)
}

async function listPosQuickItemsAdminLegacy(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PosQuickItemAdmin[]> {
  const { data, error } = await supabase
    .from('pos_quick_items')
    .select(
      `
      id,
      accessory_id,
      sort_order,
      accessories (
        name,
        sku,
        active,
        sellable_pos,
        image_url,
        deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })

  if (error) {
    if (error.message.includes('pos_quick_items')) return []
    console.error('listPosQuickItemsAdminLegacy', error.message)
    throw new Error('Nem sikerült betölteni a gyors termékeket.')
  }

  return (data ?? [])
    .map((row) => mapAdminRow({ ...row, pos_label: null }))
    .filter((r): r is PosQuickItemAdmin => r != null)
}

function mapAdminRow(row: Record<string, unknown>): PosQuickItemAdmin | null {
  const acc = Array.isArray(row.accessories)
    ? row.accessories[0]
    : row.accessories
  if (!acc || typeof acc !== 'object' || (acc as { deleted_at?: unknown }).deleted_at) {
    return null
  }
  const a = acc as {
    name?: string
    sku?: string
    active?: boolean
    sellable_pos?: boolean
    image_url?: string | null
  }
  const name = a.name ?? '—'
  const posLabel =
    typeof row.pos_label === 'string' ? row.pos_label : null
  return {
    id: row.id as string,
    accessory_id: row.accessory_id as string,
    sort_order: Number(row.sort_order) || 0,
    pos_label: posLabel?.trim() || null,
    name,
    sku: a.sku ?? '—',
    active: a.active !== false,
    sellable_pos: a.sellable_pos !== false,
    image_url: a.image_url ?? null,
    display_name: resolvePosDisplayName(name, posLabel)
  }
}

/** POS idle rács: aktív + sellable_pos + display_name. */
export async function listPosQuickProductsForSale(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string
): Promise<SaleProductSearchItem[]> {
  if (!warehouseId) return []

  let data: Array<Record<string, unknown>> | null = null
  let errorMessage: string | null = null

  {
    const res = await supabase
      .from('pos_quick_items')
      .select(
        `
        sort_order,
        accessory_id,
        pos_label,
        accessories (
          id,
          name,
          sku,
          price_net,
          image_url,
          active,
          sellable_pos,
          deleted_at,
          tax_rates ( rate_percent ),
          units ( shortform )
        )
      `
      )
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
      .limit(POS_QUICK_ITEMS_MAX)

    if (res.error) {
      errorMessage = res.error.message
      if (res.error.message.includes('pos_label')) {
        const fb = await supabase
          .from('pos_quick_items')
          .select(
            `
            sort_order,
            accessory_id,
            accessories (
              id,
              name,
              sku,
              price_net,
              image_url,
              active,
              sellable_pos,
              deleted_at,
              tax_rates ( rate_percent ),
              units ( shortform )
            )
          `
          )
          .eq('tenant_id', tenantId)
          .order('sort_order', { ascending: true })
          .limit(POS_QUICK_ITEMS_MAX)
        if (fb.error) {
          if (fb.error.message.includes('pos_quick_items')) return []
          console.error('listPosQuickProductsForSale', fb.error.message)
          throw new Error('Nem sikerült betölteni a gyors termékeket.')
        }
        data = (fb.data as Array<Record<string, unknown>>) ?? []
        errorMessage = null
      } else if (res.error.message.includes('pos_quick_items')) {
        return []
      } else {
        console.error('listPosQuickProductsForSale', res.error.message)
        throw new Error('Nem sikerült betölteni a gyors termékeket.')
      }
    } else {
      data = (res.data as Array<Record<string, unknown>>) ?? []
    }
  }

  if (errorMessage && !data) {
    console.error('listPosQuickProductsForSale', errorMessage)
    throw new Error('Nem sikerült betölteni a gyors termékeket.')
  }

  const usable = (data ?? []).filter((row) => {
    const acc = Array.isArray(row.accessories)
      ? row.accessories[0]
      : row.accessories
    return (
      acc &&
      typeof acc === 'object' &&
      !(acc as { deleted_at?: unknown }).deleted_at &&
      (acc as { active?: boolean }).active !== false &&
      (acc as { sellable_pos?: boolean }).sellable_pos !== false
    )
  })

  if (usable.length === 0) return []

  const ids = usable.map((r) => r.accessory_id as string)
  const onHandMap = await getAccessoriesOnHandMap(
    supabase,
    tenantId,
    ids,
    warehouseId
  )

  return usable.map((row) => {
    const acc = (
      Array.isArray(row.accessories) ? row.accessories[0] : row.accessories
    ) as {
      id: string
      name: string
      sku: string
      price_net: number | string
      image_url: string | null
      tax_rates:
        | { rate_percent: number | string }
        | { rate_percent: number | string }[]
        | null
      units: { shortform: string } | { shortform: string }[] | null
    }
    const tax = Array.isArray(acc.tax_rates) ? acc.tax_rates[0] : acc.tax_rates
    const unit = Array.isArray(acc.units) ? acc.units[0] : acc.units
    const posLabel =
      typeof row.pos_label === 'string' ? row.pos_label : null
    return {
      id: acc.id,
      name: acc.name,
      display_name: resolvePosDisplayName(acc.name, posLabel),
      sku: acc.sku,
      price_net: Number(acc.price_net) || 0,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db',
      on_hand: onHandMap.get(acc.id) ?? 0,
      image_url: acc.image_url ?? null
    }
  })
}

/** Teljes lista csere (sorrend = tömb index). */
export async function replacePosQuickItems(
  supabase: SupabaseClient,
  tenantId: string,
  items: PosQuickItemInput[]
): Promise<void> {
  const unique: PosQuickItemInput[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const id = item.accessoryId.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const label = item.posLabel?.trim() || null
    unique.push({
      accessoryId: id,
      posLabel: label ? label.slice(0, POS_LABEL_MAX) : null
    })
    if (unique.length >= POS_QUICK_ITEMS_MAX) break
  }

  if (unique.length > 0) {
    const { data: accs, error: accErr } = await supabase
      .from('accessories')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in(
        'id',
        unique.map((u) => u.accessoryId)
      )

    if (accErr) {
      console.error('replacePosQuickItems accessories', accErr.message)
      throw new Error('Nem sikerült ellenőrizni a termékeket.')
    }
    const allowed = new Set((accs ?? []).map((a) => a.id as string))
    const filtered = unique.filter((u) => allowed.has(u.accessoryId))
    unique.length = 0
    unique.push(...filtered)
  }

  const { error: delErr } = await supabase
    .from('pos_quick_items')
    .delete()
    .eq('tenant_id', tenantId)

  if (delErr) {
    console.error('replacePosQuickItems delete', delErr.message)
    throw new Error('Nem sikerült frissíteni a gyors termékeket.')
  }

  if (unique.length === 0) return

  const rows = unique.map((item, i) => ({
    tenant_id: tenantId,
    accessory_id: item.accessoryId,
    pos_label: item.posLabel?.trim() || null,
    sort_order: i,
    updated_at: new Date().toISOString()
  }))

  const { error: insErr } = await supabase.from('pos_quick_items').insert(rows)
  if (insErr) {
    // pos_label oszlop nélkül: insert label nélkül
    if (insErr.message.includes('pos_label')) {
      const legacy = unique.map((item, i) => ({
        tenant_id: tenantId,
        accessory_id: item.accessoryId,
        sort_order: i,
        updated_at: new Date().toISOString()
      }))
      const { error: legacyErr } = await supabase
        .from('pos_quick_items')
        .insert(legacy)
      if (legacyErr) {
        console.error('replacePosQuickItems legacy', legacyErr.message)
        throw new Error('Nem sikerült menteni a gyors termékeket.')
      }
      return
    }
    console.error('replacePosQuickItems insert', insErr.message)
    throw new Error('Nem sikerült menteni a gyors termékeket.')
  }
}
