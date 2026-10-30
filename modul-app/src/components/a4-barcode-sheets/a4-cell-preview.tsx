'use client'

import { useEffect, useRef, useState } from 'react'

import { buildA4CellPreviewJpeg } from '@/lib/a4-barcode-sheets/preview'
import type { A4SheetCellDraft } from '@/lib/a4-barcode-sheets/types'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 220
/** Display scale ≈ px/mm for modal left column. */
const DISPLAY_PX_PER_MM = 3.6

type Props = {
  cell: A4SheetCellDraft | null
  cellWMm: number
  cellHMm: number
  className?: string
}

/**
 * Live JPEG preview of one A4 cell — same PDF paint as print (címke-modal mintára).
 */
export function A4CellPreview({
  cell,
  cellWMm,
  cellHMm,
  className
}: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const genRef = useRef(0)

  const sig = cell
    ? [
        cell.barcodeValue,
        cell.nameSnap,
        cell.skuSnap,
        cell.priceGross ?? '',
        cell.unitSnap,
        cell.showName ? 1 : 0,
        cell.showSku ? 1 : 0,
        cell.showPrice ? 1 : 0,
        cell.showBarcode ? 1 : 0,
        cellWMm.toFixed(2),
        cellHMm.toFixed(2)
      ].join('|')
    : ''

  useEffect(() => {
    if (!cell) {
      setSrc(null)
      setFailed(false)
      setLoading(false)
      return
    }
    const gen = ++genRef.current
    setLoading(true)
    setFailed(false)
    const t = window.setTimeout(() => {
      void buildA4CellPreviewJpeg({
        cell,
        cellWMm,
        cellHMm,
        scale: 4
      })
        .then((url) => {
          if (gen !== genRef.current) return
          setSrc(url)
          setLoading(false)
        })
        .catch((err) => {
          console.error('A4 cell preview', err)
          if (gen !== genRef.current) return
          setFailed(true)
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
    // cell via sig
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, cellWMm, cellHMm])

  const slotW = Math.min(
    280,
    Math.max(140, Math.round(cellWMm * DISPLAY_PX_PER_MM))
  )
  const slotH = Math.max(100, Math.round(cellHMm * (slotW / cellWMm)))

  if (!cell) {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-white px-3 py-8',
          className
        )}
        style={{ minHeight: slotH }}
      >
        <p className="text-hint text-ink-secondary">Cella előnézet</p>
        <p className="text-center text-hint text-ink-tertiary">
          Válassz terméket — itt látod, mi kerül a cellára.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex w-full flex-col items-center gap-1.5', className)}>
      <p className="text-hint text-ink-secondary">
        Előnézet · {Math.round(cellWMm)}×{Math.round(cellHMm)} mm
      </p>
      <div
        className="relative w-full max-w-full overflow-hidden rounded-md border border-border bg-white shadow-sm"
        style={{ aspectRatio: `${cellWMm} / ${cellHMm}` }}
      >
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic JPEG data URL
          <img
            src={src}
            alt="Cella nyomtatási előnézet"
            width={slotW}
            height={slotH}
            className="block size-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-zinc-50 text-hint text-ink-tertiary">
            {failed ? 'Előnézet nem elérhető' : 'Előnézet…'}
          </div>
        )}
        {loading && src ? (
          <div
            className="pointer-events-none absolute inset-0 bg-white/40"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}
