'use client'

import { useEffect, useRef, useState } from 'react'

import { buildA4BarcodeSheetPreviewPng } from '@/lib/a4-barcode-sheets/preview'
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  cellKey,
  type A4SheetCellDraft
} from '@/lib/a4-barcode-sheets/types'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  cols: number
  rows: number
  marginMm: number
  showName: boolean
  showSku: boolean
  showPrice: boolean
  cells: A4SheetCellDraft[]
  canWrite: boolean
  onCellClick: (row: number, col: number) => void
}

/**
 * Print-truth preview: same PDF as download → PNG, plus transparent click grid.
 */
export function A4SheetPreview({
  name,
  cols,
  rows,
  marginMm,
  showName,
  showSku,
  showPrice,
  cells,
  canWrite,
  onCellClick
}: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const genRef = useRef(0)

  const filledKeys = new Set(cells.map((c) => cellKey(c.row, c.col)))
  // Stable signature for cell content (avoid re-render loops on array identity alone)
  const cellsSig = cells
    .map(
      (c) =>
        `${c.row}:${c.col}:${c.barcodeValue}:${c.nameSnap}:${c.skuSnap}:${c.priceGross ?? ''}:${c.unitSnap}:${c.showName ? 1 : 0}${c.showSku ? 1 : 0}${c.showPrice ? 1 : 0}${c.showBarcode ? 1 : 0}`
    )
    .join('|')

  useEffect(() => {
    const gen = ++genRef.current
    const t = window.setTimeout(() => {
      setRendering(true)
      setError(null)
      void buildA4BarcodeSheetPreviewPng(
        {
          name: name.trim() || 'Vonalkód lap',
          cols,
          rows,
          marginMm,
          fields: { showName, showSku, showPrice },
          cells
        },
        2
      )
        .then((url) => {
          if (gen !== genRef.current) return
          setSrc(url)
          setRendering(false)
        })
        .catch((err) => {
          if (gen !== genRef.current) return
          console.error('A4 preview', err)
          setError(
            err instanceof Error
              ? err.message
              : 'Nem sikerült az előnézet generálása.'
          )
          setRendering(false)
        })
    }, 320)

    return () => {
      window.clearTimeout(t)
    }
    // cells via cellsSig — latest cells closed over from render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, cols, rows, marginMm, showName, showSku, showPrice, cellsSig])

  const m = Math.max(0, marginMm)
  const padX = (m / A4_WIDTH_MM) * 100
  const padY = (m / A4_HEIGHT_MM) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-hint text-ink-secondary">
          Előnézet = nyomtatási PDF (arányos A4)
        </p>
        {rendering ? (
          <p className="text-hint text-ink-tertiary" aria-live="polite">
            Frissítés…
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          className="rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div
        className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-sm border border-border bg-white shadow-sm"
        style={{ aspectRatio: `${A4_WIDTH_MM} / ${A4_HEIGHT_MM}` }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic data URL from PDF raster
          <img
            src={src}
            alt="A4 vonalkód lap előnézet"
            className="pointer-events-none absolute inset-0 size-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-body text-ink-secondary">
            {rendering ? 'Előnézet készül…' : '—'}
          </div>
        )}

        {/* Click targets aligned to PDF margin + cell grid */}
        <div
          className="absolute"
          style={{
            left: `${padX}%`,
            top: `${padY}%`,
            right: `${padX}%`,
            bottom: `${padY}%`,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
          }}
          role="grid"
          aria-label="A4 cellák"
        >
          {Array.from({ length: rows * cols }, (_, i) => {
            const row = Math.floor(i / cols)
            const col = i % cols
            const filled = filledKeys.has(cellKey(row, col))
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                role="gridcell"
                disabled={!canWrite}
                aria-label={
                  filled
                    ? `Cella ${row + 1}×${col + 1} szerkesztése`
                    : `Cella ${row + 1}×${col + 1} kitöltése`
                }
                onClick={() => onCellClick(row, col)}
                className={cn(
                  'min-h-0 border border-transparent bg-transparent transition-colors',
                  canWrite &&
                    'hover:border-ink/40 hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink',
                  !filled && canWrite && 'hover:bg-primary/5'
                )}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
