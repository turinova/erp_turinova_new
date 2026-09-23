/**
 * Compare baseline vs candidate optimization results for Opti Lab.
 */
import type { OptimizationResult } from '@/types/optimization'

export type CompareOutcome = 'win' | 'tie' | 'lose'

export type SanityFlag =
  | 'high_waste'
  | 'boards_gt_panels'
  | 'unplaced'
  | 'empty_result'

export type MaterialCompareRow = {
  material_id: string
  material_name: string
  boards_baseline: number
  boards_candidate: number
  delta_boards: number
  waste_baseline: number
  waste_candidate: number
  delta_waste: number
  unplaced_baseline: number
  unplaced_candidate: number
  ms_baseline: number
  ms_candidate: number
  boards_stored: number | null
  outcome: CompareOutcome
  /** Suspicious packing — exclude from “fair” ΣΔ. */
  suspicious: boolean
  sanity_flags: SanityFlag[]
  placements_baseline?: OptimizationResult['placements']
  placements_candidate?: OptimizationResult['placements']
  debug_baseline?: OptimizationResult['debug']
  debug_candidate?: OptimizationResult['debug']
}

export type QuoteCompareResult = {
  quote_id: string
  quote_number: string
  customer_name: string | null
  panel_count: number
  materials: MaterialCompareRow[]
  suspicious: boolean
  totals: {
    boards_baseline: number
    boards_candidate: number
    delta_boards: number
    waste_baseline: number
    waste_candidate: number
    unplaced_baseline: number
    unplaced_candidate: number
    ms_baseline: number
    ms_candidate: number
    boards_stored: number
    outcome: CompareOutcome
  }
}

export type BatchSummary = {
  quotes: number
  materials: number
  win: number
  tie: number
  lose: number
  sum_delta_boards: number
  sum_boards_baseline: number
  sum_boards_candidate: number
  sum_boards_stored: number
  /** Quotes flagged suspicious (high waste / boards≫panels / unplaced). */
  suspicious: number
  /** Outcomes counted only on non-suspicious quotes. */
  fair_quotes: number
  fair_win: number
  fair_tie: number
  fair_lose: number
  fair_sum_delta_boards: number
  fair_sum_boards_baseline: number
  fair_sum_boards_candidate: number
}

export function detectSanityFlags(input: {
  panelCount: number
  boards: number
  wastePct: number
  unplaced: number
  placed: number
}): SanityFlag[] {
  const flags: SanityFlag[] = []
  if (input.wastePct >= 95) flags.push('high_waste')
  if (input.panelCount > 0 && input.boards > input.panelCount) {
    flags.push('boards_gt_panels')
  }
  if (input.unplaced > 0) flags.push('unplaced')
  if (input.boards > 0 && input.placed === 0) flags.push('empty_result')
  return flags
}

export function outcomeForMaterial(
  boardsBaseline: number,
  boardsCandidate: number,
  unplacedBaseline: number,
  unplacedCandidate: number,
  wasteBaseline: number,
  wasteCandidate: number
): CompareOutcome {
  if (unplacedCandidate > unplacedBaseline) return 'lose'
  if (boardsCandidate < boardsBaseline) return 'win'
  if (boardsCandidate > boardsBaseline) return 'lose'
  if (wasteCandidate < wasteBaseline - 0.01) return 'win'
  if (wasteCandidate > wasteBaseline + 0.01) return 'lose'
  return 'tie'
}

export function rollupOutcome(
  rows: { outcome: CompareOutcome }[]
): CompareOutcome {
  if (rows.some((r) => r.outcome === 'lose')) return 'lose'
  if (rows.some((r) => r.outcome === 'win')) return 'win'
  return 'tie'
}

export function summarizeBatch(quotes: QuoteCompareResult[]): BatchSummary {
  let win = 0
  let tie = 0
  let lose = 0
  let materials = 0
  let sum_delta_boards = 0
  let sum_boards_baseline = 0
  let sum_boards_candidate = 0
  let sum_boards_stored = 0
  let suspicious = 0
  let fair_quotes = 0
  let fair_win = 0
  let fair_tie = 0
  let fair_lose = 0
  let fair_sum_delta_boards = 0
  let fair_sum_boards_baseline = 0
  let fair_sum_boards_candidate = 0

  for (const q of quotes) {
    materials += q.materials.length
    sum_delta_boards += q.totals.delta_boards
    sum_boards_baseline += q.totals.boards_baseline
    sum_boards_candidate += q.totals.boards_candidate
    sum_boards_stored += q.totals.boards_stored
    if (q.totals.outcome === 'win') win++
    else if (q.totals.outcome === 'lose') lose++
    else tie++

    if (q.suspicious) {
      suspicious++
    } else {
      fair_quotes++
      fair_sum_delta_boards += q.totals.delta_boards
      fair_sum_boards_baseline += q.totals.boards_baseline
      fair_sum_boards_candidate += q.totals.boards_candidate
      if (q.totals.outcome === 'win') fair_win++
      else if (q.totals.outcome === 'lose') fair_lose++
      else fair_tie++
    }
  }

  return {
    quotes: quotes.length,
    materials,
    win,
    tie,
    lose,
    sum_delta_boards,
    sum_boards_baseline,
    sum_boards_candidate,
    sum_boards_stored,
    suspicious,
    fair_quotes,
    fair_win,
    fair_tie,
    fair_lose,
    fair_sum_delta_boards,
    fair_sum_boards_baseline,
    fair_sum_boards_candidate
  }
}
