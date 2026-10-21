/**
 * 33×25 mm product label → ZPL II for Zebra ZD220 @ 203 dpi.
 * Barcodes are drawn by the printer (^BE / ^BC) — not raster SVG.
 *
 * %-zone layout: fixed absolute bands (name 28 / SKU 18 / price 22 / barcode 32).
 * Off fields leave a blank slot — other zones do NOT grow (uniform labels).
 * SKU+price always 1 line; name max 2. Exception: barcode-only maximizes the code.
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import { estimateCode128Modules } from '@/lib/labels/layout'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'

/** 203 dpi: 8 dots per mm. */
export const ZPL_DOTS_PER_MM = 8

export const ZPL_LABEL_W_DOTS = 33 * ZPL_DOTS_PER_MM // 264
export const ZPL_LABEL_H_DOTS = 25 * ZPL_DOTS_PER_MM // 200

/** Edge pad (~1 mm). */
export const ZPL_PAD_DOTS = 8

export const ZPL_CONTENT_X = ZPL_PAD_DOTS
export const ZPL_CONTENT_W = ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS // 248

/** Usable vertical budget inside pads. */
export const ZPL_CONTENT_H = ZPL_LABEL_H_DOTS - 2 * ZPL_PAD_DOTS // 184

export const ZPL_MODULE_DOTS = 2

/** EAN-13 total modules including quiet (11+95+7). */
export const EAN13_TOTAL_MODULES = 113

const CODE128_QUIET_DOTS = 10

/** Min scannable barcode height (~6.5 mm). */
export const ZPL_BARCODE_BAND_MIN_DOTS = 52

/** Max barcode for barcode-only. */
export const ZPL_BARCODE_BAND_MAX_DOTS = 140

/** @deprecated alias — zone model uses weights. */
export const ZPL_BARCODE_BAND_DOTS = ZPL_BARCODE_BAND_MIN_DOTS

/** Base zone weights (Teljes). Sum = 100. */
export const ZONE_WEIGHT = {
  name: 28,
  sku: 18,
  price: 22,
  barcode: 32
} as const

const LINE_EXTRA = 1

/** Crisp print. */
export const ZPL_DEFAULT_DARKNESS = 11

const NAME_WIDTH_RATIO = 0.82
const SKU_WIDTH_RATIO = 0.88
const PRICE_WIDTH_RATIO = 0.9

const NAME_FONT_MAX = 28
const SKU_FONT_MAX = 36
const PRICE_FONT_MAX = 40
const FONT_MIN = 14

/** HRI eats a few dots from barcode zone. */
const HRI_RESERVE_DOTS = 10

export type LabelZplFieldId = 'name' | 'sku' | 'price'

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
  packOk: boolean
  droppedFields: LabelZplFieldId[]
}

type TextBlock = {
  kind: LabelZplFieldId
  text: string
  fontH: number
  fontW: number
  maxLines: number
  lines: number
  /** Absolute ^FO Y (top of text / first line). */
  y: number
  zoneY: number
  zoneH: number
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

function fontWidth(kind: LabelZplFieldId, fontH: number): number {
  const ratio =
    kind === 'name'
      ? NAME_WIDTH_RATIO
      : kind === 'sku'
        ? SKU_WIDTH_RATIO
        : PRICE_WIDTH_RATIO
  return Math.max(10, Math.round(fontH * ratio))
}

export function estimateFbLines(
  text: string,
  fontW: number,
  maxLines: number
): number {
  const t = escapeZplFd(text)
  if (!t) return 0
  const charsPerLine = Math.max(6, Math.floor(ZPL_CONTENT_W / (fontW * 0.52)))
  const raw = Math.ceil(t.length / charsPerLine)
  return Math.min(maxLines, Math.max(1, raw))
}

function blockHeight(fontH: number, lines: number): number {
  return lines * (fontH + LINE_EXTRA)
}

type ZoneId = 'name' | 'sku' | 'price' | 'barcode'

type PackPlan = {
  blocks: TextBlock[]
  barH: number
  barY: number
  /** First text Y (compat / diagnostics). */
  textTop: number
  packOk: boolean
  droppedFields: LabelZplFieldId[]
  /** Allocated zone heights (active only). */
  zones: Partial<Record<ZoneId, { y: number; h: number }>>
}

/** Largest-remainder allocation of `total` dots by weights. */
export function allocateZoneDots(
  weights: Partial<Record<ZoneId, number>>,
  total: number
): Record<ZoneId, number> {
  const entries = (Object.keys(weights) as ZoneId[]).filter(
    (k) => (weights[k] ?? 0) > 0
  )
  const result: Record<ZoneId, number> = {
    name: 0,
    sku: 0,
    price: 0,
    barcode: 0
  }
  if (entries.length === 0 || total <= 0) return result

  const sumW = entries.reduce((s, k) => s + (weights[k] ?? 0), 0)
  const exact = entries.map((k) => ({
    k,
    raw: ((weights[k] ?? 0) / sumW) * total,
    floor: 0,
    frac: 0
  }))
  let used = 0
  for (const e of exact) {
    e.floor = Math.floor(e.raw)
    e.frac = e.raw - e.floor
    used += e.floor
  }
  let rem = total - used
  exact.sort((a, b) => b.frac - a.frac)
  for (const e of exact) {
    if (rem <= 0) break
    e.floor += 1
    rem -= 1
  }
  for (const e of exact) result[e.k] = e.floor
  return result
}

/**
 * Fixed %-zone packer. SKU/price = 1 line; name ≤ 2 lines.
 * All four slots always keep Teljes heights; off fields leave blank space
 * so price/barcode stay in the same place across labels.
 */
export function packLabel33x25(input: {
  productName: string
  price: number
  unitShortform: string
  sku: string
  showName: boolean
  showSku: boolean
  showPrice: boolean
  showBarcode: boolean
  showHumanReadable?: boolean
}): PackPlan {
  const nameText = escapeZplFd(input.productName || '—') || '—'
  const skuText = escapeZplFd(input.sku)
  const priceText = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`

  const wantName = input.showName
  const wantSku = input.showSku && Boolean(skuText)
  const wantPrice = input.showPrice
  const wantBarcode = input.showBarcode
  const hri = Boolean(input.showHumanReadable)

  const contentTop = ZPL_PAD_DOTS
  const contentH = ZPL_CONTENT_H

  // Barcode-only: maximize code, center vertically (dedicated template)
  if (wantBarcode && !wantName && !wantSku && !wantPrice) {
    const barH = Math.min(ZPL_BARCODE_BAND_MAX_DOTS, contentH)
    const barY = contentTop + Math.floor((contentH - barH) / 2)
    return {
      blocks: [],
      barH,
      barY,
      textTop: contentTop,
      packOk: true,
      droppedFields: [],
      zones: { barcode: { y: barY, h: barH } }
    }
  }

  // No fields at all
  if (!wantName && !wantSku && !wantPrice && !wantBarcode) {
    return {
      blocks: [],
      barH: 0,
      barY: contentTop + contentH,
      textTop: contentTop,
      packOk: true,
      droppedFields: [],
      zones: {}
    }
  }

  // Always allocate the full Teljes grid — never redistribute into active fields
  const heights = allocateZoneDots({ ...ZONE_WEIGHT }, contentH)

  // HRI reserve inside barcode zone (draw height only; slot stays fixed)
  let barDrawH = heights.barcode
  if (wantBarcode && hri && barDrawH > HRI_RESERVE_DOTS + 40) {
    barDrawH = heights.barcode - HRI_RESERVE_DOTS
  } else if (wantBarcode && hri) {
    barDrawH = Math.max(40, heights.barcode - 6)
  }

  // Fixed slots top → bottom (blank if field off)
  const order: ZoneId[] = ['name', 'sku', 'price', 'barcode']
  const zones: Partial<Record<ZoneId, { y: number; h: number }>> = {}
  let yCursor = contentTop
  for (const id of order) {
    const h = heights[id] ?? 0
    zones[id] = { y: yCursor, h }
    yCursor += h
  }

  const blocks: TextBlock[] = []
  const dropped: LabelZplFieldId[] = []

  function fitTextInZone(
    kind: LabelZplFieldId,
    text: string,
    zone: { y: number; h: number },
    maxLines: number,
    fontMax: number
  ): TextBlock | null {
    const inner = Math.max(FONT_MIN, zone.h - 2)
    // Prefer 1 line at largest font that fits zone; name may use 2
    let lines = 1
    let fontH = Math.min(fontMax, inner)
    let fontW = fontWidth(kind, fontH)
    let used = estimateFbLines(text, fontW, 1)

    if (kind === 'name' && maxLines >= 2) {
      // If 1-line at this font would wrap beyond 1, switch to 2-line mode
      if (used > 1 || estimateFbLines(text, fontW, 2) > 1) {
        lines = 2
        fontH = Math.min(fontMax, Math.max(FONT_MIN, Math.floor((inner - LINE_EXTRA) / 2)))
        fontW = fontWidth(kind, fontH)
        used = estimateFbLines(text, fontW, 2)
      }
    }

    // Shrink until block fits in zone (SKU/price stay 1 line)
    while (blockHeight(fontH, used) > zone.h && fontH > FONT_MIN) {
      fontH -= 2
      fontW = fontWidth(kind, fontH)
      used = estimateFbLines(text, fontW, kind === 'name' ? maxLines : 1)
      if (kind !== 'name') used = 1
      else lines = used
    }

    if (kind !== 'name') {
      lines = 1
      used = 1
    } else {
      lines = Math.min(maxLines, Math.max(1, used))
    }

    const textH = blockHeight(fontH, lines)
    // Vertically center block in zone (1-line); 2-line name from top+1 of zone
    const y =
      lines === 1
        ? zone.y + Math.max(0, Math.floor((zone.h - textH) / 2))
        : zone.y + Math.max(0, Math.floor((zone.h - textH) / 2))

    return {
      kind,
      text,
      fontH,
      fontW,
      maxLines: kind === 'name' ? 2 : 1,
      lines,
      y,
      zoneY: zone.y,
      zoneH: zone.h
    }
  }

  if (wantName && zones.name) {
    const b = fitTextInZone('name', nameText, zones.name, 2, NAME_FONT_MAX)
    if (b) blocks.push(b)
    else dropped.push('name')
  }
  if (wantSku && zones.sku) {
    const b = fitTextInZone('sku', skuText, zones.sku, 1, SKU_FONT_MAX)
    if (b) blocks.push(b)
    else dropped.push('sku')
  }
  if (wantPrice && zones.price) {
    const b = fitTextInZone('price', priceText, zones.price, 1, PRICE_FONT_MAX)
    if (b) blocks.push(b)
    else dropped.push('price')
  }

  const barZone = zones.barcode
  const barY = barZone?.y ?? contentTop + contentH
  const barH = wantBarcode ? (barZone ? barDrawH : 0) : 0
  // Center barcode symbol inside its zone if zone taller than draw height
  const barYDraw =
    barZone && barH < barZone.h
      ? barZone.y + Math.floor((barZone.h - barH) / 2)
      : barY

  const textTop =
    blocks.length > 0
      ? Math.min(...blocks.map((b) => b.y))
      : contentTop

  return {
    blocks,
    barH,
    barY: barYDraw,
    textTop,
    packOk: dropped.length === 0,
    droppedFields: dropped,
    zones
  }
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
  return y + blockHeight(opts.fontH, usedLines)
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

  const plan = packLabel33x25({
    productName: input.productName,
    price: input.price,
    unitShortform: input.unitShortform,
    sku: input.payload.sku?.trim() || '',
    showName,
    showSku,
    showPrice,
    showBarcode,
    showHumanReadable: hri
  })

  if (!plan.packOk && plan.droppedFields.length > 0) {
    const labels = plan.droppedFields
      .map((f) =>
        f === 'name' ? 'Név' : f === 'sku' ? 'SKU' : 'Ár'
      )
      .join(', ')
    fitWarning =
      fitWarning ??
      `Nem fér minden mező a címkére (kihagyva: ${labels}). Kapcsolj ki egy mezőt.`
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

  if (showBarcode && plan.barH > 0) {
    appendBarcode(body, {
      y: plan.barY,
      height: plan.barH,
      ean12,
      rawBarcode,
      useEan,
      hri: plan.blocks.length === 0 ? false : hri
    })
  }

  for (const b of plan.blocks) {
    pushCenteredText(body, b.y, b.text, {
      fontH: b.fontH,
      fontW: b.fontW,
      maxLines: b.maxLines,
      lineGap: 0
    })
  }

  const lines = [...header, ...body, `^PQ${copies},0,1,Y`, '^XZ']

  return {
    zpl: lines.join('\n'),
    symbology,
    barcodeFits,
    fitWarning,
    packOk: plan.packOk,
    droppedFields: plan.droppedFields
  }
}
