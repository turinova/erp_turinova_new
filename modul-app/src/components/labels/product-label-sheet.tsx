'use client'

import dynamic from 'next/dynamic'
import { useMemo, type CSSProperties } from 'react'

import {
  BARCODE_INTRINSIC_HEIGHT_PX,
  BARCODE_INTRINSIC_MODULE_PX,
  computeLabelLayout,
  estimateBarcodeModules,
  LABEL_PX_PER_MM,
  BARCODE_MIN_QUIET_MM,
  resolveLabelBarcodeFormat,
  solveBarcodeXMm
} from '@/lib/labels/layout'
import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'
import { cn } from '@/lib/utils'

const Barcode = dynamic(() => import('react-barcode'), { ssr: false })

/** Hierarchy by size; weight 550 everywhere. */
const LABEL_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

type Props = {
  payload: ProductLabelPayload
  fields: LabelFields
  productName: string
  price: number
  unitShortform: string
  size: LabelSize
  mode: 'print' | 'preview'
  /** Preview zoom (px/mm visual); layout always LABEL_PX_PER_MM then CSS scale. */
  previewScale?: number
  showHumanReadable?: boolean
  /** Printer registration — applied only in `print` mode (preview stays centered). */
  offsetXMm?: number
  offsetYMm?: number
  /** Override resolved barcode (supplier / internal / auto from dialog). */
  barcodeValue?: string | null
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
  previewScale = 9,
  showHumanReadable = false,
  offsetXMm = 0,
  offsetYMm = 0,
  barcodeValue: barcodeValueProp,
  className
}: Props) {
  const mm = labelSizeMm(size)
  const text = productName || payload.name || '—'
  const barcode =
    barcodeValueProp !== undefined
      ? barcodeValueProp?.trim() || null
      : labelBarcodeValue(payload)
  const unit = unitShortform || 'db'
  const priceLabel = new Intl.NumberFormat('hu-HU').format(price)

  const layout = useMemo(
    () =>
      computeLabelLayout({
        size,
        fields,
        productName: text,
        price,
        payload,
        showHumanReadable
      }),
    [size, fields, text, price, payload, showHumanReadable]
  )

  const isPreview = mode === 'preview'
  const displayScale = isPreview ? previewScale / LABEL_PX_PER_MM : 1

  const toU = (mmVal: number) => `${mmVal}mm`

  const padX = layout.padSideMm + layout.safetyInsetMm
  const padTop = layout.padTopMm + layout.safetyInsetMm
  const padBottom = layout.padBottomMm + layout.safetyInsetMm

  const skuAsRow = layout.sku && layout.skuPlacement === 'row'
  const skuOverBarcode =
    layout.sku && layout.skuPlacement === 'over-barcode'

  const gridRows: string[] = []
  if (layout.name) gridRows.push(toU(layout.name.rowMm))
  if (skuAsRow) gridRows.push(toU(layout.sku!.rowMm))
  if (layout.price) gridRows.push(toU(layout.price.rowMm))
  if (layout.barcode) gridRows.push(toU(layout.barcode.rowMm))

  const barcodeMetrics = useMemo(() => {
    if (!layout.barcode || !barcode) {
      return {
        heightPx: BARCODE_INTRINSIC_HEIGHT_PX,
        moduleWidth: BARCODE_INTRINSIC_MODULE_PX,
        quietMm: BARCODE_MIN_QUIET_MM,
        format: 'CODE128' as const
      }
    }
    const format = resolveLabelBarcodeFormat(barcode)
    const modules = estimateBarcodeModules(barcode)
    // Fixed small quiet only — do NOT max() with inflated GS1 quiet (photo bug).
    const { quietZoneMm } = solveBarcodeXMm(mm.w, modules)
    const quietMm = quietZoneMm
    const hriMm = layout.showHumanReadable
      ? layout.barcode.secondaryFontMm + 0.35
      : 0
    const skuStripMm = skuOverBarcode ? layout.sku!.rowMm + 0.15 : 0
    const usableMm = Math.max(
      2.5,
      layout.barcode.rowMm - hriMm - skuStripMm
    )
    // Fat intrinsic SVG; CSS width 100% stretch → printed X = (label − 2×quiet) / modules
    const heightPx = Math.max(
      BARCODE_INTRINSIC_HEIGHT_PX,
      Math.round(usableMm * LABEL_PX_PER_MM)
    )
    return {
      heightPx,
      moduleWidth: BARCODE_INTRINSIC_MODULE_PX,
      quietMm,
      format
    }
  }, [layout, barcode, mm.w, skuOverBarcode])

  const cell = (rowMm: number, extra?: CSSProperties): CSSProperties => ({
    height: toU(rowMm),
    maxHeight: toU(rowMm),
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
    ...extra
  })

  // Preview = centered artwork. Offset only at print (printer registration).
  const hasPrintOffset =
    mode === 'print' && (offsetXMm !== 0 || offsetYMm !== 0)

  const skuEl = (sku: NonNullable<typeof layout.sku>) => (
    <div
      style={{
        fontSize: toU(sku.fontMm),
        fontWeight: 550,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        letterSpacing: '0.02em',
        textAlign: 'center'
      }}
    >
      {payload.sku}
    </div>
  )

  const sheet = (
    <div
      className={cn(className)}
      style={{
        width: `${mm.w}mm`,
        height: `${mm.h}mm`,
        padding: `${toU(padTop)} ${toU(padX)} ${toU(padBottom)}`,
        margin: 0,
        backgroundColor: '#fff',
        display: 'grid',
        gridTemplateRows: gridRows.join(' '),
        gridTemplateColumns: '100%',
        gap: toU(layout.gapMm),
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#000',
        fontFamily: LABEL_FONT_FAMILY,
        WebkitFontSmoothing: 'antialiased',
        ...(hasPrintOffset
          ? {
              transform: `translate(${toU(offsetXMm)}, ${toU(offsetYMm)})`
            }
          : null)
      }}
    >
      {/* Stretch barcode SVG like main-app — printed X = cell width / modules */}
      <style>{`
        .label-barcode-svg-wrap svg {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          object-fit: fill !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      {layout.name ? (
        <div
          style={cell(layout.name.rowMm, {
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            // Hard clip — name must never paint into SKU row
            overflow: 'hidden'
          })}
        >
          <div
            style={{
              fontSize: toU(layout.name.fontMm),
              fontWeight: 550,
              lineHeight: 1.12,
              textAlign: 'center',
              width: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              letterSpacing: '0.01em',
              // Hard line-clamp (layout.maxLines) — clerk cannot override
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: layout.name.maxLines ?? 2
            }}
          >
            {text}
          </div>
        </div>
      ) : null}

      {skuAsRow ? (
        <div
          style={cell(layout.sku!.rowMm, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })}
        >
          {skuEl(layout.sku!)}
        </div>
      ) : null}

      {layout.price ? (
        <div
          style={cell(layout.price.rowMm, {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'center',
            flexWrap: 'nowrap',
            gap: toU(0.2)
          })}
        >
          <span
            style={{
              fontSize: toU(layout.price.fontMm),
              fontWeight: 550,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              maxWidth: '100%'
            }}
          >
            {priceLabel} Ft
          </span>
          <span
            style={{
              fontSize: toU(layout.price.secondaryFontMm),
              fontWeight: 550,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
              opacity: 0.9
            }}
          >
            /{unit}
          </span>
        </div>
      ) : null}

      {layout.barcode && barcode ? (
        <div
          style={cell(layout.barcode.rowMm, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            justifyContent: 'flex-end',
            // Cancel sheet side pad → full-bleed barcode (main-app parity)
            marginLeft: toU(-padX),
            marginRight: toU(-padX),
            width: `calc(100% + ${toU(padX * 2)})`
          })}
        >
          {skuOverBarcode ? (
            <div
              style={{
                height: toU(layout.sku!.rowMm),
                maxHeight: toU(layout.sku!.rowMm),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                paddingLeft: toU(padX),
                paddingRight: toU(padX)
              }}
            >
              {skuEl(layout.sku!)}
            </div>
          ) : null}
          <div
            className="label-barcode-svg-wrap"
            style={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              width: '100%',
              alignItems: 'stretch',
              justifyContent: 'center',
              overflow: 'hidden',
              paddingLeft: toU(barcodeMetrics.quietMm),
              paddingRight: toU(barcodeMetrics.quietMm),
              boxSizing: 'border-box'
            }}
          >
            <Barcode
              value={barcode}
              format={barcodeMetrics.format}
              width={barcodeMetrics.moduleWidth}
              height={barcodeMetrics.heightPx}
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
                marginTop: toU(0.15),
                fontFamily: 'ui-monospace, monospace',
                fontWeight: 550,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                maxWidth: '100%',
                textAlign: 'center',
                paddingLeft: toU(padX),
                paddingRight: toU(padX)
              }}
            >
              {barcode}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  if (!isPreview || displayScale === 1) {
    return sheet
  }

  const slotW = mm.w * previewScale
  const slotH = mm.h * previewScale
  return (
    <div
      style={{
        width: slotW,
        height: slotH,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${mm.w}mm`,
          height: `${mm.h}mm`,
          transform: `scale(${displayScale})`,
          transformOrigin: 'top left'
        }}
      >
        {sheet}
      </div>
    </div>
  )
}
