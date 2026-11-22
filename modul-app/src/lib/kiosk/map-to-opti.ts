import type { KioskEdgeTypeId } from '@/lib/kiosk/edge-types'
import type { EdgeSlot, KioskCartLine } from '@/lib/kiosk/types'
import {
  createPanelDraft,
  type OptiPanelDraft
} from '@/lib/opti/panel-draft'
import { formatEdgeMaterialLabel, type OptiEdgeMaterialOption } from '@/lib/opti/queries'

/** Kiosk slot → Opti A/B/C/D (szál = A/C, kereszt = B/D). */
export function edgeSlotToOptiField(
  slot: EdgeSlot
): 'edgeAId' | 'edgeBId' | 'edgeCId' | 'edgeDId' | 'edgeFerdeId' {
  switch (slot) {
    case 'top':
      return 'edgeAId'
    case 'right':
      return 'edgeBId'
    case 'bottom':
      return 'edgeCId'
    case 'left':
      return 'edgeDId'
    case 'ferde':
      return 'edgeFerdeId'
  }
}

export type KioskPriceLineInput = {
  id: string
  sheetId: string
  grainMm: number
  crossMm: number
  quantity: number
  machining: KioskCartLine['machining']
  /** Él slot → kiosk típus id (foil-04, …) */
  edgeIds: Partial<Record<EdgeSlot, string>>
  /** Vevő megnevezése → quote_panels.label */
  label?: string
}

export function kioskLinesToOptiPanels(input: {
  lines: KioskPriceLineInput[]
  sheetNames: Map<string, string>
  /** típus id → edge_materials.id */
  edgeTypeMap: Partial<Record<KioskEdgeTypeId, string>>
  edgeMaterials: OptiEdgeMaterialOption[]
}): OptiPanelDraft[] {
  const labelById = new Map(
    input.edgeMaterials.map((e) => [e.id, formatEdgeMaterialLabel(e)])
  )

  function resolveType(typeId: string | undefined): {
    id: string | null
    label: string
  } {
    if (!typeId) return { id: null, label: '' }
    const materialId = input.edgeTypeMap[typeId as KioskEdgeTypeId]
    if (!materialId) return { id: null, label: '' }
    return { id: materialId, label: labelById.get(materialId) ?? '' }
  }

  return input.lines.map((line) => {
    const a = resolveType(line.edgeIds.top)
    const b = resolveType(line.edgeIds.right)
    const c = resolveType(line.edgeIds.bottom)
    const d = resolveType(line.edgeIds.left)
    const ferde = resolveType(line.edgeIds.ferde)
    const m = line.machining
    const szog = m.szog

    return createPanelDraft({
      sheetMaterialId: line.sheetId,
      sheetMaterialName: input.sheetNames.get(line.sheetId) ?? 'Lap',
      grainMm: line.grainMm,
      crossMm: line.crossMm,
      quantity: line.quantity,
      marking: line.label ?? '',
      edgeAId: a.id ?? '',
      edgeBId: b.id ?? '',
      edgeCId: c.id ?? '',
      edgeDId: d.id ?? '',
      edgeFerdeId: ferde.id ?? undefined,
      edgeALabel: a.label,
      edgeBLabel: b.label,
      edgeCLabel: c.label,
      edgeDLabel: d.label,
      edgeFerdeLabel: ferde.label || undefined,
      duplungolas: Boolean(m.duplungolas),
      szogvagas: Boolean(szog),
      szogCorners: szog
        ? [
            {
              corner: szog.corner,
              alongGrainMm: szog.alongGrainMm,
              alongCrossMm: szog.alongCrossMm
            }
          ]
        : [],
      panthelyfurasQuantity: m.panthely?.quantity ?? 0,
      panthelyfurasOldal: m.panthely?.oldal ?? null
    })
  })
}
