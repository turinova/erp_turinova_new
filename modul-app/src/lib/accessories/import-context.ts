import type { SupabaseClient } from '@supabase/supabase-js'

import { mapFilenamesToPublicUrls } from '@/lib/media/queries'
import { fetchAllPages } from '@/lib/supabase/fetch-all'

/** Felső korlát a tenant összes termékére; ennél több esetén háttér-import kell. */
const MAX_PRODUCTS = 50000
const MAX_REF_ROWS = 20000

export type ImportManufacturer = { id: string; name: string }
export type ImportTaxRate = { id: string; name: string; ratePercent: number }
export type ImportUnit = { id: string; name: string; shortform: string }

export type ImportExisting = {
  id: string
  sku: string
  name: string
  barcode: string | null
  barcode_internal: string | null
  manufacturer_id: string
  tax_rate_id: string
  unit_id: string
  price_net: number
  purchase_price_net: number | null
  margin_factor: number | null
  active: boolean
  image_url: string | null
  web_gallery: string[]
}

export type AccessoryImportContext = {
  manufacturers: ImportManufacturer[]
  taxRates: ImportTaxRate[]
  units: ImportUnit[]
  existing: ImportExisting[]
  deletedSkus: Set<string>
  mediaByFilename: Map<string, string>
}

export const EXISTING_COLUMNS =
  'id, sku, name, barcode, barcode_internal, manufacturer_id, tax_rate_id, unit_id, price_net, purchase_price_net, margin_factor, active, image_url, web_gallery'

export function skuKey(sku: string): string {
  return sku.trim().toLowerCase()
}

export async function loadAccessoryImportContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true; ctx: AccessoryImportContext } | { ok: false; message: string }> {
  const [mfr, tax, units, existing, deleted, mediaByFilename] = await Promise.all([
    fetchAllPages<ImportManufacturer>(
      (from, to) =>
        supabase
          .from('manufacturers')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_REF_ROWS
    ),
    fetchAllPages<{ id: string; name: string; rate_percent: number | string }>(
      (from, to) =>
        supabase
          .from('tax_rates')
          .select('id, name, rate_percent')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_REF_ROWS
    ),
    fetchAllPages<ImportUnit>(
      (from, to) =>
        supabase
          .from('units')
          .select('id, name, shortform')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_REF_ROWS
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessories')
          .select(EXISTING_COLUMNS)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_PRODUCTS
    ),
    fetchAllPages<{ sku: string }>(
      (from, to) =>
        supabase
          .from('accessories')
          .select('sku')
          .eq('tenant_id', tenantId)
          .not('deleted_at', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_PRODUCTS
    ),
    mapFilenamesToPublicUrls(supabase, tenantId)
  ])

  const failed = [mfr, tax, units, existing, deleted].find((r) => r.error)
  if (failed) {
    console.error('loadAccessoryImportContext', failed.error)
    return { ok: false, message: 'Nem sikerült betölteni a meglévő adatokat. Próbáld újra.' }
  }
  if (existing.data.length >= MAX_PRODUCTS) {
    return {
      ok: false,
      message: `Ennél a cégnél több mint ${MAX_PRODUCTS.toLocaleString('hu-HU')} termék van — az Excel import ehhez nem elég. Szólj nekünk.`
    }
  }

  return {
    ok: true,
    ctx: {
      manufacturers: mfr.data,
      taxRates: tax.data.map((t) => ({ id: t.id, name: t.name, ratePercent: Number(t.rate_percent) })),
      units: units.data,
      existing: existing.data.map((r) => ({
        id: String(r.id),
        sku: String(r.sku),
        name: String(r.name),
        barcode: (r.barcode as string | null) ?? null,
        barcode_internal: (r.barcode_internal as string | null) ?? null,
        manufacturer_id: String(r.manufacturer_id),
        tax_rate_id: String(r.tax_rate_id),
        unit_id: String(r.unit_id),
        price_net: Number(r.price_net),
        purchase_price_net: r.purchase_price_net == null ? null : Number(r.purchase_price_net),
        margin_factor: r.margin_factor == null ? null : Number(r.margin_factor),
        active: r.active === true,
        image_url: (r.image_url as string | null) ?? null,
        web_gallery: Array.isArray(r.web_gallery)
          ? (r.web_gallery as unknown[]).filter((u): u is string => typeof u === 'string')
          : []
      })),
      deletedSkus: new Set(deleted.data.map((d) => skuKey(d.sku))),
      mediaByFilename
    }
  }
}
