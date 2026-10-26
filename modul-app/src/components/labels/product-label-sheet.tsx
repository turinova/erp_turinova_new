'use client'

import dynamic from 'next/dynamic'
import { useMemo, type CSSProperties } from 'react'

import {
  BARCODE_INTRINSIC_HEIGHT_PX,
  BARCODE_INTRINSIC_MODULE_PX,
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
import {
  clampLabelName,
  dotsToMm,
  packLabel33x25,
  ZPL_DOTS_PER_MM,
  ZPL_PAD_DOTS
} from '@/lib/labels/zpl'
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

type ZoneId = 'name' | 'sku' | 'price' | 'barcode'

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
  const nameText = clampLabelName(productName || payload.name || '—')
  const barcode =
    barcodeValueProp !== undefined
      ? barcodeValueProp?.trim() || null
      : labelBarcodeValue(payload)
  const unit = unitShortform || 'db'
  const priceLabel = new Intl.NumberFormat('hu-HU').format(Math.round(price))
  const sku = payload.sku?.trim() || ''

  const showName = fields.showName
  const showSku = fields.showSku && Boolean(sku)
  const showPrice = fields.showPrice
  const showBarcode = fields.showBarcode && Boolean(barcode)

  /** Same packer as ZPL print — preview zones match the printer. */
  const plan = useMemo(
    () =>
      packLabel33x25({
        productName: nameText,
        price,
        unitShortform: unit,
        sku,
        showName,
        showSku,
        showPrice,
        showBarcode,
        showHumanReadable
      }),
    [
      nameText,
      price,
      unit,
      sku,
      showName,
      showSku,
      showPrice,
      showBarcode,
      showHumanReadable
    ]
  )

  const isPreview = mode === 'preview'
  const displayScale = isPreview ? previewScale / LABEL_PX_PER_MM : 1

  const toU = (mmVal: number) => `${mmVal}mm`
  const padMm = dotsToMm(ZPL_PAD_DOTS)

  const nameBlock = plan.blocks.find((b) => b.kind === 'name')
  const skuBlock = plan.blocks.find((b) => b.kind === 'sku')
  const priceBlock = plan.blocks.find((b) => b.kind === 'price')

  const zoneOrder: ZoneId[] =
    showBarcode && !showName && !showSku && !showPrice
      ? ['barcode']
      : (['name', 'sku', 'price', 'barcode'] as ZoneId[]).filter(
          (id) => plan.zones[id]
        )

  const gridRows = zoneOrder.map((id) => toU(dotsToMm(plan.zones[id]!.h)))

  const barcodeZoneH = plan.zones.barcode
    ? dotsToMm(plan.zones.barcode.h)
    : 0
  const barcodeDrawMm = plan.barH > 0 ? dotsToMm(plan.barH) : barcodeZoneH

  const barcodeMetrics = useMemo(() => {
    if (!showBarcode || !barcode) {
      return {
        heightPx: BARCODE_INTRINSIC_HEIGHT_PX,
        moduleWidth: BARCODE_INTRINSIC_MODULE_PX,
        quietMm: BARCODE_MIN_QUIET_MM,
        format: 'CODE128' as const
      }
    }
    const format = resolveLabelBarcodeFormat(barcode)
    const modules = estimateBarcodeModules(barcode)
    const { quietZoneMm } = solveBarcodeXMm(mm.w, modules)
    const hriMm = showHumanReadable ? 1.2 : 0
    const usableMm = Math.max(2.5, barcodeDrawMm - hriMm)
    const heightPx = Math.max(
      BARCODE_INTRINSIC_HEIGHT_PX,
      Math.round(usableMm * LABEL_PX_PER_MM)
    )
    return {
      heightPx,
      moduleWidth: BARCODE_INTRINSIC_MODULE_PX,
      quietMm: quietZoneMm,
      format
    }
  }, [showBarcode, barcode, mm.w, barcodeDrawMm, showHumanReadable])

  const cell = (rowMm: number, extra?: CSSProperties): CSSProperties => ({
    height: toU(rowMm),
    maxHeight: toU(rowMm),
    minHeight: 0,
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
    ...extra
  })

  const hasPrintOffset =
    mode === 'print' && (offsetXMm !== 0 || offsetYMm !== 0)

  const fontMmFromDots = (dots: number) => dots / ZPL_DOTS_PER_MM

  const sheet = (
    <div
      className={cn(className)}
      style={{
        width: `${mm.w}mm`,
        height: `${mm.h}mm`,
        padding: `${toU(padMm)} ${toU(padMm)}`,
        margin: 0,
        backgroundColor: '#fff',
        display: 'grid',
        gridTemplateRows: gridRows.length > 0 ? gridRows.join(' ') : '1fr',
        gridTemplateColumns: '100%',
        gap: 0,
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

      {zoneOrder.map((id) => {
        const zone = plan.zones[id]!
        const rowMm = dotsToMm(zone.h)

        if (id === 'name') {
          if (!showName || !nameBlock) {
            return <div key={id} style={cell(rowMm)} aria-hidden />
          }
          return (
            <div
              key={id}
              style={cell(rowMm, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              })}
            >
              <div
                style={{
                  fontSize: toU(fontMmFromDots(nameBlock.fontH)),
                  fontWeight: 550,
                  lineHeight: 1.05,
                  textAlign: 'center',
                  width: '100%',
                  maxHeight: '100%',
                  overflow: 'hidden',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  letterSpacing: '0.01em',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: nameBlock.maxLines
                }}
              >
                {nameText}
              </div>
            </div>
          )
        }

        if (id === 'sku') {
          if (!showSku || !skuBlock) {
            return <div key={id} style={cell(rowMm)} aria-hidden />
          }
          return (
            <div
              key={id}
              style={cell(rowMm, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              })}
            >
              <div
                style={{
                  fontSize: toU(fontMmFromDots(skuBlock.fontH)),
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
                {sku}
              </div>
            </div>
          )
        }

        if (id === 'price') {
          if (!showPrice || !priceBlock) {
            return <div key={id} style={cell(rowMm)} aria-hidden />
          }
          return (
            <div
              key={id}
              style={cell(rowMm, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              })}
            >
              <div
                style={{
                  fontSize: toU(fontMmFromDots(priceBlock.fontH)),
                  fontWeight: 550,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  maxWidth: '100%',
                  textAlign: 'center'
                }}
              >
                {priceLabel} Ft/{unit}
              </div>
            </div>
          )
        }

        // barcode
        if (!showBarcode || !barcode) {
          return <div key={id} style={cell(rowMm)} aria-hidden />
        }
        return (
          <div
            key={id}
            style={cell(rowMm, {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'center',
              marginLeft: toU(-padMm),
              marginRight: toU(-padMm),
              width: `calc(100% + ${toU(padMm * 2)})`
            })}
          >
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
            {showHumanReadable ? (
              <div
                style={{
                  fontSize: toU(1.2),
                  lineHeight: 1.1,
                  marginTop: toU(0.1),
                  fontFamily: 'ui-monospace, monospace',
                  fontWeight: 550,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: '100%',
                  textAlign: 'center',
                  paddingLeft: toU(padMm),
                  paddingRight: toU(padMm)
                }}
              >
                {barcode}
              </div>
            ) : null}
          </div>
        )
      })}
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
