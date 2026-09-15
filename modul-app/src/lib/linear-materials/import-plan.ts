import type { SupabaseClient } from '@supabase/supabase-js'

import {
  coerceLinearExcelRow,
  parseLinearMaterialsWorkbook,
  type CoercedLinearRow
} from '@/lib/linear-materials/excel-workbook'
import { netFromGross, type LinearMaterialType } from '@/lib/linear-materials/parse'

export type LinearImportAction = 'create' | 'update' | 'error'

export type LinearImportPreviewItem = {
  rowNumber: number
  action: LinearImportAction
  name: string
  manufacturerName: string
  sizeLabel: string
  message?: string
  existingId?: string
}

export type LinearImportPreviewResult = {
  items: LinearImportPreviewItem[]
  stats: { create: number; update: number; error: number; total: number }
}

type RefMaps = {
  manufacturers: Map<string, string>
  taxRates: Map<string, { id: string; ratePercent: number }>
  existing: Map<string, { id: string }>
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

function identityKey(
  manufacturerId: string,
  materialType: LinearMaterialType,
  name: string,
  lengthMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  return [
    manufacturerId,
    materialType,
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
  const [mfr, tax, mats] = await Promise.all([
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
      .from('linear_materials')
      .select(
        'id, manufacturer_id, material_type, name, length_mm, width_mm, thickness_mm'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
  ])

  if (mfr.error || tax.error || mats.error) {
    console.error(
      'linear loadRefMaps',
      mfr.error?.message,
      tax.error?.message,
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

  const existing = new Map<string, { id: string }>()
  for (const row of mats.data ?? []) {
    existing.set(
      identityKey(
        row.manufacturer_id,
        row.material_type as LinearMaterialType,
        row.name,
        Number(row.length_mm),
        Number(row.width_mm),
        Number(row.thickness_mm)
      ),
      { id: row.id }
    )
  }

  return { manufacturers, taxRates, existing }
}

type ResolvedRow = {
  rowNumber: number
  action: 'create' | 'update'
  existingId?: string
  payload: {
    manufacturer_id: string
    tax_rate_id: string
    name: string
    material_type: LinearMaterialType
    length_mm: number
    width_mm: number
    thickness_mm: number
    on_stock: boolean
    active: boolean
    price_net: number
  }
  label: {
    name: string
    manufacturerName: string
    sizeLabel: string
  }
}

function resolveRow(
  coerced: Extract<CoercedLinearRow, { ok: true }>,
  refs: RefMaps
): ResolvedRow | LinearImportPreviewItem {
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

  const key = identityKey(
    manufacturerId,
    data.materialType,
    data.name,
    data.lengthMm,
    data.widthMm,
    data.thicknessMm
  )
  const match = refs.existing.get(key)
  const priceNet = netFromGross(data.priceGross, tax.ratePercent)

  return {
    rowNumber: coerced.rowNumber,
    action: match ? 'update' : 'create',
    existingId: match?.id,
    payload: {
      manufacturer_id: manufacturerId,
      tax_rate_id: tax.id,
      name: data.name.trim(),
      material_type: data.materialType,
      length_mm: data.lengthMm,
      width_mm: data.widthMm,
      thickness_mm: data.thicknessMm,
      on_stock: data.onStock,
      active: data.active,
      price_net: priceNet
    },
    label: {
      name: data.name,
      manufacturerName: data.manufacturerName,
      sizeLabel: `${data.materialTypeLabel} · ${data.lengthMm}×${data.widthMm}×${data.thicknessMm}`
    }
  }
}

function isResolved(
  value: ResolvedRow | LinearImportPreviewItem
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
      preview: LinearImportPreviewResult
      resolved: ResolvedRow[]
    }
  | { ok: false; message: string }
> {
  const parsed = await parseLinearMaterialsWorkbook(buffer)
  if (!parsed.ok) return parsed

  const refs = await loadRefMaps(supabase, tenantId)
  if ('error' in refs) return { ok: false, message: refs.error }

  const items: LinearImportPreviewItem[] = []
  const resolved: ResolvedRow[] = []
  const seenKeys = new Set<string>()

  for (const raw of parsed.rows) {
    const coerced = coerceLinearExcelRow(raw)
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
      result.payload.material_type,
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

export async function previewLinearMaterialsImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; preview: LinearImportPreviewResult }
  | { ok: false; message: string }
> {
  const planned = await planImport(supabase, tenantId, buffer)
  if (!planned.ok) return planned
  return { ok: true, preview: planned.preview }
}

export async function applyLinearMaterialsImport(
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
      const { error } = await supabase.from('linear_materials').insert({
        tenant_id: tenantId,
        ...row.payload,
        image_url: null,
        updated_at: now
      })
      if (error) {
        console.error('linear import create', error.message)
        return {
          ok: false,
          message: `Hiba a(z) ${row.rowNumber}. sornál: ${error.message}`
        }
      }
      created += 1
    } else if (row.existingId) {
      const { error } = await supabase
        .from('linear_materials')
        .update({ ...row.payload, updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('id', row.existingId)
        .is('deleted_at', null)
      if (error) {
        console.error('linear import update', error.message)
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
