import type { SupabaseClient } from '@supabase/supabase-js'

import { prepareBarcodeQuery } from '@/lib/pos/barcode'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { getAccessoryOnHand } from '@/lib/stock/queries'

export type PosBarcodeLookupResult =
  | { ok: true; product: SaleProductSearchItem }
  | { ok: false; message: string; notFound?: boolean }

type RpcRow = {
  id: string
  name: string
  sku: string
  price_net: number | string
  barcode: string | null
  barcode_internal: string | null
  image_url: string | null
  tax_rate_percent: number | string
  unit_shortform: string
  on_hand: number | string
}

/**
 * Exact POS barcode → termék + on_hand (RPC, egy round-trip / kandidátus).
 * Ha a lookup_pos_barcode RPC még nincs migrálva → hybrid fallback.
 */
export async function lookupPosBarcodeProduct(
  supabase: SupabaseClient,
  tenantId: string,
  code: string,
  warehouseId: string
): Promise<PosBarcodeLookupResult> {
  const { raw, normalized } = prepareBarcodeQuery(code)
  const candidates = [...new Set([normalized, raw].filter(Boolean))]
  if (candidates.length === 0) {
    return { ok: false, message: 'Üres vonalkód.', notFound: true }
  }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  for (const c of candidates) {
    const safe = c.replace(/[%_,]/g, '').trim()
    if (!safe) continue

    const { data, error } = await supabase.rpc('lookup_pos_barcode', {
      p_tenant_id: tenantId,
      p_code: safe,
      p_warehouse_id: warehouseId
    })

    if (error) {
      if (/lookup_pos_barcode|schema cache|does not exist/i.test(error.message)) {
        return lookupPosBarcodeHybrid(supabase, tenantId, safe, warehouseId)
      }
      console.error('lookupPosBarcodeProduct', error.message)
      return { ok: false, message: 'Nem sikerült a vonalkód keresés.' }
    }

    const rows = (data ?? []) as RpcRow[]
    const row = rows[0]
    if (!row) continue

    return {
      ok: true,
      product: {
        id: row.id,
        name: row.name,
        sku: row.sku,
        price_net: Number(row.price_net) || 0,
        tax_rate_percent: Number(row.tax_rate_percent) || 0,
        unit_shortform: row.unit_shortform || 'db',
        on_hand: Number(row.on_hand) || 0,
        image_url: row.image_url ?? null
      }
    }
  }

  return {
    ok: false,
    message: 'Vonalkód nem található.',
    notFound: true
  }
}

async function lookupPosBarcodeHybrid(
  supabase: SupabaseClient,
  tenantId: string,
  safe: string,
  warehouseId: string
): Promise<PosBarcodeLookupResult> {
  const { data, error } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      price_net,
      barcode,
      barcode_internal,
      image_url,
      sellable_pos,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(`barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`)
    .limit(5)

  if (error) {
    console.error('lookupPosBarcodeHybrid', error.message)
    return { ok: false, message: 'Nem sikerült a vonalkód keresés.' }
  }

  type AccRow = {
    id: string
    name: string
    sku: string
    price_net: number | string
    barcode: string | null
    barcode_internal: string | null
    image_url: string | null
    sellable_pos: boolean | null
    tax_rates:
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    units: { shortform: string } | { shortform: string }[] | null
  }

  const rows = (data ?? []) as AccRow[]
  const exact =
    rows.find(
      (r) =>
        (r.sellable_pos !== false) &&
        (r.barcode === safe ||
          r.barcode_internal === safe ||
          r.sku === safe)
    ) ?? null

  if (!exact) {
    return {
      ok: false,
      message: 'Vonalkód nem található.',
      notFound: true
    }
  }

  let onHand = 0
  try {
    onHand = await getAccessoryOnHand(
      supabase,
      tenantId,
      exact.id,
      warehouseId
    )
  } catch {
    onHand = 0
  }

  const taxRates = exact.tax_rates
  const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
  const units = exact.units
  const unit = Array.isArray(units) ? units[0] : units

  return {
    ok: true,
    product: {
      id: exact.id,
      name: exact.name,
      sku: exact.sku,
      price_net: Number(exact.price_net) || 0,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db',
      on_hand: onHand,
      image_url: exact.image_url ?? null
    }
  }
}
