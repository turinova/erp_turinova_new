import type { SupabaseClient } from '@supabase/supabase-js'

import {
  barcodeExactOrFilter,
  barcodeFieldsMatch,
  barcodeLookupCandidates,
  looksLikeBarcode,
  normalizeScannerBarcode,
  prepareBarcodeQuery
} from '@/lib/pos/barcode'

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
 * (barcodeLookupCandidates — HU wedge + UPC-A→EAN-13).
 */
export async function lookupAccessoryByBarcode(
  supabase: SupabaseClient,
  tenantId: string,
  code: string
): Promise<AccessoryBarcodeLookupResult> {
  const candidates = barcodeLookupCandidates(code)
  if (candidates.length === 0) {
    return { ok: false, message: 'Üres vonalkód.', notFound: true }
  }

  for (const safe of candidates) {
    if (!safe) continue

    const { data, error } = await supabase
      .from('accessories')
      .select('id, name, sku, barcode, barcode_internal')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .or(barcodeExactOrFilter(safe))
      .limit(5)

    if (error) {
      console.error('lookupAccessoryByBarcode', error.message)
      return { ok: false, message: 'Nem sikerült a vonalkód keresés.' }
    }

    const rows = (data ?? []) as Row[]
    const exact =
      rows.find(
        (r) =>
          barcodeFieldsMatch(r.barcode, safe) ||
          barcodeFieldsMatch(r.barcode_internal, safe) ||
          barcodeFieldsMatch(r.sku, safe)
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
