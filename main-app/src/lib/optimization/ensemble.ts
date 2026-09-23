/**
 * Ensemble: try multiple sort strategies × algorithms, pick best result.
 * Scoring: more placed → fewer boards → less waste.
 */
import { RectangleClass, type BinClass } from '@/lib/optimization/classes'
import { guillotineCuttingEnhanced } from '@/lib/optimization/enhancedAlgorithms'
import { guillotineCuttingWithMultiPanelLookAhead } from '@/lib/optimization/multiPanelLookAhead'
import {
  sortPanelsByStrategy,
  type SortStrategy
} from '@/lib/optimization/sorting'

function clonePanels(panels: RectangleClass[]): RectangleClass[] {
  return panels.map(
    (p) => new RectangleClass(p.width, p.height, 0, 0, p.rotatable)
  )
}

function scoreBins(
  bins: BinClass[],
  binWidth: number,
  binHeight: number
): { placed: number; boards: number; waste: number } {
  const placed = bins.reduce((sum, b) => sum + b.usedRectangles.length, 0)
  const waste = bins.reduce((sum, bin) => {
    const used = bin.usedRectangles.reduce(
      (s, r) => s + r.width * r.height,
      0
    )
    return sum + (binWidth * binHeight - used)
  }, 0)
  return { placed, boards: bins.length, waste }
}

function isBetter(
  candidate: { placed: number; boards: number; waste: number },
  best: { placed: number; boards: number; waste: number }
): boolean {
  if (candidate.placed > best.placed) return true
  if (candidate.placed < best.placed) return false
  if (candidate.boards < best.boards) return true
  if (candidate.boards > best.boards) return false
  return candidate.waste < best.waste
}

export function guillotineCuttingWithEnsemble(
  rectangles: RectangleClass[],
  binWidth: number,
  binHeight: number,
  kerf: number = 0,
  _preferredSort: SortStrategy = 'height'
): BinClass[] {
  if (rectangles.length === 0) return []

  const sorts: SortStrategy[] = ['height', 'area', 'perimeter', 'width']
  const runners: Array<{
    name: string
    run: (panels: RectangleClass[], sort: SortStrategy) => BinClass[]
  }> = [
    {
      name: 'multipanel',
      run: (panels, sort) =>
        guillotineCuttingWithMultiPanelLookAhead(
          panels,
          binWidth,
          binHeight,
          kerf,
          sort
        )
    },
    {
      name: 'enhanced',
      run: (panels, sort) =>
        guillotineCuttingEnhanced(panels, binWidth, binHeight, kerf, sort)
    }
  ]

  let bestResult: BinClass[] | null = null
  let bestScore = { placed: -1, boards: Infinity, waste: Infinity }
  let bestLabel = ''

  for (const sort of sorts) {
    // Pre-sort once so both runners see same order intent
    const ordered = sortPanelsByStrategy(clonePanels(rectangles), sort)
    for (const runner of runners) {
      const result = runner.run(clonePanels(ordered), sort)
      const score = scoreBins(result, binWidth, binHeight)
      if (isBetter(score, bestScore)) {
        bestScore = score
        bestResult = result
        bestLabel = `${runner.name}/${sort}`
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Ensemble] Best: ${bestLabel} → ${bestScore.boards} boards, ${bestScore.placed} placed`
    )
  }

  return (
    bestResult ||
    guillotineCuttingWithMultiPanelLookAhead(
      clonePanels(rectangles),
      binWidth,
      binHeight,
      kerf,
      'height'
    )
  )
}
