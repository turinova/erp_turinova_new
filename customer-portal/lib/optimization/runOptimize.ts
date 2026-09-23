/**
 * Shared optimization runner — used by /api/optimize and Opti Lab.
 */
import {
  calculateUsableBoardDimensions,
  guillotineCutting,
  processPanelsForMaterial
} from '@/lib/optimization/algorithms'
import { RectangleClass, type BinClass } from '@/lib/optimization/classes'
import { processBin } from '@/lib/optimization/cutCalculations'
import { guillotineCuttingEnhanced } from '@/lib/optimization/enhancedAlgorithms'
import { guillotineCuttingWithEnsemble } from '@/lib/optimization/ensemble'
import { guillotineCuttingWithLookAhead } from '@/lib/optimization/lookahead'
import { guillotineCuttingWithMultiPanelLookAhead } from '@/lib/optimization/multiPanelLookAhead'
import type { SortStrategy } from '@/lib/optimization/sorting'
import type {
  MaterialData,
  OptimizationResult,
  Placement,
  UnplacedPart
} from '@/types/optimization'

export type OptimizationAlgorithm =
  | 'original'
  | 'lookahead'
  | 'multipanel'
  | 'enhanced'
  | 'ensemble'

export type RunOptimizeOptions = {
  algorithm?: OptimizationAlgorithm
  sortStrategy?: SortStrategy
}

function clonePanels(panels: RectangleClass[]): RectangleClass[] {
  return panels.map(
    (p) => new RectangleClass(p.width, p.height, 0, 0, p.rotatable)
  )
}

function placeBins(
  algorithm: OptimizationAlgorithm,
  panels: RectangleClass[],
  usableWidth: number,
  usableHeight: number,
  kerfSize: number,
  sortStrategy: SortStrategy
): BinClass[] {
  const working = clonePanels(panels)

  switch (algorithm) {
    case 'ensemble':
      return guillotineCuttingWithEnsemble(
        working,
        usableWidth,
        usableHeight,
        kerfSize,
        sortStrategy
      )
    case 'enhanced':
      return guillotineCuttingEnhanced(
        working,
        usableWidth,
        usableHeight,
        kerfSize,
        sortStrategy
      )
    case 'multipanel':
      return guillotineCuttingWithMultiPanelLookAhead(
        working,
        usableWidth,
        usableHeight,
        kerfSize,
        sortStrategy
      )
    case 'lookahead':
      return guillotineCuttingWithLookAhead(
        working,
        usableWidth,
        usableHeight,
        kerfSize,
        sortStrategy
      )
    case 'original':
    default:
      return guillotineCutting(
        working,
        usableWidth,
        usableHeight,
        kerfSize,
        sortStrategy
      )
  }
}

function binsToResult(
  materialData: MaterialData,
  bins: BinClass[],
  boardWidthSwapped: number,
  boardHeightSwapped: number,
  usableWidth: number,
  usableHeight: number,
  trimLeft: number,
  trimRight: number,
  trimTop: number,
  trimBottom: number,
  panelsCount: number
): OptimizationResult {
  const parts = materialData.parts
  const placements: Placement[] = []
  const unplaced: UnplacedPart[] = []
  const placedPanelIds: string[] = []
  const boardCutLengths: Record<number, number> = {}

  for (let binIndex = 0; binIndex < bins.length; binIndex++) {
    const bin = bins[binIndex]
    boardCutLengths[binIndex + 1] = processBin(
      bin,
      trimLeft,
      trimRight,
      trimTop,
      trimBottom
    )

    for (const rect of bin.usedRectangles) {
      let originalPanel: (typeof parts)[number] | null = null

      for (const part of parts) {
        const quantity = part.qty ?? 1
        if (
          (part.h_mm === rect.width && part.w_mm === rect.height) ||
          (part.h_mm === rect.height && part.w_mm === rect.width)
        ) {
          let alreadyPlacedCount = 0
          for (const placedId of placedPanelIds) {
            if (placedId.startsWith(part.id)) alreadyPlacedCount++
          }
          if (alreadyPlacedCount < quantity) {
            originalPanel = part
            break
          }
        }
      }

      if (originalPanel) {
        let instanceNumber = 1
        for (const placedId of placedPanelIds) {
          if (placedId.startsWith(originalPanel.id)) instanceNumber++
        }
        const id = `${originalPanel.id}-${instanceNumber}`
        placements.push({
          id,
          x_mm: rect.x + trimLeft,
          y_mm: rect.y + trimTop,
          w_mm: rect.width,
          h_mm: rect.height,
          rot_deg: 0,
          board_id: binIndex + 1
        })
        placedPanelIds.push(id)
      }
    }
  }

  for (const part of parts) {
    const quantity = part.qty ?? 1
    let placedCount = 0
    for (const placedId of placedPanelIds) {
      if (placedId.startsWith(part.id)) placedCount++
    }
    for (let j = placedCount; j < quantity; j++) {
      unplaced.push({
        id: `${part.id}-${j + 1}`,
        w_mm: part.w_mm,
        h_mm: part.h_mm,
        reason: 'No space available'
      })
    }
  }

  let totalUsedArea = 0
  for (const placement of placements) {
    totalUsedArea += placement.w_mm * placement.h_mm
  }

  const boardArea = boardWidthSwapped * boardHeightSwapped
  const totalBoardArea = boardArea * Math.max(bins.length, 0)
  const wastePercentage =
    totalBoardArea > 0
      ? ((totalBoardArea - totalUsedArea) / totalBoardArea) * 100
      : 0
  const totalCutLength = Object.values(boardCutLengths).reduce(
    (sum, length) => sum + length,
    0
  )

  return {
    material_id: materialData.id,
    material_name: materialData.name,
    placements,
    unplaced,
    metrics: {
      used_area_mm2: totalUsedArea,
      board_area_mm2: totalBoardArea,
      waste_pct: Math.round(wastePercentage * 100) / 100,
      placed_count: placements.length,
      unplaced_count: unplaced.length,
      boards_used: bins.length,
      total_cut_length_mm: totalCutLength
    },
    board_cut_lengths: boardCutLengths,
    debug: {
      board_width: boardWidthSwapped,
      board_height: boardHeightSwapped,
      usable_width: usableWidth,
      usable_height: usableHeight,
      bins_count: bins.length,
      panels_count: panelsCount
    }
  }
}

/** Optimize a single material payload. */
export function optimizeMaterial(
  materialData: MaterialData,
  options: RunOptimizeOptions = {}
): OptimizationResult {
  const algorithm = options.algorithm ?? 'ensemble'
  const sortStrategy = options.sortStrategy ?? 'height'

  const grainLocked = Boolean(
    materialData.parts.some((p) => p.grain_locked) ||
      (materialData as MaterialData & { grain_locked?: boolean }).grain_locked
  )

  const panels = processPanelsForMaterial(materialData.parts, grainLocked)

  const board = materialData.board
  const boardWidth = board.w_mm
  const boardHeight = board.h_mm
  const trimLeft = board.trim_left_mm ?? 0
  const trimRight = board.trim_right_mm ?? 0
  const trimTop = board.trim_top_mm ?? 0
  const trimBottom = board.trim_bottom_mm ?? 0
  const kerfSize = materialData.params.kerf_mm ?? 3

  // PHP / Opti parity: swap axes for usable placement
  const boardWidthSwapped = boardHeight
  const boardHeightSwapped = boardWidth

  const { usableWidth, usableHeight } = calculateUsableBoardDimensions(
    boardWidthSwapped,
    boardHeightSwapped,
    trimLeft,
    trimRight,
    trimTop,
    trimBottom
  )

  const bins = placeBins(
    algorithm,
    panels,
    usableWidth,
    usableHeight,
    kerfSize,
    sortStrategy
  )

  return binsToResult(
    materialData,
    bins,
    boardWidthSwapped,
    boardHeightSwapped,
    usableWidth,
    usableHeight,
    trimLeft,
    trimRight,
    trimTop,
    trimBottom,
    panels.length
  )
}

/** Optimize all materials in a request. */
export function optimizeMaterials(
  materials: MaterialData[],
  options: RunOptimizeOptions = {}
): OptimizationResult[] {
  return materials.map((m) => optimizeMaterial(m, options))
}
