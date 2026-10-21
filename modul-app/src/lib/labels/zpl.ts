/**
 * 33×25 mm product label → ZPL II for Zebra ZD220 @ 203 dpi.
 * Barcodes are drawn by the printer (^BE / ^BC) — not raster SVG.
 *
 * Layout rules (scan-first):
 * - ~2 mm side pad so left quiet zone / first glyphs are not clipped
 * - Text centered via ^FB … C
 * - EAN-13 width = 113 modules (incl. GS1 quiet), not 95
 * - Darkness default modest (^MD14) — too dark bleeds bars
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import { estimateCode128Modules } from '@/lib/labels/layout'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'

/** 203 dpi: 8 dots per mm. */
export const ZPL_DOTS_PER_MM = 8

export const ZPL_LABEL_W_DOTS = 33 * ZPL_DOTS_PER_MM // 264
export const ZPL_LABEL_H_DOTS = 25 * ZPL_DOTS_PER_MM // 200

/** Side pad (~2 mm) — keeps text + barcode quiet off the die-cut edge. */
export const ZPL_PAD_DOTS = 16

export const ZPL_CONTENT_X = ZPL_PAD_DOTS
export const ZPL_CONTENT_W = ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS // 232

/** Module width — ^BY3 EAN does not fit 33 mm with quiet zones. */
export const ZPL_MODULE_DOTS = 2

/**
 * EAN-13 total modules including quiet zones (11 + 95 + 7).
 * Use this for FO centering — not bar-only 95.
 */
export const EAN13_TOTAL_MODULES = 113

/** Soft quiet each side for CODE128 fit check (dots). */
const CODE128_QUIET_DOTS = 10

/** Default darkness — Zebra: lowest that still prints clean. */
export const ZPL_DEFAULT_DARKNESS = 14

export type LabelZplInput = {
  productName: string
  price: number
  unitShortform: string
  fields: LabelFields
  payload: Pick<ProductLabelPayload, 'sku' | 'barcode' | 'barcodeInternal'>
  /** Resolved printable code (supplier / internal / auto). */
  barcodeValue?: string | null
  showHumanReadable?: boolean
  amount?: number
  offsetXMm?: number
  offsetYMm?: number
  /** Darkness 0–30; default 14. */
  darkness?: number
  /** Print speed ips; default 2. */
  printSpeed?: number
}

export type LabelZplResult = {
  zpl: string
  symbology: 'EAN13' | 'CODE128' | null
  barcodeFits: boolean
  /** Hint when CODE128 is too wide for 33 mm @ ^BY2. */
  fitWarning: string | null
}

/** Strip ZPL control chars from field data. */
export function escapeZplFd(raw: string): string {
  return raw
    .replace(/[\^~]/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
}

export function mmToDots(mm: number): number {
  return Math.round(mm * ZPL_DOTS_PER_MM)
}

/**
 * Zebra ^BE expects exactly 12 data digits; printer adds check digit.
 * Valid EAN-13 → first 12; otherwise null.
 */
export function ean13Data12ForZpl(code: string): string | null {
  const d = code.replace(/\D/g, '')
  if (d.length === 13 && isValidEan13(d)) return d.slice(0, 12)
  if (d.length === 12) return d
  return null
}

export function ean13TotalWidthDots(moduleDots = ZPL_MODULE_DOTS): number {
  return EAN13_TOTAL_MODULES * moduleDots
}

/** Centered FO X so the full EAN (bars + quiet) stays inside the pad. */
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

/**
 * Centered text block. No JS ellipsis — ^FB wraps; overflow overwrites last line.
 * Order: ^FO → ^A → ^FB → ^FD (Zebra Field Block).
 */
function pushCenteredText(
  lines: string[],
  y: number,
  text: string,
  opts: { fontH: number; fontW: number; maxLines: number; lineGap?: number }
): number {
  const fd = escapeZplFd(text)
  if (!fd) return y
  const gap = opts.lineGap ?? 0
  lines.push(`^FO${ZPL_CONTENT_X},${y}`)
  lines.push(`^A0N,${opts.fontH},${opts.fontW}`)
  lines.push(`^FB${ZPL_CONTENT_W},${opts.maxLines},${gap},C,0`)
  lines.push(`^FD${fd}^FS`)
  const lineH = opts.fontH + 4 + gap
  return y + opts.maxLines * lineH
}

/**
 * Build one ZPL job for 33×25 (may include ^PQ for copies).
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
      barcodeFits = ean13TotalWidthDots() <= ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS
      if (!barcodeFits) {
        fitWarning =
          'Az EAN nem fér quiet zone-nal a címkére — ellenőrizd a médiát / illesztést.'
      }
    } else {
      symbology = 'CODE128'
      barcodeFits = code128Fits33mm(rawBarcode)
      if (!barcodeFits) {
        fitWarning =
          'A gyártói kód túl hosszú 33 mm-en — válaszd a Belső EAN-t a biztos olvasáshoz.'
      }
    }
  }

  const barcodeOnly =
    showBarcode && !showName && !showSku && !showPrice
  const warehouse = showSku && !showName

  let y = 8
  const lines: string[] = [
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

  if (barcodeOnly) {
    const barH = 120
    const barY = Math.max(
      ZPL_PAD_DOTS,
      Math.floor((ZPL_LABEL_H_DOTS - barH) / 2)
    )
    appendBarcode(lines, {
      y: barY,
      height: barH,
      ean12,
      rawBarcode,
      useEan,
      hri: false
    })
  } else if (warehouse) {
    y = pushCenteredText(lines, y, input.payload.sku, {
      fontH: 34,
      fontW: 34,
      maxLines: 1
    })
    y += 4
    if (showPrice) {
      const priceLine = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`
      y = pushCenteredText(lines, y, priceLine, {
        fontH: 26,
        fontW: 26,
        maxLines: 1
      })
      y += 4
    }
    if (showBarcode) {
      const barH = Math.min(72, ZPL_LABEL_H_DOTS - y - ZPL_PAD_DOTS)
      appendBarcode(lines, {
        y,
        height: Math.max(56, barH),
        ean12,
        rawBarcode,
        useEan,
        hri
      })
    }
  } else {
    // Full / shelf: name → sku → price → barcode (all centered)
    if (showName) {
      y = pushCenteredText(lines, y, input.productName || '—', {
        fontH: 20,
        fontW: 20,
        maxLines: 2,
        lineGap: 0
      })
      y += 2
    }
    if (showSku) {
      y = pushCenteredText(lines, y, input.payload.sku, {
        fontH: 26,
        fontW: 26,
        maxLines: 1
      })
      y += 2
    }
    if (showPrice) {
      const priceLine = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`
      y = pushCenteredText(lines, y, priceLine, {
        fontH: 28,
        fontW: 28,
        maxLines: 1
      })
      y += 2
    }
    if (showBarcode) {
      const remaining = ZPL_LABEL_H_DOTS - y - ZPL_PAD_DOTS
      const barH = Math.min(70, Math.max(56, remaining))
      const barY = Math.min(y, ZPL_LABEL_H_DOTS - barH - 4)
      appendBarcode(lines, {
        y: barY,
        height: barH,
        ean12,
        rawBarcode,
        useEan,
        hri
      })
    }
  }

  lines.push(`^PQ${copies},0,1,Y`)
  lines.push('^XZ')

  return {
    zpl: lines.join('\n'),
    symbology,
    barcodeFits,
    fitWarning
  }
}

function appendBarcode(
  lines: string[],
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
  lines.push(`^BY${ZPL_MODULE_DOTS},3,${opts.height}`)

  if (opts.useEan && opts.ean12) {
    const bx = ean13OriginX()
    lines.push(`^FO${bx},${opts.y}^BEN,${opts.height},${hriFlag},N`)
    lines.push(`^FD${opts.ean12}^FS`)
  } else {
    const data = escapeZplFd(opts.rawBarcode)
    const modules = estimateCode128Modules(data)
    const symbolW =
      modules * ZPL_MODULE_DOTS + 2 * CODE128_QUIET_DOTS
    const bx = Math.max(
      ZPL_PAD_DOTS,
      Math.floor((ZPL_LABEL_W_DOTS - Math.min(symbolW, ZPL_CONTENT_W)) / 2)
    )
    lines.push(`^FO${bx},${opts.y}^BCN,${opts.height},${hriFlag},N,N,A`)
    lines.push(`^FD${data}^FS`)
  }
}
