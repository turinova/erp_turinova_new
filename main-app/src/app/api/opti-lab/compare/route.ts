import { NextRequest, NextResponse } from 'next/server'
import { buildJobFromQuoteId } from '@/lib/optimization/buildJobFromQuote'
import {
  detectSanityFlags,
  outcomeForMaterial,
  rollupOutcome,
  summarizeBatch,
  type MaterialCompareRow,
  type QuoteCompareResult,
  type SanityFlag
} from '@/lib/optimization/compareScores'
import {
  optimizeMaterial,
  type OptimizationAlgorithm
} from '@/lib/optimization/runOptimize'
import type { SortStrategy } from '@/lib/optimization/sorting'

type EngineSpec = {
  algorithm: OptimizationAlgorithm
  sortStrategy: SortStrategy
}

/**
 * POST /api/opti-lab/compare
 * Body: { quote_ids, baseline?, candidate?, include_placements? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const quoteIds = (body.quote_ids || []) as string[]
    if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json(
        { error: 'quote_ids tömb kötelező' },
        { status: 400 }
      )
    }
    if (quoteIds.length > 100) {
      return NextResponse.json(
        { error: 'Max 100 ajánlat egy kérésben (chunkold).' },
        { status: 400 }
      )
    }

    const baseline: EngineSpec = {
      algorithm:
        (body.baseline?.algorithm as OptimizationAlgorithm) || 'multipanel',
      sortStrategy: (body.baseline?.sortStrategy as SortStrategy) || 'height'
    }
    const candidate: EngineSpec = {
      algorithm:
        (body.candidate?.algorithm as OptimizationAlgorithm) || 'ensemble',
      sortStrategy: (body.candidate?.sortStrategy as SortStrategy) || 'height'
    }
    const includePlacements = Boolean(body.include_placements)

    const quotes: QuoteCompareResult[] = []

    for (const quoteId of quoteIds) {
      const job = await buildJobFromQuoteId(quoteId)
      if (!job) continue

      const storedByMaterial = new Map(
        job.baseline_stored.map((s) => [s.material_id, s])
      )
      const materialRows: MaterialCompareRow[] = []

      for (const material of job.materials) {
        const panelCountForMaterial = material.parts.reduce(
          (s, p) => s + (p.qty ?? 1),
          0
        )

        const t0 = performance.now()
        const baseResult = optimizeMaterial(material, baseline)
        const msBaseline = performance.now() - t0

        const t1 = performance.now()
        const candResult = optimizeMaterial(material, candidate)
        const msCandidate = performance.now() - t1

        const stored = storedByMaterial.get(material.id)
        const boardsBaseline = baseResult.metrics.boards_used
        const boardsCandidate = candResult.metrics.boards_used
        const outcome = outcomeForMaterial(
          boardsBaseline,
          boardsCandidate,
          baseResult.metrics.unplaced_count,
          candResult.metrics.unplaced_count,
          baseResult.metrics.waste_pct,
          candResult.metrics.waste_pct
        )

        const flagsBase = detectSanityFlags({
          panelCount: panelCountForMaterial,
          boards: boardsBaseline,
          wastePct: baseResult.metrics.waste_pct,
          unplaced: baseResult.metrics.unplaced_count,
          placed: baseResult.metrics.placed_count
        })
        const flagsCand = detectSanityFlags({
          panelCount: panelCountForMaterial,
          boards: boardsCandidate,
          wastePct: candResult.metrics.waste_pct,
          unplaced: candResult.metrics.unplaced_count,
          placed: candResult.metrics.placed_count
        })
        const sanity_flags = [
          ...new Set<SanityFlag>([...flagsBase, ...flagsCand])
        ]
        const suspicious = sanity_flags.length > 0

        const row: MaterialCompareRow = {
          material_id: material.id,
          material_name: material.name,
          boards_baseline: boardsBaseline,
          boards_candidate: boardsCandidate,
          delta_boards: boardsCandidate - boardsBaseline,
          waste_baseline: baseResult.metrics.waste_pct,
          waste_candidate: candResult.metrics.waste_pct,
          delta_waste:
            Math.round(
              (candResult.metrics.waste_pct - baseResult.metrics.waste_pct) *
                100
            ) / 100,
          unplaced_baseline: baseResult.metrics.unplaced_count,
          unplaced_candidate: candResult.metrics.unplaced_count,
          ms_baseline: Math.round(msBaseline * 100) / 100,
          ms_candidate: Math.round(msCandidate * 100) / 100,
          boards_stored: stored?.boards_used ?? null,
          outcome,
          suspicious,
          sanity_flags
        }

        if (includePlacements) {
          row.placements_baseline = baseResult.placements
          row.placements_candidate = candResult.placements
          row.debug_baseline = baseResult.debug
          row.debug_candidate = candResult.debug
        }

        materialRows.push(row)
      }

      const boards_baseline = materialRows.reduce(
        (s, r) => s + r.boards_baseline,
        0
      )
      const boards_candidate = materialRows.reduce(
        (s, r) => s + r.boards_candidate,
        0
      )
      const boards_stored = materialRows.reduce(
        (s, r) => s + (r.boards_stored ?? 0),
        0
      )
      const waste_baseline =
        materialRows.length > 0
          ? Math.round(
              (materialRows.reduce((s, r) => s + r.waste_baseline, 0) /
                materialRows.length) *
                100
            ) / 100
          : 0
      const waste_candidate =
        materialRows.length > 0
          ? Math.round(
              (materialRows.reduce((s, r) => s + r.waste_candidate, 0) /
                materialRows.length) *
                100
            ) / 100
          : 0

      const quoteSuspicious =
        materialRows.some((r) => r.suspicious) ||
        (job.panel_count > 0 && boards_baseline > job.panel_count) ||
        waste_baseline >= 95

      quotes.push({
        quote_id: job.quote.id,
        quote_number: job.quote.quote_number,
        customer_name: job.quote.customer_name,
        panel_count: job.panel_count,
        materials: materialRows,
        suspicious: quoteSuspicious,
        totals: {
          boards_baseline,
          boards_candidate,
          delta_boards: boards_candidate - boards_baseline,
          waste_baseline,
          waste_candidate,
          unplaced_baseline: materialRows.reduce(
            (s, r) => s + r.unplaced_baseline,
            0
          ),
          unplaced_candidate: materialRows.reduce(
            (s, r) => s + r.unplaced_candidate,
            0
          ),
          ms_baseline:
            Math.round(
              materialRows.reduce((s, r) => s + r.ms_baseline, 0) * 100
            ) / 100,
          ms_candidate:
            Math.round(
              materialRows.reduce((s, r) => s + r.ms_candidate, 0) * 100
            ) / 100,
          boards_stored,
          outcome: rollupOutcome(materialRows)
        }
      })
    }

    return NextResponse.json({
      baseline,
      candidate,
      quotes,
      summary: summarizeBatch(quotes)
    })
  } catch (error) {
    console.error('opti-lab/compare', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
