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

/**
 * GS1 EAN-13: left quiet 11 + bars 95 + right quiet 7.
 * Zebra ^BE / zebrash: ^FO is the left edge of the *visible bars* (quiet is
 * outside the symbol width). Center bars on ZPL_LABEL_CENTER_X.
 */
export const EAN13_LEFT_QUIET_MODULES = 11
export const EAN13_BAR_MODULES = 95
export const EAN13_RIGHT_QUIET_MODULES = 7
/** EAN-13 total modules including quiet (11+95+7) — scan geometry / docs. */
export const EAN13_TOTAL_MODULES =
  EAN13_LEFT_QUIET_MODULES + EAN13_BAR_MODULES + EAN13_RIGHT_QUIET_MODULES

/** Horizontal center of the label (text ^FB and barcode bars share this). */
export const ZPL_LABEL_CENTER_X = Math.floor(ZPL_LABEL_W_DOTS / 2)

/** Extra quiet for CODE128 fit checks only — not part of ^FO width (zebrash). */
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

/**
 * ^A0 width/height. Must stay 1.0 — condensed (fontW < fontH) breaks ^FB
 * center alignment in zebrash (scaleX distorts block width) and looks off-axis.
 */
const NAME_WIDTH_RATIO = 1
const SKU_WIDTH_RATIO = 1
const PRICE_WIDTH_RATIO = 1

const NAME_FONT_MAX = 28
const SKU_FONT_MAX = 36
const PRICE_FONT_MAX = 40
const FONT_MIN = 14

/**
 * Clerk-proof hard cap for 33×25 name (≤2 lines at readable ^A0).
 * ~2×16 chars @ font 24 with conservative Helvetica advance.
 * Master product name may be longer (200); label dialog + ZPL clamp here.
 */
export const LABEL_NAME_MAX_CHARS = 36

/**
 * Average glyph advance / em for ^A0 Helvetica-Bold (zebrash + Zebra).
 * Was 0.52 (too optimistic → 3-line overflow into SKU).
 */
export const FB_CHAR_WIDTH_FACTOR = 0.62

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

/** Editable field: strip ZPL-hostile chars and hard-cap (no ellipsis). */
export function truncateLabelNameInput(raw: string): string {
  return escapeZplFd(raw).slice(0, LABEL_NAME_MAX_CHARS)
}

/**
 * Deterministic label name for preview + ZPL — never silent printer clip.
 * Over-limit → hard truncate + ellipsis (counts toward max).
 */
export function clampLabelName(raw: string): string {
  const t = escapeZplFd(raw)
  if (!t) return '—'
  if (t.length <= LABEL_NAME_MAX_CHARS) return t
  const body = t.slice(0, LABEL_NAME_MAX_CHARS - 1).trimEnd()
  return `${body}…`
}

export function mmToDots(mm: number): number {
  return Math.round(mm * ZPL_DOTS_PER_MM)
}

export function dotsToMm(dots: number): number {
  return dots / ZPL_DOTS_PER_MM
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

/**
 * ^FO X for EAN-13 — FO is left of visible bars (not quiet). Bars center =
 * ZPL_LABEL_CENTER_X (same axis as ^FB text).
 */
export function ean13OriginX(moduleDots = ZPL_MODULE_DOTS): number {
  const barW = EAN13_BAR_MODULES * moduleDots
  let fo = ZPL_LABEL_CENTER_X - Math.floor(barW / 2)
  const maxFo = Math.max(0, ZPL_LABEL_W_DOTS - barW)
  fo = Math.max(0, Math.min(maxFo, fo))
  return fo
}

/** Center of EAN visible bars for the FO returned by ean13OriginX. */
export function ean13BarsCenterX(moduleDots = ZPL_MODULE_DOTS): number {
  const barW = EAN13_BAR_MODULES * moduleDots
  return ean13OriginX(moduleDots) + Math.floor(barW / 2)
}

/**
 * ^FO X for CODE128 — FO is left of encoded bars (zebrash/Zebra); quiet is
 * outside. Center bar width on ZPL_LABEL_CENTER_X.
 */
export function code128OriginX(
  value: string,
  moduleDots = ZPL_MODULE_DOTS
): number {
  const modules = estimateCode128Modules(value)
  const barW = modules * moduleDots
  let fo = ZPL_LABEL_CENTER_X - Math.floor(barW / 2)
  const maxFo = Math.max(0, ZPL_LABEL_W_DOTS - barW)
  fo = Math.max(0, Math.min(maxFo, fo))
  return fo
}

/** Center of CODE128 bars for diagnostics / tests. */
export function code128BarsCenterX(
  value: string,
  moduleDots = ZPL_MODULE_DOTS
): number {
  const modules = estimateCode128Modules(value)
  const barW = modules * moduleDots
  return code128OriginX(value, moduleDots) + Math.floor(barW / 2)
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

/** How many characters fit on one ^FB line at this font width. */
export function fbCharsPerLine(fontW: number): number {
  const w = Math.max(8, fontW)
  return Math.max(4, Math.floor(ZPL_CONTENT_W / (w * FB_CHAR_WIDTH_FACTOR)))
}

/** Uncapped line count (for shrink loops). */
export function estimateFbLinesRaw(text: string, fontW: number): number {
  const t = escapeZplFd(text)
  if (!t) return 0
  return Math.max(1, Math.ceil(t.length / fbCharsPerLine(fontW)))
}

export function estimateFbLines(
  text: string,
  fontW: number,
  maxLines: number
): number {
  return Math.min(maxLines, estimateFbLinesRaw(text, fontW))
}

/**
 * Hard-truncate so text never needs more than maxLines at fontW.
 * Prevents zebrash/^FB from painting into the next zone.
 */
export function fitTextToFbLines(
  text: string,
  fontW: number,
  maxLines: number
): string {
  const t = escapeZplFd(text)
  if (!t) return '—'
  const budget = fbCharsPerLine(fontW) * Math.max(1, maxLines)
  if (t.length <= budget) return t
  if (budget <= 1) return '…'
  return `${t.slice(0, budget - 1).trimEnd()}…`
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
  const nameText = clampLabelName(input.productName || '—')
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
    const hardMax = kind === 'name' ? Math.min(2, maxLines) : 1

    // Prefer 1 line at largest font; name may use 2 if needed
    let lines = 1
    let fontH = Math.min(fontMax, inner)
    let fontW = fontWidth(kind, fontH)

    if (kind === 'name' && hardMax >= 2 && estimateFbLinesRaw(text, fontW) > 1) {
      lines = 2
      fontH = Math.min(
        fontMax,
        Math.max(FONT_MIN, Math.floor((inner - LINE_EXTRA) / 2))
      )
      fontW = fontWidth(kind, fontH)
    }

    // Shrink until raw wrap ≤ hardMax (or FONT_MIN), then hard-truncate
    while (
      estimateFbLinesRaw(text, fontW) > hardMax &&
      fontH > FONT_MIN
    ) {
      fontH -= 2
      fontW = fontWidth(kind, fontH)
      if (kind === 'name' && hardMax >= 2) lines = 2
    }

    // Zone height shrink (SKU/price stay 1 line)
    let fitted = fitTextToFbLines(text, fontW, hardMax)
    let used = estimateFbLines(fitted, fontW, hardMax)
    while (blockHeight(fontH, used) > zone.h && fontH > FONT_MIN) {
      fontH -= 2
      fontW = fontWidth(kind, fontH)
      fitted = fitTextToFbLines(text, fontW, hardMax)
      used = estimateFbLines(fitted, fontW, hardMax)
    }

    lines = kind === 'name' ? Math.min(hardMax, Math.max(1, used)) : 1
    fitted = fitTextToFbLines(text, fontW, lines)
    used = estimateFbLines(fitted, fontW, lines)
    if (kind !== 'name') {
      lines = 1
      used = 1
    }

    const textH = blockHeight(fontH, lines)
    const y = zone.y + Math.max(0, Math.floor((zone.h - textH) / 2))

    return {
      kind,
      text: fitted,
      fontH,
      fontW,
      maxLines: hardMax,
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
  // Text is already fitTextToFbLines'd in the packer — still re-fit as safety net
  const fd = fitTextToFbLines(text, opts.fontW, opts.maxLines)
  if (!fd) return y
  const gap = opts.lineGap ?? 0
  const usedLines = Math.min(
    opts.maxLines,
    Math.max(1, estimateFbLines(fd, opts.fontW, opts.maxLines))
  )
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
    const bx = code128OriginX(data)
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
