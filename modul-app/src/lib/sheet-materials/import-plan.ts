import type { SupabaseClient } from '@supabase/supabase-js'

import { mapFilenamesToPublicUrls } from '@/lib/media/queries'
import {
  coerceSheetExcelRow,
  parseSheetMaterialsWorkbook,
  type CoercedSheetRow
} from '@/lib/sheet-materials/excel-workbook'
import { netFromGross } from '@/lib/sheet-materials/parse'

export type SheetImportAction = 'create' | 'update' | 'error'

export type SheetImportPreviewItem = {
  rowNumber: number
  action: SheetImportAction
  name: string
  manufacturerName: string
  sizeLabel: string
  message?: string
  existingId?: string
}

export type SheetImportPreviewResult = {
  items: SheetImportPreviewItem[]
  stats: { create: number; update: number; error: number; total: number }
}

type RefMaps = {
  manufacturers: Map<string, string>
  taxRates: Map<string, { id: string; ratePercent: number }>
  equipment: Map<string, string>
  existing: Map<
    string,
    { id: string; manufacturerId: string }
  >
  mediaByFilename: Map<string, string>
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

function identityKey(
  manufacturerId: string,
  name: string,
  lengthMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  return [
    manufacturerId,
    normKey(name),
    lengthMm,
    widthMm,
    Number(thicknessMm)
  ].join('|')
}

async function loadRefMaps(
  supabase: SupabaseClient,
  tenantId: string
): Promise<RefMaps | { error: string }> {
  const [mfr, tax, eq, mats, mediaByFilename] = await Promise.all([
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
      .from('equipment')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('sheet_materials')
      .select(
        'id, manufacturer_id, name, length_mm, width_mm, thickness_mm'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    mapFilenamesToPublicUrls(supabase, tenantId)
  ])

  if (mfr.error || tax.error || eq.error || mats.error) {
    console.error(
      'loadRefMaps',
      mfr.error?.message,
      tax.error?.message,
      eq.error?.message,
      mats.error?.message
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

  const equipment = new Map<string, string>()
  for (const row of eq.data ?? []) {
    equipment.set(normKey(row.name), row.id)
  }

  const existing = new Map<string, { id: string; manufacturerId: string }>()
  for (const row of mats.data ?? []) {
    existing.set(
      identityKey(
        row.manufacturer_id,
        row.name,
        Number(row.length_mm),
        Number(row.width_mm),
        Number(row.thickness_mm)
      ),
      { id: row.id, manufacturerId: row.manufacturer_id }
    )
  }

  return { manufacturers, taxRates, equipment, existing, mediaByFilename }
}

type ResolvedRow = {
  rowNumber: number
  action: 'create' | 'update'
  existingId?: string
  setImage: boolean
  payload: {
    manufacturer_id: string
    tax_rate_id: string
    equipment_id: string
    name: string
    length_mm: number
    width_mm: number
    thickness_mm: number
    on_stock: boolean
    active: boolean
    trim_top_mm: number
    trim_right_mm: number
    trim_bottom_mm: number
    trim_left_mm: number
    kerf_mm: number
    waste_multi: number
    usage_limit: number
    grain_direction: boolean
    rotatable: boolean
    price_net: number
    machine_code: string
    image_url?: string | null
  }
  label: {
    name: string
    manufacturerName: string
    sizeLabel: string
  }
}

function resolveRow(
  coerced: Extract<CoercedSheetRow, { ok: true }>,
  refs: RefMaps
): ResolvedRow | SheetImportPreviewItem {
  const data = coerced.data
  const manufacturerId = refs.manufacturers.get(normKey(data.manufacturerName))
  if (!manufacturerId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`,
      message: `Ismeretlen gyártó: „${data.manufacturerName}”.`
    }
  }

  const tax = refs.taxRates.get(normKey(data.taxRateName))
  if (!tax) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`,
      message: `Ismeretlen adónem: „${data.taxRateName}”.`
    }
  }

  const equipmentId = refs.equipment.get(normKey(data.equipmentName))
  if (!equipmentId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`,
      message: `Ismeretlen berendezés: „${data.equipmentName}”.`
    }
  }

  if (data.machineCode.length > 80) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`,
      message: 'A gépkód legfeljebb 80 karakter.'
    }
  }

  const key = identityKey(
    manufacturerId,
    data.name,
    data.lengthMm,
    data.widthMm,
    data.thicknessMm
  )
  const match = refs.existing.get(key)
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
        manufacturerName: data.manufacturerName,
        sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`,
        message: `Ismeretlen kép fájlnév: „${data.imageFilename}”. Töltsd fel a Média oldalra.`
      }
    }
    setImage = true
    imageUrl = url
  }

  return {
    rowNumber: coerced.rowNumber,
    action: match ? 'update' : 'create',
    existingId: match?.id,
    setImage,
    payload: {
      manufacturer_id: manufacturerId,
      tax_rate_id: tax.id,
      equipment_id: equipmentId,
      name: data.name.trim(),
      length_mm: data.lengthMm,
      width_mm: data.widthMm,
      thickness_mm: data.thicknessMm,
      on_stock: data.onStock,
      active: data.active,
      trim_top_mm: data.trimTopMm,
      trim_right_mm: data.trimRightMm,
      trim_bottom_mm: data.trimBottomMm,
      trim_left_mm: data.trimLeftMm,
      kerf_mm: data.kerfMm,
      waste_multi: data.wasteMulti,
      usage_limit: data.usageLimitPercent / 100,
      grain_direction: data.grainDirection,
      rotatable: data.rotatable,
      price_net: priceNet,
      machine_code: data.machineCode,
      ...(setImage ? { image_url: imageUrl } : {})
    },
    label: {
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`
    }
  }
}

function isResolved(
  value: ResolvedRow | SheetImportPreviewItem
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
      preview: SheetImportPreviewResult
      resolved: ResolvedRow[]
    }
  | { ok: false; message: string }
> {
  const parsed = await parseSheetMaterialsWorkbook(buffer)
  if (!parsed.ok) return parsed

  const refs = await loadRefMaps(supabase, tenantId)
  if ('error' in refs) return { ok: false, message: refs.error }

  const items: SheetImportPreviewItem[] = []
  const resolved: ResolvedRow[] = []
  const seenKeys = new Set<string>()

  for (const raw of parsed.rows) {
    const coerced = coerceSheetExcelRow(raw)
    if (!coerced.ok) {
      items.push({
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: raw.values.Nev || '—',
        manufacturerName: raw.values.Gyarto || '—',
        sizeLabel: '—',
        message: coerced.message
      })
      continue
    }

    const result = resolveRow(coerced, refs)
    if (!isResolved(result)) {
      items.push(result)
      continue
    }

    const dupKey = identityKey(
      result.payload.manufacturer_id,
      result.payload.name,
      result.payload.length_mm,
      result.payload.width_mm,
      result.payload.thickness_mm
    )
    if (seenKeys.has(dupKey)) {
      items.push({
        rowNumber: result.rowNumber,
        action: 'error',
        name: result.label.name,
        manufacturerName: result.label.manufacturerName,
        sizeLabel: result.label.sizeLabel,
        message: 'Duplikált sor ugyanarra az anyagra a fájlban.'
      })
      continue
    }
    seenKeys.add(dupKey)

    resolved.push(result)
    items.push({
      rowNumber: result.rowNumber,
      action: result.action,
      name: result.label.name,
      manufacturerName: result.label.manufacturerName,
      sizeLabel: result.label.sizeLabel,
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

export async function previewSheetMaterialsImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; preview: SheetImportPreviewResult }
  | { ok: false; message: string }
> {
  const planned = await planImport(supabase, tenantId, buffer)
  if (!planned.ok) return planned
  return { ok: true, preview: planned.preview }
}

export async function applySheetMaterialsImport(
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
      const { error } = await supabase.from('sheet_materials').insert({
        tenant_id: tenantId,
        ...row.payload,
        image_url: row.setImage ? (row.payload.image_url ?? null) : null,
        updated_at: now
      })
      if (error) {
        console.error('import create', error.message)
        return {
          ok: false,
          message: `Hiba a(z) ${row.rowNumber}. sornál: ${error.message}`
        }
      }
      created += 1
    } else if (row.existingId) {
      const { error } = await supabase
        .from('sheet_materials')
        .update({ ...row.payload, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('id', row.existingId)
        .is('deleted_at', null)
      if (error) {
        console.error('import update', error.message)
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
