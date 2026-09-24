import { NextRequest, NextResponse } from 'next/server'

import {
  calculateUsableBoardDimensions,
  guillotineCutting,
  processPanelsForMaterial
} from '@/lib/opti/engine/algorithms'
import type { BinClass } from '@/lib/opti/engine/classes'
import { processBin } from '@/lib/opti/engine/cutCalculations'
import { guillotineCuttingWithLookAhead } from '@/lib/opti/engine/lookahead'
import { guillotineCuttingWithMultiPanelLookAhead } from '@/lib/opti/engine/multiPanelLookAhead'
import { guillotineCuttingEnhanced } from '@/lib/opti/engine/enhancedAlgorithms'
import { guillotineCuttingWithEnsemble } from '@/lib/opti/engine/ensemble'
import type { SortStrategy } from '@/lib/opti/engine/sorting'
import type {
  OptimizationResult,
  Placement,
  UnplacedPart
} from '@/lib/opti/optimization-types'

type OptimizationAlgorithm =
  | 'original'
  | 'lookahead'
  | 'multipanel'
  | 'enhanced'
  | 'ensemble'

export async function POST(request: NextRequest) {
  try {
    const input = await request.json()

    if (!input || !Array.isArray(input.materials)) {
      return NextResponse.json(
        { error: 'Érvénytelen kérés — hiányzik a materials tömb.' },
        { status: 400 }
      )
    }

    const algorithm = (input.algorithm as OptimizationAlgorithm) || 'ensemble'
    const sortStrategy = (input.sortStrategy as SortStrategy) || 'height'

    const results: OptimizationResult[] = []

    for (const materialData of input.materials) {
      const materialId = materialData.id as string
      const materialName = materialData.name as string
      const parts = materialData.parts as Array<{
        id: string
        w_mm: number
        h_mm: number
        qty?: number
        allow_rot_90?: boolean
        grain_locked?: boolean
      }>
      const board = materialData.board as {
        w_mm: number
        h_mm: number
        trim_top_mm?: number
        trim_right_mm?: number
        trim_bottom_mm?: number
        trim_left_mm?: number
      }
      const params = materialData.params as { kerf_mm?: number }

      const grainLocked = Boolean(
        parts.some((p) => p.grain_locked) || materialData.grain_locked
      )

      const panels = processPanelsForMaterial(parts, grainLocked)

      const boardWidth = board.w_mm
      const boardHeight = board.h_mm
      const trimLeft = board.trim_left_mm ?? 0
      const trimRight = board.trim_right_mm ?? 0
      const trimTop = board.trim_top_mm ?? 0
      const trimBottom = board.trim_bottom_mm ?? 0
      const kerfSize = params.kerf_mm ?? 3

      // PHP / main-app parity: swap for usable placement axes
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

      let bins: BinClass[]
      switch (algorithm) {
        case 'ensemble':
          bins = guillotineCuttingWithEnsemble(
            panels,
            usableWidth,
            usableHeight,
            kerfSize,
            sortStrategy
          )
          break
        case 'enhanced':
          bins = guillotineCuttingEnhanced(
            panels,
            usableWidth,
            usableHeight,
            kerfSize,
            sortStrategy
          )
          break
        case 'multipanel':
          bins = guillotineCuttingWithMultiPanelLookAhead(
            panels,
            usableWidth,
            usableHeight,
            kerfSize,
            sortStrategy
          )
          break
        case 'lookahead':
          bins = guillotineCuttingWithLookAhead(
            panels,
            usableWidth,
            usableHeight,
            kerfSize,
            sortStrategy
          )
          break
        default:
          bins = guillotineCutting(
            panels,
            usableWidth,
            usableHeight,
            kerfSize,
            sortStrategy
          )
      }

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
            reason: 'Nincs elég hely'
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

      results.push({
        material_id: materialId,
        material_name: materialName,
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
          panels_count: panels.length
        }
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('optimize', error)
    return NextResponse.json(
      {
        error: 'Az optimalizálás sikertelen.',
        detail: error instanceof Error ? error.message : 'Ismeretlen hiba'
      },
      { status: 500 }
    )
  }
}
