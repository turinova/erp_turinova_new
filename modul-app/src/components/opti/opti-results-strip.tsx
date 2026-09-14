'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'

import { BoardBlueprint } from '@/components/opti/board-blueprint'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import type { OptiRunResult } from '@/lib/opti/build-optimize-request'
import type {
  OptimizationResult,
  Placement
} from '@/lib/opti/optimization-types'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import { cn } from '@/lib/utils'

export function OptiResultsStrip({
  result,
  sheetMaterials
}: {
  result: OptiRunResult
  sheetMaterials: OptiSheetMaterialOption[]
}) {
  const { materials } = result
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [boardIndexByMaterial, setBoardIndexByMaterial] = useState<
    Record<string, number>
  >({})

  useEffect(() => {
    const next: Record<string, number> = {}
    for (const m of materials) {
      next[m.material_id] = 0
    }
    setBoardIndexByMaterial(next)
    setExpanded(new Set())
  }, [materials])

  function toggle(materialId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(materialId)) next.delete(materialId)
      else next.add(materialId)
      return next
    })
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border border-l-[3px] border-l-ink bg-surface">
      <header className="border-b border-border bg-subtle px-3 py-2.5">
        <h2 className="text-h3 text-ink">1. Lapszabászat</h2>
        <p className="mt-0.5 text-hint text-ink-secondary">
          Vágási rajz — melyik táblán hol vannak a panelek. Nyisd ki az anyagot
          a rajzhoz.
        </p>
      </header>

      <div>
        {materials.map((materialResult, index) => {
          const sheet =
            sheetMaterials.find((s) => s.id === materialResult.material_id) ??
            null
          const isOpen = expanded.has(materialResult.material_id)
          const isLast = index === materials.length - 1

          return (
            <MaterialAccordion
              key={materialResult.material_id}
              materialResult={materialResult}
              sheet={sheet}
              isOpen={isOpen}
              isLast={isLast}
              boardIndex={boardIndexByMaterial[materialResult.material_id] ?? 0}
              onToggle={() => toggle(materialResult.material_id)}
              onBoardIndexChange={(pageZero) =>
                setBoardIndexByMaterial((prev) => ({
                  ...prev,
                  [materialResult.material_id]: pageZero
                }))
              }
            />
          )
        })}
      </div>
    </section>
  )
}

function MaterialAccordion({
  materialResult,
  sheet,
  isOpen,
  isLast,
  boardIndex,
  onToggle,
  onBoardIndexChange
}: {
  materialResult: OptimizationResult
  sheet: OptiSheetMaterialOption | null
  isOpen: boolean
  isLast: boolean
  boardIndex: number
  onToggle: () => void
  onBoardIndexChange: (pageZero: number) => void
}) {
  const placementsByBoard = useMemo(() => {
    const map = new Map<number, Placement[]>()
    for (const placement of materialResult.placements) {
      const boardId = placement.board_id || 1
      const list = map.get(boardId)
      if (list) list.push(placement)
      else map.set(boardId, [placement])
    }
    return map
  }, [materialResult.placements])

  const boardIds = useMemo(
    () => Array.from(placementsByBoard.keys()).sort((a, b) => a - b),
    [placementsByBoard]
  )

  const currentBoardId = boardIds[boardIndex] ?? boardIds[0] ?? 1
  const currentPlacements = placementsByBoard.get(currentBoardId) ?? []

  const boardW = materialResult.debug?.board_width || sheet?.width_mm || 1
  const boardH = materialResult.debug?.board_height || sheet?.length_mm || 1

  const panelId = `opti-material-${materialResult.material_id}`

  return (
    <div className={cn('bg-surface', !isLast && 'border-b border-border')}>
      <button
        type="button"
        id={`${panelId}-header`}
        aria-expanded={isOpen}
        aria-controls={`${panelId}-content`}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-subtle/80"
      >
        <span className="shrink-0 text-ink-secondary" aria-hidden>
          {isOpen ? (
            <Minus className="size-4" strokeWidth={2} />
          ) : (
            <Plus className="size-4" strokeWidth={2} />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">
          {materialResult.material_name}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {sheet ? (
            <StatusBadge tone="info">
              {sheet.length_mm}×{sheet.width_mm}mm
            </StatusBadge>
          ) : null}
          {materialResult.metrics.unplaced_count > 0 ? (
            <StatusBadge tone="danger">
              {materialResult.metrics.unplaced_count} kimaradt
            </StatusBadge>
          ) : null}
          <StatusBadge tone="neutral">
            {materialResult.metrics.boards_used} tábla
          </StatusBadge>
          <StatusBadge tone="neutral">
            {(materialResult.metrics.total_cut_length_mm / 1000).toFixed(1)} m
            vágás
          </StatusBadge>
        </span>
      </button>

      {isOpen ? (
        <div
          id={`${panelId}-content`}
          role="region"
          aria-labelledby={`${panelId}-header`}
          className="border-t border-border bg-white p-4"
        >
          {currentPlacements.length > 0 ? (
            <BoardBlueprint
              boardWidth={boardW}
              boardHeight={boardH}
              placements={currentPlacements}
              material={sheet}
            />
          ) : null}

          {boardIds.length > 1 ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {boardIds.map((id, i) => {
                const active = i === boardIndex
                return (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onBoardIndexChange(i)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'min-w-8 tabular-nums',
                      active &&
                        'border-ink bg-subtle font-semibold text-ink ring-1 ring-ink'
                    )}
                  >
                    {i + 1}
                  </Button>
                )
              })}
            </div>
          ) : null}

          {materialResult.placements.length === 0 ? (
            <p className="py-8 text-center text-body text-ink-secondary">
              Ezen az anyagon egy panel sem fért el.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
