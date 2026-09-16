import type { SupabaseClient } from '@supabase/supabase-js'

import {
  coerceAccessoryExcelRow,
  parseAccessoriesWorkbook,
  type CoercedAccessoryRow
} from '@/lib/accessories/excel-workbook'
import { netFromGross } from '@/lib/accessories/parse'
import { mapFilenamesToPublicUrls } from '@/lib/media/queries'

export type AccessoryImportAction = 'create' | 'update' | 'error'

export type AccessoryImportPreviewItem = {
  rowNumber: number
  action: AccessoryImportAction
  name: string
  sku: string
  manufacturerName: string
  message?: string
  existingId?: string
}

export type AccessoryImportPreviewResult = {
  items: AccessoryImportPreviewItem[]
  stats: { create: number; update: number; error: number; total: number }
}

type RefMaps = {
  manufacturers: Map<string, string>
  taxRates: Map<string, { id: string; ratePercent: number }>
  unitsByShort: Map<string, string>
  unitsByName: Map<string, string>
  existingBySku: Map<string, string>
  barcodeOwner: Map<string, string>
  barcodeInternalOwner: Map<string, string>
  mediaByFilename: Map<string, string>
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

async function loadRefMaps(
  supabase: SupabaseClient,
  tenantId: string
): Promise<RefMaps | { error: string }> {
  const [mfr, tax, units, rows, mediaByFilename] = await Promise.all([
    supabase
      .from('manufacturers')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('tax_rates')
      .select('id, name, rate_percent')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('units')
      .select('id, name, shortform')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('accessories')
      .select('id, sku, barcode, barcode_internal')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    mapFilenamesToPublicUrls(supabase, tenantId)
  ])

  if (mfr.error || tax.error || units.error || rows.error) {
    console.error(
      'accessories loadRefMaps',
      mfr.error?.message,
      tax.error?.message,
      units.error?.message,
      rows.error?.message
    )
    return { error: 'Nem sikerült betölteni a törzsadatokat az importhoz.' }
  }

  const manufacturers = new Map<string, string>()
  for (const row of mfr.data ?? []) {
    manufacturers.set(normKey(row.name), row.id)
  }

  const taxRates = new Map<string, { id: string; ratePercent: number }>()
  for (const row of tax.data ?? []) {
    taxRates.set(normKey(row.name), {
      id: row.id,
      ratePercent: Number(row.rate_percent)
    })
  }

  const unitsByShort = new Map<string, string>()
  const unitsByName = new Map<string, string>()
  for (const row of units.data ?? []) {
    unitsByShort.set(normKey(row.shortform), row.id)
    unitsByName.set(normKey(row.name), row.id)
  }

  const existingBySku = new Map<string, string>()
  const barcodeOwner = new Map<string, string>()
  const barcodeInternalOwner = new Map<string, string>()
  for (const row of rows.data ?? []) {
    existingBySku.set(normKey(row.sku), row.id)
    if (row.barcode?.trim()) {
      barcodeOwner.set(row.barcode.trim(), row.id)
    }
    if (row.barcode_internal?.trim()) {
      barcodeInternalOwner.set(row.barcode_internal.trim(), row.id)
    }
  }

  return {
    manufacturers,
    taxRates,
    unitsByShort,
    unitsByName,
    existingBySku,
    barcodeOwner,
    barcodeInternalOwner,
    mediaByFilename
  }
}

type ResolvedRow = {
  rowNumber: number
  action: 'create' | 'update'
  existingId?: string
  setImage: boolean
  payload: {
    manufacturer_id: string
    tax_rate_id: string
    unit_id: string
    name: string
    sku: string
    barcode: string | null
    barcode_internal: string | null
    price_net: number
    active: boolean
    image_url?: string | null
  }
  label: {
    name: string
    sku: string
    manufacturerName: string
  }
}

function resolveRow(
  coerced: Extract<CoercedAccessoryRow, { ok: true }>,
  refs: RefMaps
): ResolvedRow | AccessoryImportPreviewItem {
  const data = coerced.data
  const manufacturerId = refs.manufacturers.get(normKey(data.manufacturerName))
  if (!manufacturerId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      sku: data.sku,
      manufacturerName: data.manufacturerName,
      message: `Ismeretlen gyártó: „${data.manufacturerName}”.`
    }
  }

  const tax = refs.taxRates.get(normKey(data.taxRateName))
  if (!tax) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      sku: data.sku,
      manufacturerName: data.manufacturerName,
      message: `Ismeretlen adónem: „${data.taxRateName}”.`
    }
  }

  const unitId =
    refs.unitsByShort.get(normKey(data.unitLabel)) ??
    refs.unitsByName.get(normKey(data.unitLabel))
  if (!unitId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      sku: data.sku,
      manufacturerName: data.manufacturerName,
      message: `Ismeretlen egység: „${data.unitLabel}”.`
    }
  }

  const existingId = refs.existingBySku.get(normKey(data.sku))

  if (data.barcode) {
    const owner = refs.barcodeOwner.get(data.barcode)
    if (owner && owner !== existingId) {
      return {
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: data.name,
        sku: data.sku,
        manufacturerName: data.manufacturerName,
        message: `A vonalkód már foglalt: „${data.barcode}”.`
      }
    }
  }

  if (data.barcodeInternal) {
    const owner = refs.barcodeInternalOwner.get(data.barcodeInternal)
    if (owner && owner !== existingId) {
      return {
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: data.name,
        sku: data.sku,
        manufacturerName: data.manufacturerName,
        message: `A belső vonalkód már foglalt: „${data.barcodeInternal}”.`
      }
    }
  }

  const priceNet = netFromGross(data.priceGross, tax.ratePercent)

  let setImage = false
  let imageUrl: string | null | undefined
  if (data.imageFilename) {
    const url = refs.mediaByFilename.get(data.imageFilename.toLowerCase())
    if (!url) {
      return {
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: data.name,
        sku: data.sku,
        manufacturerName: data.manufacturerName,
        message: `Ismeretlen kép fájlnév: „${data.imageFilename}”. Töltsd fel a Média oldalra.`
      }
    }
    setImage = true
    imageUrl = url
  }

  return {
    rowNumber: coerced.rowNumber,
    action: existingId ? 'update' : 'create',
    existingId,
    setImage,
    payload: {
      manufacturer_id: manufacturerId,
      tax_rate_id: tax.id,
      unit_id: unitId,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      barcode_internal: data.barcodeInternal,
      price_net: priceNet,
      active: data.active,
      ...(setImage ? { image_url: imageUrl } : {})
    },
    label: {
      name: data.name,
      sku: data.sku,
      manufacturerName: data.manufacturerName
    }
  }
}

function isResolved(
  value: ResolvedRow | AccessoryImportPreviewItem
): value is ResolvedRow {
  return value.action === 'create' || value.action === 'update'
}

async function planImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | {
      ok: true
      preview: AccessoryImportPreviewResult
      resolved: ResolvedRow[]
    }
  | { ok: false; message: string }
> {
  const parsed = await parseAccessoriesWorkbook(buffer)
  if (!parsed.ok) return parsed

  const refs = await loadRefMaps(supabase, tenantId)
  if ('error' in refs) return { ok: false, message: refs.error }

  const items: AccessoryImportPreviewItem[] = []
  const resolved: ResolvedRow[] = []
  const seenSkus = new Set<string>()
  const seenBarcodes = new Set<string>()
  const seenInternal = new Set<string>()

  for (const raw of parsed.rows) {
    const coerced = coerceAccessoryExcelRow(raw)
    if (!coerced.ok) {
      items.push({
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: raw.values.Nev || '—',
        sku: raw.values.SKU || '—',
        manufacturerName: raw.values.Gyarto || '—',
        message: coerced.message
      })
      continue
    }

    const skuKey = normKey(coerced.data.sku)
    if (seenSkus.has(skuKey)) {
      items.push({
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: coerced.data.name,
        sku: coerced.data.sku,
        manufacturerName: coerced.data.manufacturerName,
        message: 'Duplikált SKU a fájlban.'
      })
      continue
    }

    if (coerced.data.barcode) {
      if (seenBarcodes.has(coerced.data.barcode)) {
        items.push({
          rowNumber: coerced.rowNumber,
          action: 'error',
          name: coerced.data.name,
          sku: coerced.data.sku,
          manufacturerName: coerced.data.manufacturerName,
          message: 'Duplikált vonalkód a fájlban.'
        })
        continue
      }
      seenBarcodes.add(coerced.data.barcode)
    }

    if (coerced.data.barcodeInternal) {
      if (seenInternal.has(coerced.data.barcodeInternal)) {
        items.push({
          rowNumber: coerced.rowNumber,
          action: 'error',
          name: coerced.data.name,
          sku: coerced.data.sku,
          manufacturerName: coerced.data.manufacturerName,
          message: 'Duplikált belső vonalkód a fájlban.'
        })
        continue
      }
      seenInternal.add(coerced.data.barcodeInternal)
    }

    const result = resolveRow(coerced, refs)
    if (!isResolved(result)) {
      items.push(result)
      continue
    }

    seenSkus.add(skuKey)
    resolved.push(result)
    items.push({
      rowNumber: result.rowNumber,
      action: result.action,
      name: result.label.name,
      sku: result.label.sku,
      manufacturerName: result.label.manufacturerName,
      existingId: result.existingId
    })
  }

  const stats = {
    create: items.filter((i) => i.action === 'create').length,
    update: items.filter((i) => i.action === 'update').length,
    error: items.filter((i) => i.action === 'error').length,
    total: items.length
  }

  return { ok: true, preview: { items, stats }, resolved }
}

export async function previewAccessoriesImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; preview: AccessoryImportPreviewResult }
  | { ok: false; message: string }
> {
  const planned = await planImport(supabase, tenantId, buffer)
  if (!planned.ok) return planned
  return { ok: true, preview: planned.preview }
}

export async function applyAccessoriesImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | {
      ok: true
      results: { created: number; updated: number; skippedErrors: number }
    }
  | { ok: false; message: string }
> {
  const planned = await planImport(supabase, tenantId, buffer)
  if (!planned.ok) return planned

  if (planned.resolved.length === 0) {
    return {
      ok: false,
      message:
        planned.preview.stats.error > 0
          ? 'Nincs importálható érvényes sor. Javítsd a hibákat.'
          : 'Nincs importálható sor.'
    }
  }

  let created = 0
  let updated = 0
  const now = new Date().toISOString()

  for (const row of planned.resolved) {
    if (row.action === 'create') {
      const { error } = await supabase.from('accessories').insert({
        tenant_id: tenantId,
        ...row.payload,
        image_url: row.setImage ? (row.payload.image_url ?? null) : null,
        updated_at: now
      })
      if (error) {
        console.error('accessories import create', error.message)
        return {
          ok: false,
          message: `Hiba a(z) ${row.rowNumber}. sornál: ${error.message}`
        }
      }
      created += 1
    } else if (row.existingId) {
      const { error } = await supabase
        .from('accessories')
        .update({ ...row.payload, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('id', row.existingId)
        .is('deleted_at', null)
      if (error) {
        console.error('accessories import update', error.message)
        return {
          ok: false,
          message: `Hiba a(z) ${row.rowNumber}. sornál: ${error.message}`
        }
      }
      updated += 1
    }
  }

  return {
    ok: true,
    results: {
      created,
      updated,
      skippedErrors: planned.preview.stats.error
    }
  }
}
