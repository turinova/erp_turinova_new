/**
 * 33×25 mm product label → ZPL II for Zebra ZD220 @ 203 dpi.
 * Barcodes are drawn by the printer (^BE / ^BC) — not raster SVG.
 *
 * Pack priority (space): barcode (scannable) → price → SKU → name (shrinks).
 * No silent drop of checked fields — name shrinks first; packOk=false if still impossible.
 * Uses full content width/height with minimal gaps between text rows.
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import { estimateCode128Modules } from '@/lib/labels/layout'
import type { LabelFields, ProductLabelPayload } from '@/lib/labels/types'

/** 203 dpi: 8 dots per mm. */
export const ZPL_DOTS_PER_MM = 8

export const ZPL_LABEL_W_DOTS = 33 * ZPL_DOTS_PER_MM // 264
export const ZPL_LABEL_H_DOTS = 25 * ZPL_DOTS_PER_MM // 200

/** Edge pad (~1 mm) — maximize printable area. */
export const ZPL_PAD_DOTS = 8

export const ZPL_CONTENT_X = ZPL_PAD_DOTS
export const ZPL_CONTENT_W = ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS // 248

export const ZPL_MODULE_DOTS = 2

/** EAN-13 total modules including quiet (11+95+7). */
export const EAN13_TOTAL_MODULES = 113

const CODE128_QUIET_DOTS = 10

/** Default / dense barcode band when text fields share the label (~7 mm). */
export const ZPL_BARCODE_BAND_DOTS = 56

/** Max barcode band for barcode-only (~17.5 mm). */
export const ZPL_BARCODE_BAND_MAX_DOTS = 140

/** Min scannable barcode height (~6.5 mm). */
export const ZPL_BARCODE_BAND_MIN_DOTS = 52

/** Intra-line leading inside ^FB (dots). */
const LINE_EXTRA = 1

/** Gap between text blocks (dots) — keep minimal. */
const BLOCK_GAP = 0

/** Tiny gap between text zone and barcode. */
const TEXT_BAR_GAP = 2

export const ZPL_DEFAULT_DARKNESS = 14

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
  /** False if a checked field could not fit even after shrinking name. */
  packOk: boolean
  droppedFields: LabelZplFieldId[]
}

type TextBlock = {
  kind: LabelZplFieldId
  text: string
  font: number
  maxLines: number
  lines: number
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

function blockHeight(font: number, lines: number): number {
  return lines * (font + LINE_EXTRA)
}

function totalBlocksHeight(blocks: TextBlock[]): number {
  if (blocks.length === 0) return 0
  let h = 0
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) h += BLOCK_GAP
    h += blockHeight(blocks[i].font, blocks[i].lines)
  }
  return h
}

function barcodeBandDots(textFieldCount: number, barcodeOnly: boolean): number {
  if (barcodeOnly) {
    return Math.min(
      ZPL_BARCODE_BAND_MAX_DOTS,
      ZPL_LABEL_H_DOTS - 2 * ZPL_PAD_DOTS
    )
  }
  if (textFieldCount >= 3) return ZPL_BARCODE_BAND_DOTS
  if (textFieldCount === 2) return 64
  if (textFieldCount === 1) return 72
  return ZPL_BARCODE_BAND_DOTS
}

type PackPlan = {
  blocks: TextBlock[]
  barH: number
  barY: number
  textTop: number
  packOk: boolean
  droppedFields: LabelZplFieldId[]
}

/**
 * Priority packer: reserve barcode, then price → SKU → name.
 * Grow fonts to fill leftover height; never silently drop price/SKU.
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
}): PackPlan {
  const nameText = escapeZplFd(input.productName || '—') || '—'
  const skuText = escapeZplFd(input.sku)
  const priceText = `${formatPrice(input.price)} Ft/${escapeZplFd(input.unitShortform || 'db')}`

  const wantName = input.showName
  const wantSku = input.showSku && Boolean(skuText)
  const wantPrice = input.showPrice
  const wantBarcode = input.showBarcode

  const textFieldCount =
    Number(wantName) + Number(wantSku) + Number(wantPrice)
  const barcodeOnly = wantBarcode && textFieldCount === 0

  const barH = wantBarcode
    ? barcodeBandDots(textFieldCount, barcodeOnly)
    : 0
  const barY = wantBarcode
    ? ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS - barH
    : ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS
  const textTop = ZPL_PAD_DOTS
  const textBottom = wantBarcode
    ? barY - TEXT_BAR_GAP
    : ZPL_LABEL_H_DOTS - ZPL_PAD_DOTS
  const available = Math.max(0, textBottom - textTop)

  if (barcodeOnly || textFieldCount === 0) {
    return {
      blocks: [],
      barH,
      barY: barcodeOnly
        ? Math.max(
            ZPL_PAD_DOTS,
            Math.floor((ZPL_LABEL_H_DOTS - barH) / 2)
          )
        : barY,
      textTop,
      packOk: true,
      droppedFields: []
    }
  }

  // Font ranges — price largest; when tight, shrink name first, then SKU, then price
  const PRICE_MIN = 24
  const PRICE_MAX = 42
  const SKU_MIN = 22
  const SKU_MAX = 38
  const NAME_MIN = 16
  const NAME_MAX = 30

  function buildBlocks(opts: {
    nameFont: number
    nameMaxLines: number
    skuFont: number
    priceFont: number
  }): TextBlock[] {
    const blocks: TextBlock[] = []
    if (wantName) {
      const lines = estimateFbLines(nameText, opts.nameFont, opts.nameMaxLines)
      blocks.push({
        kind: 'name',
        text: nameText,
        font: opts.nameFont,
        maxLines: opts.nameMaxLines,
        lines
      })
    }
    if (wantSku) {
      blocks.push({
        kind: 'sku',
        text: skuText,
        font: opts.skuFont,
        maxLines: 1,
        lines: 1
      })
    }
    if (wantPrice) {
      blocks.push({
        kind: 'price',
        text: priceText,
        font: opts.priceFont,
        maxLines: 1,
        lines: 1
      })
    }
    return blocks
  }

  // 1) Start large; shrink name → SKU → price until it fits
  let nameFont = NAME_MAX
  let nameMaxLines = 2
  let skuFont = SKU_MAX
  let priceFont = PRICE_MAX
  let found: TextBlock[] | null = null

  for (let step = 0; step < 120; step++) {
    const blocks = buildBlocks({
      nameFont: wantName ? nameFont : NAME_MIN,
      nameMaxLines: wantName ? nameMaxLines : 1,
      skuFont: wantSku ? skuFont : SKU_MIN,
      priceFont: wantPrice ? priceFont : PRICE_MIN
    })
    if (totalBlocksHeight(blocks) <= available) {
      found = blocks
      break
    }
    // Shrink priority: name font → name lines → sku → price
    if (wantName && nameFont > NAME_MIN) {
      nameFont -= 2
    } else if (wantName && nameMaxLines > 1) {
      nameMaxLines = 1
      nameFont = NAME_MAX
    } else if (wantSku && skuFont > SKU_MIN) {
      skuFont -= 2
    } else if (wantPrice && priceFont > PRICE_MIN) {
      priceFont -= 2
    } else {
      break
    }
  }

  if (!found) {
    const blocks = buildBlocks({
      nameFont: NAME_MIN,
      nameMaxLines: 1,
      skuFont: SKU_MIN,
      priceFont: PRICE_MIN
    })
    // Drop name first, then SKU — price last
    const dropped: LabelZplFieldId[] = []
    let emergency = blocks
    if (totalBlocksHeight(emergency) > available && wantName) {
      emergency = emergency.filter((b) => b.kind !== 'name')
      dropped.push('name')
    }
    if (totalBlocksHeight(emergency) > available && wantSku) {
      emergency = emergency.filter((b) => b.kind !== 'sku')
      dropped.push('sku')
    }
    if (totalBlocksHeight(emergency) > available && wantPrice) {
      emergency = emergency.filter((b) => b.kind !== 'price')
      dropped.push('price')
    }
    return {
      blocks: emergency,
      barH: Math.max(barH, ZPL_BARCODE_BAND_MIN_DOTS),
      barY,
      textTop,
      packOk: dropped.length === 0,
      droppedFields: dropped
    }
  }

  // 2) Grow fonts to fill leftover height (price → sku → name)
  let blocks = found.map((b) => ({ ...b }))
  const growOrder: LabelZplFieldId[] = ['price', 'sku', 'name']
  let guard = 0
  while (guard++ < 80) {
    const used = totalBlocksHeight(blocks)
    const slack = available - used
    if (slack < 2) break
    let grew = false
    for (const kind of growOrder) {
      const b = blocks.find((x) => x.kind === kind)
      if (!b) continue
      const max =
        kind === 'price' ? PRICE_MAX : kind === 'sku' ? SKU_MAX : NAME_MAX
      if (b.font >= max) continue
      const next = Math.min(max, b.font + 2)
      const trial = blocks.map((x) =>
        x.kind === kind
          ? {
              ...x,
              font: next,
              lines:
                kind === 'name'
                  ? estimateFbLines(x.text, next, x.maxLines)
                  : 1
            }
          : x
      )
      if (totalBlocksHeight(trial) <= available) {
        blocks = trial
        grew = true
        break
      }
    }
    if (!grew) break
  }

  return {
    blocks,
    barH,
    barY,
    textTop,
    packOk: true,
    droppedFields: []
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
    showBarcode
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

  let y = plan.textTop
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i]
    if (i > 0) y += BLOCK_GAP
    y = pushCenteredText(body, y, b.text, {
      fontH: b.font,
      fontW: b.font,
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
