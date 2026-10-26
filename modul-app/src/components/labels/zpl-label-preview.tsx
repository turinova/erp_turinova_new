'use client'

import { useEffect, useRef, useState } from 'react'

import { ProductLabelSheet } from '@/components/labels/product-label-sheet'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'
import { renderLabelZplPreview } from '@/lib/labels/zpl-preview'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 200
/** Visual scale: 264px @ 8dpmm → ~9 px/mm display width. */
const PREVIEW_DISPLAY_SCALE = 9

type Props = {
  payload: ProductLabelPayload
  fields: LabelFields
  productName: string
  price: number
  unitShortform: string
  showHumanReadable: boolean
  barcodeValue: string | null
  offsetXMm: number
  offsetYMm: number
  className?: string
}

export function ZplLabelPreview({
  payload,
  fields,
  productName,
  price,
  unitShortform,
  showHumanReadable,
  barcodeValue,
  offsetXMm,
  offsetYMm,
  className
}: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const urlRef = useRef<string | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    const gen = ++genRef.current
    setLoading(true)
    setFailed(false)

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await renderLabelZplPreview({
            productName,
            price,
            unitShortform,
            fields,
            payload,
            barcodeValue,
            showHumanReadable,
            offsetXMm,
            offsetYMm
          })
          if (gen !== genRef.current) {
            URL.revokeObjectURL(result.objectUrl)
            return
          }
          if (urlRef.current) URL.revokeObjectURL(urlRef.current)
          urlRef.current = result.objectUrl
          setObjectUrl(result.objectUrl)
          setFailed(false)
        } catch (err) {
          console.error('ZPL preview render failed', err)
          if (gen !== genRef.current) return
          setFailed(true)
        } finally {
          if (gen === genRef.current) setLoading(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    productName,
    price,
    unitShortform,
    fields,
    payload,
    barcodeValue,
    showHumanReadable,
    offsetXMm,
    offsetYMm
  ])

  useEffect(() => {
    return () => {
      genRef.current += 1
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [])

  const slotW = 33 * PREVIEW_DISPLAY_SCALE
  const slotH = 25 * PREVIEW_DISPLAY_SCALE

  if (failed) {
    return (
      <div className={cn('flex flex-col items-center gap-1.5', className)}>
        <p className="text-[11px] text-ink-muted">
          ZPL előnézet nem elérhető — közelítő HTML
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-white p-4 shadow-sm">
          <ProductLabelSheet
            payload={payload}
            fields={fields}
            productName={productName}
            price={price}
            unitShortform={unitShortform}
            size="33x25"
            mode="preview"
            previewScale={PREVIEW_DISPLAY_SCALE}
            showHumanReadable={showHumanReadable}
            barcodeValue={barcodeValue}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className="overflow-hidden rounded-md border border-border bg-white shadow-sm"
        style={{ width: slotW, height: slotH }}
      >
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL from ZPL renderer
          <img
            src={objectUrl}
            alt="Címke ZPL előnézet"
            width={slotW}
            height={slotH}
            className="block h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-50 text-[12px] text-ink-muted">
            Előnézet…
          </div>
        )}
      </div>
      {loading && objectUrl ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-md bg-white/40"
          aria-hidden
        />
      ) : null}
    </div>
  )
}
