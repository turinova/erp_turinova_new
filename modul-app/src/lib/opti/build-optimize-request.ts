import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import type {
  MaterialData,
  OptimizationResult
} from '@/lib/opti/optimization-types'

export type OptiRunResult = {
  materials: OptimizationResult[]
  totalMetrics: {
    total_materials: number
    total_boards: number
    overall_waste_pct: number
    total_placed_count: number
    total_unplaced_count: number
    total_cut_length_mm: number
  }
}

/** Panelek → API materials (main-app Opti parity). */
export function buildOptimizeRequest(
  panels: OptiPanelDraft[],
  sheetMaterials: OptiSheetMaterialOption[]
): { materials: MaterialData[] } {
  const byMaterial = new Map<
    string,
    { material: OptiSheetMaterialOption; panels: OptiPanelDraft[] }
  >()

  for (const panel of panels) {
    const material = sheetMaterials.find((m) => m.id === panel.sheetMaterialId)
    if (!material) continue
    const existing = byMaterial.get(material.id)
    if (existing) existing.panels.push(panel)
    else byMaterial.set(material.id, { material, panels: [panel] })
  }

  const materials: MaterialData[] = []

  for (const { material, panels: group } of byMaterial.values()) {
    const parts = []
    for (const panel of group) {
      for (let i = 0; i < panel.quantity; i++) {
        parts.push({
          id: `${panel.id}-${i + 1}`,
          // main-app: w_mm = szélesség (kereszt), h_mm = hosszúság (szál)
          w_mm: panel.crossMm,
          h_mm: panel.grainMm,
          qty: 1,
          allow_rot_90: material.rotatable && !material.grain_direction,
          grain_locked: material.grain_direction
        })
      }
    }

    materials.push({
      id: material.id,
      name: material.name,
      parts,
      board: {
        w_mm: material.width_mm,
        h_mm: material.length_mm,
        trim_top_mm: material.trim_top_mm,
        trim_right_mm: material.trim_right_mm,
        trim_bottom_mm: material.trim_bottom_mm,
        trim_left_mm: material.trim_left_mm
      },
      params: {
        kerf_mm: material.kerf_mm || 3
      }
    })
  }

  return { materials }
}

export function summarizeOptimizeResults(
  results: OptimizationResult[]
): OptiRunResult {
  let totalBoards = 0
  let totalBoardArea = 0
  let totalUsed = 0
  let placed = 0
  let unplaced = 0
  let cut = 0

  for (const r of results) {
    totalBoards += r.metrics.boards_used
    totalBoardArea += r.metrics.board_area_mm2
    totalUsed += r.metrics.used_area_mm2
    placed += r.metrics.placed_count
    unplaced += r.metrics.unplaced_count
    cut += r.metrics.total_cut_length_mm
  }

  return {
    materials: results,
    totalMetrics: {
      total_materials: results.length,
      total_boards: totalBoards,
      overall_waste_pct:
        totalBoardArea > 0
          ? Math.round(
              ((totalBoardArea - totalUsed) / totalBoardArea) * 10000
            ) / 100
          : 0,
      total_placed_count: placed,
      total_unplaced_count: unplaced,
      total_cut_length_mm: cut
    }
  }
}
