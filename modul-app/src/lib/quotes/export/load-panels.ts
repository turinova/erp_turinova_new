import type { SupabaseClient } from '@supabase/supabase-js'

import {
  isExportFormat,
  type QuoteExportPanel,
  type QuoteExportTarget
} from '@/lib/quotes/export/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

type EdgeRef =
  | { machine_code: string | null }
  | { machine_code: string | null }[]
  | null

function edgeCode(ref: EdgeRef): string | null {
  const row = one(ref)
  const code = row?.machine_code?.trim()
  return code || null
}

export type QuoteExportLoad = {
  quoteNumber: string
  panels: QuoteExportPanel[]
  targets: QuoteExportTarget[]
}

/** Load panels + group by sheet equipment for Excel export picker. */
export async function loadQuoteExportData(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<QuoteExportLoad | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      quote_number,
      quote_panels (
        id,
        sheet_material_id,
        grain_mm,
        cross_mm,
        quantity,
        label,
        sort_index,
        sheet_materials (
          machine_code,
          grain_direction,
          equipment_id,
          equipment ( id, name, export_format, deleted_at )
        ),
        edge_a:edge_materials!quote_panels_edge_a_id_fkey ( machine_code ),
        edge_b:edge_materials!quote_panels_edge_b_id_fkey ( machine_code ),
        edge_c:edge_materials!quote_panels_edge_c_id_fkey ( machine_code ),
        edge_d:edge_materials!quote_panels_edge_d_id_fkey ( machine_code )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('loadQuoteExportData', error.message)
    throw new Error('Nem sikerült betölteni az export adatokat.')
  }
  if (!data) return null

  const panelsRaw = (data.quote_panels ?? []) as Array<{
    id: string
    sheet_material_id: string
    grain_mm: number
    cross_mm: number
    quantity: number
    label: string | null
    sort_index: number
    sheet_materials:
      | {
          machine_code: string | null
          grain_direction: boolean
          equipment_id: string
          equipment:
            | {
                id: string
                name: string
                export_format: string
                deleted_at: string | null
              }
            | {
                id: string
                name: string
                export_format: string
                deleted_at: string | null
              }[]
            | null
        }
      | {
          machine_code: string | null
          grain_direction: boolean
          equipment_id: string
          equipment:
            | {
                id: string
                name: string
                export_format: string
                deleted_at: string | null
              }
            | {
                id: string
                name: string
                export_format: string
                deleted_at: string | null
              }[]
            | null
        }[]
      | null
    edge_a: EdgeRef
    edge_b: EdgeRef
    edge_c: EdgeRef
    edge_d: EdgeRef
  }>

  const panels: QuoteExportPanel[] = [...panelsRaw]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((p) => {
      const sheet = one(p.sheet_materials)
      const equipment = one(sheet?.equipment ?? null)
      return {
        id: p.id,
        sheetMaterialId: p.sheet_material_id,
        equipmentId: equipment?.id ?? sheet?.equipment_id ?? '',
        machineCode: sheet?.machine_code?.trim() || '',
        grainMm: Number(p.grain_mm),
        crossMm: Number(p.cross_mm),
        quantity: Number(p.quantity) || 0,
        label: p.label,
        grainDirection: Boolean(sheet?.grain_direction),
        edgeACode: edgeCode(p.edge_a),
        edgeBCode: edgeCode(p.edge_b),
        edgeCCode: edgeCode(p.edge_c),
        edgeDCode: edgeCode(p.edge_d)
      }
    })
    .filter((p) => p.equipmentId)

  const byEquipment = new Map<
    string,
    {
      equipmentId: string
      equipmentName: string
      exportFormat: string
      panelCount: number
      missingMachineCodeCount: number
      isDeleted: boolean
    }
  >()

  for (const panel of panels) {
    const sheet = one(
      panelsRaw.find((r) => r.id === panel.id)?.sheet_materials ?? null
    )
    const equipment = one(sheet?.equipment ?? null)
    const format = equipment?.export_format ?? 'korpus'
    const isDeleted = Boolean(equipment?.deleted_at)
    const existing = byEquipment.get(panel.equipmentId)
    if (existing) {
      existing.panelCount += 1
      if (!panel.machineCode) existing.missingMachineCodeCount += 1
    } else {
      byEquipment.set(panel.equipmentId, {
        equipmentId: panel.equipmentId,
        equipmentName: isDeleted
          ? `(törölt) ${equipment?.name ?? 'Berendezés'}`
          : (equipment?.name ?? 'Berendezés'),
        exportFormat: format,
        panelCount: 1,
        missingMachineCodeCount: panel.machineCode ? 0 : 1,
        isDeleted
      })
    }
  }

  const targets: QuoteExportTarget[] = Array.from(byEquipment.values())
    .map((t) => ({
      equipmentId: t.equipmentId,
      equipmentName: t.equipmentName,
      exportFormat: isExportFormat(t.exportFormat) ? t.exportFormat : 'korpus',
      panelCount: t.panelCount,
      missingMachineCodeCount: t.missingMachineCodeCount,
      isDeleted: t.isDeleted
    }))
    .sort((a, b) => a.equipmentName.localeCompare(b.equipmentName, 'hu'))

  return {
    quoteNumber: data.quote_number,
    panels,
    targets
  }
}

export function panelsForEquipment(
  panels: QuoteExportPanel[],
  equipmentId: string
): QuoteExportPanel[] {
  return panels.filter((p) => p.equipmentId === equipmentId)
}
