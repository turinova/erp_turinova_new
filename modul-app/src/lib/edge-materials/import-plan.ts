import type { SupabaseClient } from '@supabase/supabase-js'

import {
  coerceEdgeExcelRow,
  parseEdgeMaterialsWorkbook,
  type CoercedEdgeRow
} from '@/lib/edge-materials/excel-workbook'
import { netFromGross } from '@/lib/edge-materials/parse'

export type EdgeImportAction = 'create' | 'update' | 'error'

export type EdgeImportPreviewItem = {
  rowNumber: number
  action: EdgeImportAction
  name: string
  manufacturerName: string
  sizeLabel: string
  message?: string
  existingId?: string
}

export type EdgeImportPreviewResult = {
  items: EdgeImportPreviewItem[]
  stats: { create: number; update: number; error: number; total: number }
}

type RefMaps = {
  manufacturers: Map<string, string>
  taxRates: Map<string, { id: string; ratePercent: number }>
  equipment: Map<string, string>
  existing: Map<string, { id: string; manufacturerId: string }>
}

function normKey(value: string): string {
  return value.trim().toLowerCase()
}

function identityKey(
  manufacturerId: string,
  type: string,
  decor: string,
  widthMm: number,
  thicknessMm: number
): string {
  return [
    manufacturerId,
    normKey(type),
    normKey(decor),
    Number(widthMm),
    Number(thicknessMm)
  ].join('|')
}

async function loadRefMaps(
  supabase: SupabaseClient,
  tenantId: string
): Promise<RefMaps | { error: string }> {
  const [mfr, tax, eq, mats] = await Promise.all([
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
      .from('edge_materials')
      .select(
        'id, manufacturer_id, type, decor, width_mm, thickness_mm'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
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
        row.type,
        row.decor,
        Number(row.width_mm),
        Number(row.thickness_mm)
      ),
      { id: row.id, manufacturerId: row.manufacturer_id }
    )
  }

  return { manufacturers, taxRates, equipment, existing }
}

type ResolvedRow = {
  rowNumber: number
  action: 'create' | 'update'
  existingId?: string
  payload: {
    manufacturer_id: string
    tax_rate_id: string
    equipment_id: string
    type: string
    decor: string
    width_mm: number
    thickness_mm: number
    price_net: number
    allowance_mm: number
    favourite_priority: number | null
    active: boolean
    machine_code: string
  }
  label: {
    name: string
    manufacturerName: string
    sizeLabel: string
  }
}

function resolveRow(
  coerced: Extract<CoercedEdgeRow, { ok: true }>,
  refs: RefMaps
): ResolvedRow | EdgeImportPreviewItem {
  const data = coerced.data
  const labelName = `${data.decor} / ${data.type}`
  const sizeLabel = `${data.widthMm}×${data.thicknessMm}`

  const manufacturerId = refs.manufacturers.get(normKey(data.manufacturerName))
  if (!manufacturerId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: labelName,
      manufacturerName: data.manufacturerName,
      sizeLabel,
      message: `Ismeretlen gyártó: „${data.manufacturerName}”.`
    }
  }

  const tax = refs.taxRates.get(normKey(data.taxRateName))
  if (!tax) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: labelName,
      manufacturerName: data.manufacturerName,
      sizeLabel,
      message: `Ismeretlen adónem: „${data.taxRateName}”.`
    }
  }

  const equipmentId = refs.equipment.get(normKey(data.equipmentName))
  if (!equipmentId) {
    return {
      rowNumber: coerced.rowNumber,
      action: 'error',
      name: labelName,
      manufacturerName: data.manufacturerName,
      sizeLabel,
      message: `Ismeretlen berendezés: „${data.equipmentName}”.`
    }
  }

  const key = identityKey(
    manufacturerId,
    data.type,
    data.decor,
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
      equipment_id: equipmentId,
      type: data.type,
      decor: data.decor,
      width_mm: data.widthMm,
      thickness_mm: data.thicknessMm,
      price_net: priceNet,
      allowance_mm: data.allowanceMm,
      favourite_priority: data.favouritePriority,
      active: data.active,
      machine_code: data.machineCode
    },
    label: {
      name: labelName,
      manufacturerName: data.manufacturerName,
      sizeLabel
    }
  }
}

function isResolved(
  value: ResolvedRow | EdgeImportPreviewItem
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
      preview: EdgeImportPreviewResult
      resolved: ResolvedRow[]
    }
  | { ok: false; message: string }
> {
  const parsed = await parseEdgeMaterialsWorkbook(buffer)
  if (!parsed.ok) return parsed

  const refs = await loadRefMaps(supabase, tenantId)
  if ('error' in refs) return { ok: false, message: refs.error }

  const items: EdgeImportPreviewItem[] = []
  const resolved: ResolvedRow[] = []
  const seenKeys = new Set<string>()

  for (const raw of parsed.rows) {
    const coerced = coerceEdgeExcelRow(raw)
    if (!coerced.ok) {
      items.push({
        rowNumber: coerced.rowNumber,
        action: 'error',
        name: raw.values.Dekor || raw.values.Tipus || '—',
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
      result.payload.type,
      result.payload.decor,
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
        message: 'Duplikált sor ugyanarra az élzáróra a fájlban.'
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

export async function previewEdgeMaterialsImport(
  supabase: SupabaseClient,
  tenantId: string,
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; preview: EdgeImportPreviewResult }
  | { ok: false; message: string }
> {
  const planned = await planImport(supabase, tenantId, buffer)
  if (!planned.ok) return planned
  return { ok: true, preview: planned.preview }
}

export async function applyEdgeMaterialsImport(
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
      const { error } = await supabase.from('edge_materials').insert({
        tenant_id: tenantId,
        ...row.payload,
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
        .from('edge_materials')
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
