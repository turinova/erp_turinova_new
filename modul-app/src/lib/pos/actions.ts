'use server'

import { getSessionUser } from '@/lib/auth/session'
import { getAccessoryOnHand } from '@/lib/stock/queries'
import { createClient } from '@/lib/supabase/server'
import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type PosBarcodeLookupResult =
  | { ok: true; product: SaleProductSearchItem }
  | { ok: false; message: string; notFound?: boolean }

type AccessoryBarcodeRow = {
  id: string
  name: string
  sku: string
  price_net: number | string
  barcode: string | null
  barcode_internal: string | null
  image_url: string | null
  tax_rates:
    | { rate_percent: number | string }
    | { rate_percent: number | string }[]
    | null
  units: { shortform: string } | { shortform: string }[] | null
}

/** Exact barcode / internal / sku → termék + WH on_hand. */
export async function lookupPosProductByBarcode(
  code: string,
  warehouseId: string
): Promise<PosBarcodeLookupResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const raw = code.trim()
  const normalized = normalizeScannerBarcode(raw)
  const candidates = [...new Set([normalized, raw].filter(Boolean))]
  if (candidates.length === 0) {
    return { ok: false, message: 'Üres vonalkód.', notFound: true }
  }

  let row: AccessoryBarcodeRow | null = null

  for (const c of candidates) {
    const safe = c.replace(/[%_,]/g, '')
    if (!safe) continue
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
        tax_rates ( rate_percent ),
        units ( shortform )
      `
      )
      .eq('tenant_id', user.tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(`barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`)
      .limit(5)

    if (error) {
      console.error('lookupPosProductByBarcode', error.message)
      return { ok: false, message: 'Nem sikerült a vonalkód keresés.' }
    }

    const rows = (data ?? []) as AccessoryBarcodeRow[]
    const exact =
      rows.find(
        (r) =>
          r.barcode === safe ||
          r.barcode_internal === safe ||
          r.sku === safe
      ) ?? rows[0]

    if (exact) {
      row = exact
      break
    }
  }

  if (!row) {
    return {
      ok: false,
      message: 'Vonalkód nem található.',
      notFound: true
    }
  }

  const taxRates = row.tax_rates
  const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
  const units = row.units
  const unit = Array.isArray(units) ? units[0] : units

  let onHand = 0
  try {
    onHand = await getAccessoryOnHand(
      supabase,
      user.tenantId,
      row.id,
      warehouseId
    )
  } catch {
    onHand = 0
  }

  return {
    ok: true,
    product: {
      id: row.id,
      name: row.name,
      sku: row.sku,
      price_net: Number(row.price_net) || 0,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db',
      on_hand: onHand,
      image_url: row.image_url ?? null
    }
  }
}
