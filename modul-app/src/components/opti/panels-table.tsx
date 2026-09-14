'use client'

import { useMemo } from 'react'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { Button } from '@/components/ui/button'
import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import { cn } from '@/lib/utils'

export function PanelsTable({
  panels,
  editingPanelId,
  onEdit,
  onDelete
}: {
  panels: OptiPanelDraft[]
  editingPanelId: string | null
  onEdit: (panel: OptiPanelDraft) => void
  onDelete: (panel: OptiPanelDraft) => void
}) {
  const totalPieces = panels.reduce((sum, p) => sum + p.quantity, 0)

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { materialId: string; materialName: string; rows: OptiPanelDraft[] }
    >()
    for (const panel of panels) {
      const existing = map.get(panel.sheetMaterialId)
      if (existing) {
        existing.rows.push(panel)
      } else {
        map.set(panel.sheetMaterialId, {
          materialId: panel.sheetMaterialId,
          materialName: panel.sheetMaterialName,
          rows: [panel]
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName, 'hu')
    )
  }, [panels])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 text-ink">Hozzáadott panelek</h2>
        <p className="text-hint text-ink-secondary">
          {panels.length} panel · {totalPieces} darab · {groups.length} anyag
          <span className="text-ink-muted"> · kattints a sorra a szerkesztéshez</span>
        </p>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const groupPieces = group.rows.reduce((s, p) => s + p.quantity, 0)
          return (
            <div
              key={group.materialId}
              className="overflow-hidden rounded-md border border-border bg-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border border-l-[3px] border-l-primary bg-subtle px-3 py-2">
                <p className="text-body font-semibold text-ink">
                  {group.materialName}
                </p>
                <p className="text-hint tabular-nums text-ink-secondary">
                  {group.rows.length} panel · {groupPieces} db
                </p>
              </div>

              <DataTable className="rounded-none border-0 border-t-0">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell align="right">
                      Szálirány
                    </DataTableHeaderCell>
                    <DataTableHeaderCell align="right">
                      Keresztirány
                    </DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Darab</DataTableHeaderCell>
                    <DataTableHeaderCell>Jelölés</DataTableHeaderCell>
                    <DataTableHeaderCell>Hosszú felső</DataTableHeaderCell>
                    <DataTableHeaderCell>Hosszú alsó</DataTableHeaderCell>
                    <DataTableHeaderCell>Széles bal</DataTableHeaderCell>
                    <DataTableHeaderCell>Széles jobb</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                      Műveletek
                    </DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {group.rows.map((panel) => {
                    const isEditing = panel.id === editingPanelId
                    return (
                      <DataTableRow
                        key={panel.id}
                        role="button"
                        tabIndex={0}
                        aria-current={isEditing ? 'true' : undefined}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-subtle',
                          isEditing && 'bg-primary-soft hover:bg-primary-soft'
                        )}
                        onClick={() => onEdit(panel)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onEdit(panel)
                          }
                        }}
                      >
                        <DataTableCell align="right" className="tabular-nums">
                          {panel.grainMm}
                        </DataTableCell>
                        <DataTableCell align="right" className="tabular-nums">
                          {panel.crossMm}
                        </DataTableCell>
                        <DataTableCell align="right" className="tabular-nums">
                          {panel.quantity}
                        </DataTableCell>
                        <DataTableCell className="text-ink-secondary">
                          {panel.marking || '—'}
                        </DataTableCell>
                        <DataTableCell className="max-w-[10rem] truncate text-hint text-ink-secondary">
                          {panel.edgeALabel || '—'}
                        </DataTableCell>
                        <DataTableCell className="max-w-[10rem] truncate text-hint text-ink-secondary">
                          {panel.edgeCLabel || '—'}
                        </DataTableCell>
                        <DataTableCell className="max-w-[10rem] truncate text-hint text-ink-secondary">
                          {panel.edgeDLabel || '—'}
                        </DataTableCell>
                        <DataTableCell className="max-w-[10rem] truncate text-hint text-ink-secondary">
                          {panel.edgeBLabel || '—'}
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger-ink hover:text-danger-ink"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDelete(panel)
                            }}
                          >
                            Törlés
                          </Button>
                        </DataTableCell>
                      </DataTableRow>
                    )
                  })}
                </DataTableBody>
              </DataTable>
            </div>
          )
        })}
      </div>
    </section>
  )
}
