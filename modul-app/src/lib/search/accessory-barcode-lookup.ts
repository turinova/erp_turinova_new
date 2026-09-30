import type { SupabaseClient } from '@supabase/supabase-js'

import { looksLikeBarcode, prepareBarcodeQuery } from '@/lib/pos/barcode'
import { normalizeScannerBarcode } from '@/lib/scanner/normalize-wedge'

export type AccessoryBarcodeHit = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
}

export type AccessoryBarcodeLookupResult =
  | { ok: true; product: AccessoryBarcodeHit }
  | { ok: false; message: string; notFound?: boolean }

type Row = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
}

/**
 * Exact match: barcode | barcode_internal | sku
 * (normalized + raw kandidátusok — HU wedge remap).
 */
export async function lookupAccessoryByBarcode(
  supabase: SupabaseClient,
  tenantId: string,
  code: string
): Promise<AccessoryBarcodeLookupResult> {
  const { raw, normalized } = prepareBarcodeQuery(code)
  const candidates = [...new Set([normalized, raw].filter(Boolean))]
  if (candidates.length === 0) {
    return { ok: false, message: 'Üres vonalkód.', notFound: true }
  }

  for (const c of candidates) {
    const safe = c.replace(/[%_,]/g, '')
    if (!safe) continue

    const { data, error } = await supabase
      .from('accessories')
      .select('id, name, sku, barcode, barcode_internal')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(`barcode.eq.${safe},barcode_internal.eq.${safe},sku.eq.${safe}`)
      .limit(5)

    if (error) {
      console.error('lookupAccessoryByBarcode', error.message)
      return { ok: false, message: 'Nem sikerült a vonalkód keresés.' }
    }

    const rows = (data ?? []) as Row[]
    const exact =
      rows.find(
        (r) =>
          r.barcode === safe ||
          r.barcode_internal === safe ||
          r.sku === safe
      ) ?? null

    if (exact) {
      return {
        ok: true,
        product: {
          id: exact.id,
          name: exact.name,
          sku: exact.sku,
          barcode: exact.barcode,
          barcode_internal: exact.barcode_internal
        }
      }
    }
  }

  return {
    ok: false,
    message: 'Vonalkód nem található.',
    notFound: true
  }
}

export { looksLikeBarcode, prepareBarcodeQuery, normalizeScannerBarcode }
