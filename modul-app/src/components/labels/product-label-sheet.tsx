'use client'

import dynamic from 'next/dynamic'
import { useMemo, type CSSProperties } from 'react'

import { computeLabelLayout } from '@/lib/labels/layout'
import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'
import { cn } from '@/lib/utils'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

type Props = {
  payload: ProductLabelPayload
  fields: LabelFields
  productName: string
  price: number
  unitShortform: string
  size: LabelSize
  mode: 'print' | 'preview'
  previewScale?: number
  className?: string
}

export function ProductLabelSheet({
  payload,
  fields,
  productName,
  price,
  unitShortform,
  size,
  mode,
  previewScale = 8.5,
  className
}: Props) {
  const mm = labelSizeMm(size)
  const text = productName || payload.name || '—'
  const barcode = labelBarcodeValue(payload)
  const unit = unitShortform || 'db'
  const priceLabel = new Intl.NumberFormat('hu-HU').format(price)

  const layout = useMemo(
    () =>
      computeLabelLayout({
        size,
        fields,
        productName: text,
        price,
        payload
      }),
    [size, fields, text, price, payload]
  )

  const isPreview = mode === 'preview'
  const width = isPreview ? `${mm.w * previewScale}px` : `${mm.w}mm`
  const height = isPreview ? `${mm.h * previewScale}px` : `${mm.h}mm`

  const toU = (mmVal: number) =>
    isPreview ? `${(mmVal * previewScale).toFixed(2)}px` : `${mmVal}mm`

  const gridRows: string[] = []
  if (layout.name) gridRows.push(toU(layout.name.rowMm))
  if (layout.sku) gridRows.push(toU(layout.sku.rowMm))
  if (layout.price) gridRows.push(toU(layout.price.rowMm))
  if (layout.barcode) gridRows.push(toU(layout.barcode.rowMm))

  const barcodeSvgPx = (() => {
    if (!layout.barcode) return 24
    const readableMm = layout.showHumanReadable
      ? layout.barcode.secondaryFontMm + 0.45
      : 0.25
    const usable = Math.max(2.5, layout.barcode.rowMm - readableMm)
    const pxPerMm = isPreview ? previewScale : 3.78
    return Math.max(14, Math.round(usable * pxPerMm))
  })()

  const barcodeModuleWidth = (() => {
    if (!barcode) return 1.4
    const chars = barcode.length
    const availPx =
      (mm.w - layout.padSideMm * 2) * (isPreview ? previewScale : 3.78)
    const modules = Math.max(1, chars * 11)
    return Math.max(1, Math.min(2.6, availPx / modules))
  })()

  const cell = (rowMm: number, extra?: CSSProperties): CSSProperties => ({
    height: toU(rowMm),
    maxHeight: toU(rowMm),
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
    ...extra
  })

  return (
    <div
      className={cn(className)}
      style={{
        width,
        height,
        padding: `${toU(layout.padTopMm)} ${toU(layout.padSideMm)} ${toU(layout.padBottomMm)}`,
        margin: 0,
        backgroundColor: '#fff',
        display: 'grid',
        gridTemplateRows: gridRows.join(' '),
        gridTemplateColumns: '100%',
        gap: toU(layout.gapMm),
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#000'
      }}
    >
      {layout.name ? (
        <div
          style={cell(layout.name.rowMm, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })}
        >
          <div
            style={{
              fontSize: toU(layout.name.fontMm),
              fontWeight: 700,
              lineHeight: 1.12,
              textAlign: 'center',
              width: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word'
            }}
          >
            {text}
          </div>
        </div>
      ) : null}

      {layout.sku ? (
        <div
          style={cell(layout.sku.rowMm, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })}
        >
          <div
            style={{
              fontSize: toU(layout.sku.fontMm),
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              letterSpacing: '0.02em'
            }}
          >
            {payload.sku}
          </div>
        </div>
      ) : null}

      {layout.price ? (
        <div
          style={cell(layout.price.rowMm, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: toU(0.25)
          })}
        >
          <div
            style={{
              fontSize: toU(layout.price.fontMm),
              fontWeight: 800,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              maxWidth: '100%'
            }}
          >
            {priceLabel} Ft
          </div>
          <div
            style={{
              fontSize: toU(layout.price.secondaryFontMm),
              lineHeight: 1,
              opacity: 0.85,
              whiteSpace: 'nowrap'
            }}
          >
            / {unit}
          </div>
        </div>
      ) : null}

      {layout.barcode && barcode ? (
        <div
          style={cell(layout.barcode.rowMm, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end'
          })}
        >
          <div
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              width: '100%',
              alignItems: 'flex-end',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <Barcode
              value={barcode}
              format="CODE128"
              width={barcodeModuleWidth}
              height={barcodeSvgPx}
              displayValue={false}
              margin={0}
              background="#ffffff"
              lineColor="#000000"
            />
          </div>
          {layout.showHumanReadable ? (
            <div
              style={{
                fontSize: toU(layout.barcode.secondaryFontMm),
                lineHeight: 1.1,
                marginTop: toU(0.3),
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                maxWidth: '100%'
              }}
            >
              {barcode}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
