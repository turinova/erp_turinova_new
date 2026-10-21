/**
 * 33×25 mm product label → ZPL II for Zebra ZD220 @ 203 dpi.
 * Barcodes are drawn by the printer (^BE / ^BC) — not raster SVG.
 *
 * Layout: bottom-up zones — barcode band fixed first, then price/SKU/name
 * in remaining space. Y advances by actual line count (not maxLines).
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import { estimateCode128Modules } from '@/lib/labels/layout'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'

/** 203 dpi: 8 dots per mm. */
export const ZPL_DOTS_PER_MM = 8

export const ZPL_LABEL_W_DOTS = 33 * ZPL_DOTS_PER_MM // 264
export const ZPL_LABEL_H_DOTS = 25 * ZPL_DOTS_PER_MM // 200

/** Side pad (~2 mm). */
export const ZPL_PAD_DOTS = 16

export const ZPL_CONTENT_X = ZPL_PAD_DOTS
export const ZPL_CONTENT_W = ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS // 232

export const ZPL_MODULE_DOTS = 2

/** EAN-13 total modules including quiet (11+95+7). */
export const EAN13_TOTAL_MODULES = 113

const CODE128_QUIET_DOTS = 10

/** Fixed barcode band height (dots) — ~9–10 mm. */
export const ZPL_BARCODE_BAND_DOTS = 76

export const ZPL_DEFAULT_DARKNESS = 14

export type LabelZplInput = {
  productName: string
  price: number
  unitShortform: string
  fields: LabelFields
  payload: Pick<ProductLabelPayload, 'sku' | 'barcode' | 'barcodeInternal'>
  barcodeValue?: string | null
  showHumanReadable?: boolean
  amount?: number
  offsetXMm?: number
  offsetYMm?: number
  darkness?: number
  printSpeed?: number
}

export type LabelZplResult = {
  zpl: string
  symbology: 'EAN13' | 'CODE128' | null
  barcodeFits: boolean
  fitWarning: string | null
}

export function escapeZplFd(raw: string): string {
  return raw
    .replace(/[\^~]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
}

export function mmToDots(mm: number): number {
  return Math.round(mm * ZPL_DOTS_PER_MM)
}

export function ean13Data12ForZpl(code: string): string | null {
  const d = code.replace(/\D/g, '')
  if (d.length === 13 && isValidEan13(d)) return d.slice(0, 12)
  if (d.length === 12) return d
  return null
}

export function ean13TotalWidthDots(moduleDots = ZPL_MODULE_DOTS): number {
  return EAN13_TOTAL_MODULES * moduleDots
}

export function ean13OriginX(moduleDots = ZPL_MODULE_DOTS): number {
  const w = ean13TotalWidthDots(moduleDots)
  const centered = Math.floor((ZPL_LABEL_W_DOTS - w) / 2)
  return Math.max(ZPL_PAD_DOTS, centered)
}

export function code128Fits33mm(value: string): boolean {
  const modules = estimateCode128Modules(value)
  const width = modules * ZPL_MODULE_DOTS + 2 * CODE128_QUIET_DOTS
  return width <= ZPL_CONTENT_W
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('hu-HU').format(Math.round(price))
}

/** Estimate wrapped lines for ^FB (approx chars/line at given font). */
function estimateFbLines(
  text: string,
  fontW: number,
  maxLines: number
): number {
  const t = escapeZplFd(text)
  if (!t) return 0
  const charsPerLine = Math.max(8, Math.floor(ZPL_CONTENT_W / (fontW * 0.55)))
  const raw = Math.ceil(t.length / charsPerLine)
  return Math.min(maxLines, Math.max(1, raw))
}

function pushCenteredText(
  lines: string[],
  y: number,
  text: string,
  opts: { fontH: number; fontW: number; maxLines: number; lineGap?: number }
): number {
  const fd = escapeZplFd(text)
  if (!fd) return y
  const gap = opts.lineGap ?? 0
  const usedLines = estimateFbLines(fd, opts.fontW, opts.maxLines)
  lines.push(`^FO${ZPL_CONTENT_X},${y}`)
  lines.push(`^A0N,${opts.fontH},${opts.fontW}`)
  lines.push(`^FB${ZPL_CONTENT_W},${usedLines},${gap},C,0`)
  lines.push(`^FD${fd}^FS`)
  const lineH = opts.fontH + 4 + gap
  return y + usedLines * lineH
}

function appendBarcode(
  out: string[],
  opts: {
    y: number
    height: number
    ean12: string | null
    rawBarcode: string
    useEan: boolean
    hri: boolean
  }
) {
  const hriFlag = opts.hri ? 'Y' : 'N'
  out.push(`^BY${ZPL_MODULE_DOTS},3,${opts.height}`)

  if (opts.useEan && opts.ean12) {
    const bx = ean13OriginX()
    out.push(`^FO${bx},${opts.y}^BEN,${opts.height},${hriFlag},N`)
    out.push(`^FD${opts.ean12}^FS`)
  } else {
    const data = escapeZplFd(opts.rawBarcode)
    const modules = estimateCode128Modules(data)
    const symbolW = modules * ZPL_MODULE_DOTS + 2 * CODE128_QUIET_DOTS
    const bx = Math.max(
      ZPL_PAD_DOTS,
      Math.floor((ZPL_LABEL_W_DOTS - Math.min(symbolW, ZPL_CONTENT_W)) / 2)
    )
    out.push(`^FO${bx},${opts.y}^BCN,${opts.height},${hriFlag},N,N,A`)
    out.push(`^FD${data}^FS`)
  }
}

/**
 * Build one ZPL job for 33×25 (may include ^PQ for copies).
 * Caller must pass a policy-resolved barcodeValue (scannable or null).
 */
export function generateLabelZpl(input: LabelZplInput): LabelZplResult {
  const showName = input.fields.showName
  const showSku = input.fields.showSku && Boolean(input.payload.sku?.trim())
  const showPrice = input.fields.showPrice
  const rawBarcode = (input.barcodeValue ?? '').trim()
  const showBarcode = input.fields.showBarcode && Boolean(rawBarcode)
  const hri = Boolean(input.showHumanReadable)
  const copies = Math.max(1, Math.round(input.amount ?? 1))
  const dark = Math.min(
    30,
    Math.max(0, Math.round(input.darkness ?? ZPL_DEFAULT_DARKNESS))
  )
  const speed = Math.min(4, Math.max(1, Math.round(input.printSpeed ?? 2)))

  const ox = mmToDots(input.offsetXMm ?? 0)
  const oy = mmToDots(input.offsetYMm ?? 0)

  const ean12 = showBarcode ? ean13Data12ForZpl(rawBarcode) : null
  const useEan = Boolean(ean12)
  let barcodeFits = true
  let fitWarning: string | null = null
  let symbology: LabelZplResult['symbology'] = null

  if (showBarcode) {
    if (useEan) {
      symbology = 'EAN13'
      barcodeFits = ean13TotalWidthDots() <= ZPL_CONTENT_W
    } else {
      symbology = 'CODE128'
      barcodeFits = code128Fits33mm(rawBarcode)
      if (!barcodeFits) {
        fitWarning =
          'A kód nem fér olvashatóan — a print policy-nak EAN-re kellett volna váltania.'
      }
    }
  }

  const header: string[] = [
    '^XA',
    '^CI28',
    '^LH0,0',
    `^PW${ZPL_LABEL_W_DOTS}`,
    `^LL${ZPL_LABEL_H_DOTS}`,
    `^MD${dark}`,
    `^PR${speed}`,
    `^LS${ox}`,
    `^LT${oy}`
  ]

  const body: string[] = []
  const barcodeOnly =
    showBarcode && !showName && !showSku && !showPrice

  if (barcodeOnly) {
    const barH = Math.min(140, ZPL_LABEL_H_DOTS - 2 * ZPL_PAD_DOTS)
    const barY = Math.max(
      ZPL_PAD_DOTS,
      Math.floor((ZPL_LABEL_H_DOTS - barH) / 2)
    )
    appendBarcode(body, {
      y: barY,
      height: barH,
      ean12,
      rawBarcode,
      useEan,
      hri: false
    })
  } else {
    // Bottom-up: reserve barcode band, then fill text above
    const barH = showBarcode
      ? Math.min(
          ZPL_BARCODE_BAND_DOTS,
          ZPL_LABEL_H_DOTS - 2 * ZPL_PAD_DOTS - 40
        )
      : 0
    const barY = showBarcode
      ? ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS - barH
      : ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS
    const textBottom = showBarcode ? barY - 4 : ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS

    if (showBarcode) {
      appendBarcode(body, {
        y: barY,
        height: barH,
        ean12,
        rawBarcode,
        useEan,
        hri
      })
    }

    // Build text top-down within [pad … textBottom]
    let y = ZPL_PAD_DOTS
    const warehouse = showSku && !showName

    if (warehouse) {
      y = pushCenteredText(body, y, input.payload.sku, {
        fontH: 32,
        fontW: 32,
        maxLines: 1
      })
      y += 2
      if (showPrice && y + 30 < textBottom) {
        const priceLine = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`
        y = pushCenteredText(body, y, priceLine, {
          fontH: 26,
          fontW: 26,
          maxLines: 1
        })
      }
    } else {
      if (showName) {
        const nameMax = showSku || showPrice ? 2 : 2
        const room = textBottom - y
        const maxLines = room > 52 ? nameMax : 1
        y = pushCenteredText(body, y, input.productName || '—', {
          fontH: 18,
          fontW: 18,
          maxLines,
          lineGap: 0
        })
        y += 2
      }
      if (showSku && y + 28 < textBottom) {
        y = pushCenteredText(body, y, input.payload.sku, {
          fontH: 24,
          fontW: 24,
          maxLines: 1
        })
        y += 2
      }
      if (showPrice && y + 30 < textBottom) {
        const priceLine = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`
        pushCenteredText(body, y, priceLine, {
          fontH: 26,
          fontW: 26,
          maxLines: 1
        })
      }
    }
  }

  const lines = [
    ...header,
    ...body,
    `^PQ${copies},0,1,Y`,
    '^XZ'
  ]

  return {
    zpl: lines.join('\n'),
    symbology,
    barcodeFits,
    fitWarning
  }
}
