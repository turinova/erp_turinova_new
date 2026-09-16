import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'

export type LabelTemplateId = 'full' | 'shelf' | 'barcode' | 'price'

export const LABEL_TEMPLATES: Array<{
  id: LabelTemplateId
  label: string
  hint: string
  fields: (hasBarcode: boolean) => LabelFields
}> = [
  {
    id: 'full',
    label: 'Teljes',
    hint: 'Név, SKU, ár, kód',
    fields: (hasBarcode) => ({
      showName: true,
      showSku: true,
      showPrice: true,
      showBarcode: hasBarcode
    })
  },
  {
    id: 'shelf',
    label: 'Polc',
    hint: 'Név, ár, kód',
    fields: (hasBarcode) => ({
      showName: true,
      showSku: false,
      showPrice: true,
      showBarcode: hasBarcode
    })
  },
  {
    id: 'barcode',
    label: 'Csak kód',
    hint: 'Max vonalkód',
    fields: (hasBarcode) => ({
      showName: false,
      showSku: false,
      showPrice: false,
      showBarcode: hasBarcode
    })
  },
  {
    id: 'price',
    label: 'Ár címke',
    hint: 'Név + ár',
    fields: () => ({
      showName: true,
      showSku: false,
      showPrice: true,
      showBarcode: false
    })
  }
]

export type LabelBlockLayout = {
  rowMm: number
  /** Primary text size for the block (name / sku / price amount). */
  fontMm: number
  /** Secondary (unit under price, human-readable under barcode). */
  secondaryFontMm: number
}

export type LabelLayout = {
  padTopMm: number
  padSideMm: number
  padBottomMm: number
  gapMm: number
  name: LabelBlockLayout | null
  sku: LabelBlockLayout | null
  price: LabelBlockLayout | null
  barcode: LabelBlockLayout | null
  showHumanReadable: boolean
}

const FLOOR_33 = {
  name: 3.4,
  sku: 2.0,
  price: 4.4,
  barcode: 5.0
} as const

/**
 * Conservative glyph width for bold UI sans (mm per font-mm).
 * Higher = fewer chars/line = more lines reserved (avoids under-wrap).
 */
const CHAR_WIDTH_FACTOR = 0.62
const NAME_MAX_LINES = 3
const NAME_MIN_FONT = 1.45

function desiredNameFont(text: string): number {
  const len = text.trim().length
  let base = 3.2
  if (len > 70) base = 1.8
  else if (len > 50) base = 2.1
  else if (len > 35) base = 2.4
  else if (len > 22) base = 2.7
  return Number(base.toFixed(2))
}

function desiredPriceFont(price: number): number {
  const digits = new Intl.NumberFormat('hu-HU').format(price).length
  let base = 5.4
  if (digits > 8) base = 3.8
  else if (digits > 6) base = 4.4
  else if (digits > 5) base = 4.8
  return Number(base.toFixed(2))
}

/** Uncapped wrap estimate from content width. */
function nameLinesForWidth(
  text: string,
  fontMm: number,
  contentWidthMm: number
): number {
  const len = Math.max(1, text.trim().length)
  const charsPerLine = Math.max(
    4,
    Math.floor(contentWidthMm / (Math.max(1.2, fontMm) * CHAR_WIDTH_FACTOR))
  )
  return Math.max(1, Math.ceil(len / charsPerLine))
}

function nameContentMm(fontMm: number, lines: number): number {
  return fontMm * 1.15 * lines + 0.35
}

function skuContentMm(fontMm: number): number {
  return fontMm + 0.55
}

function priceContentMm(fontMm: number, unitFontMm: number): number {
  return fontMm + unitFontMm + 0.7
}

function barcodeContentMinMm(human: boolean): number {
  return 4.8 + (human ? 2.0 : 0.3)
}

/**
 * Fit full product name: shrink font until wrap ≤ NAME_MAX_LINES.
 * Never truncates — smaller type instead of ellipsis.
 */
function resolveNameBlock(
  text: string,
  desiredFont: number,
  contentWidthMm: number,
  floorName: number,
  maxContentMm?: number
): { fontDes: number; lines: number; contentMin: number } {
  let font = desiredFont
  for (let i = 0; i < 36; i++) {
    const rawLines = nameLinesForWidth(text, font, contentWidthMm)
    if (rawLines > NAME_MAX_LINES && font > NAME_MIN_FONT) {
      font = Number((font * 0.9).toFixed(2))
      continue
    }
    const lines = Math.min(NAME_MAX_LINES, rawLines)
    const content = nameContentMm(font, lines)
    if (
      maxContentMm != null &&
      content > maxContentMm + 0.05 &&
      font > NAME_MIN_FONT
    ) {
      font = Number((font * 0.92).toFixed(2))
      continue
    }
    return {
      fontDes: Number(Math.max(NAME_MIN_FONT, font).toFixed(2)),
      lines,
      contentMin: Math.max(floorName, content)
    }
  }
  const lines = Math.min(
    NAME_MAX_LINES,
    nameLinesForWidth(text, font, contentWidthMm)
  )
  return {
    fontDes: Number(Math.max(NAME_MIN_FONT, font).toFixed(2)),
    lines,
    contentMin: Math.max(floorName, nameContentMm(font, lines))
  }
}

function clampFontToRow(
  desiredFont: number,
  rowMm: number,
  contentFn: (font: number) => number
): number {
  let font = desiredFont
  for (let i = 0; i < 24; i++) {
    if (contentFn(font) <= rowMm) return Number(font.toFixed(2))
    font *= 0.92
    if (font < 1.2) break
  }
  return Number(Math.max(1.2, font).toFixed(2))
}

/**
 * Single layout engine: row heights + fonts with content guards.
 * Name wrap is width-aware; leftover prefers name fit, then barcode.
 */
export function computeLabelLayout(input: {
  size: LabelSize
  fields: LabelFields
  productName: string
  price: number
  payload: ProductLabelPayload
}): LabelLayout {
  const floor = FLOOR_33
  const { w, h } = labelSizeMm(input.size)

  const padTopMm = 1.0
  const padSideMm = 1.2
  const padBottomMm = 0.5

  const barcodeVal = labelBarcodeValue(input.payload)
  const showName = input.fields.showName
  const showSku = input.fields.showSku && Boolean(input.payload.sku?.trim())
  const showPrice = input.fields.showPrice
  const showBarcode = input.fields.showBarcode && Boolean(barcodeVal)
  const showHumanReadable = showBarcode

  // Shelf-like (name adjacent to price): slightly larger gap
  const gapMm = !showSku && showName && showPrice ? 0.55 : 0.35

  const text = input.productName.trim() || input.payload.name || '—'
  const contentWidthMm = Math.max(8, w - padSideMm * 2)

  const visibleCount =
    Number(showName) + Number(showSku) + Number(showPrice) + Number(showBarcode)
  const gapsTotal = Math.max(0, visibleCount - 1) * gapMm
  const available = Math.max(4, h - padTopMm - padBottomMm - gapsTotal)

  const nameResolved = showName
    ? resolveNameBlock(
        text,
        desiredNameFont(text),
        contentWidthMm,
        floor.name
      )
    : { fontDes: 0, lines: 1, contentMin: 0 }

  const skuFontDes = 2.2
  // Soft-cap price when sitting directly under name (no SKU buffer)
  let priceFontDes = desiredPriceFont(input.price)
  if (!showSku && showName && showPrice) {
    priceFontDes = Number((priceFontDes * 0.92).toFixed(2))
  }
  const unitFontDes = 1.85

  let nameMin = showName ? nameResolved.contentMin : 0
  let skuMin = showSku ? Math.max(floor.sku, skuContentMm(skuFontDes)) : 0
  let priceMin = showPrice
    ? Math.max(floor.price, priceContentMm(priceFontDes, unitFontDes))
    : 0
  const barcodeMin = showBarcode
    ? Math.max(floor.barcode, barcodeContentMinMm(showHumanReadable))
    : 0

  let nameRow = showName ? nameMin : 0
  let skuRow = showSku ? skuMin : 0
  let priceRow = showPrice ? priceMin : 0
  let barcodeRow = 0

  const fixed = nameRow + skuRow + priceRow

  if (showBarcode) {
    const rem = available - fixed
    if (rem >= barcodeMin) {
      let extra = rem - barcodeMin
      barcodeRow = barcodeMin
      if (extra > 0.05 && showName) {
        const need = nameContentMm(nameResolved.fontDes, nameResolved.lines)
        const deficit = Math.max(0, need - nameRow)
        const give = Math.min(extra, deficit)
        nameRow = Number((nameRow + give).toFixed(2))
        extra -= give
      }
      barcodeRow = Number((barcodeMin + extra).toFixed(2))
    } else {
      const floorsSum =
        floor.name * Number(showName) +
        floor.sku * Number(showSku) +
        floor.price * Number(showPrice)
      const budget = Math.max(floorsSum, available - barcodeMin)
      const squeeze = fixed > 0 ? Math.min(1, budget / fixed) : 1
      nameRow = showName
        ? Math.max(floor.name, Number((nameMin * squeeze).toFixed(2)))
        : 0
      skuRow = showSku
        ? Math.max(floor.sku, Number((skuMin * squeeze).toFixed(2)))
        : 0
      priceRow = showPrice
        ? Math.max(floor.price, Number((priceMin * squeeze).toFixed(2)))
        : 0
      barcodeRow = Math.max(
        barcodeMin,
        available - nameRow - skuRow - priceRow
      )
      const sum = nameRow + skuRow + priceRow + barcodeRow
      if (sum > available + 0.01) {
        const s = available / sum
        nameRow = showName ? Number((nameRow * s).toFixed(2)) : 0
        skuRow = showSku ? Number((skuRow * s).toFixed(2)) : 0
        priceRow = showPrice ? Number((priceRow * s).toFixed(2)) : 0
        barcodeRow = Number((barcodeRow * s).toFixed(2))
      }
    }
  } else if (fixed > 0) {
    const leftover = Math.max(0, available - fixed)
    if (leftover > 0.15) {
      const wName = showName ? 1.3 : 0
      const wSku = showSku ? 0.35 : 0
      const wPrice = showPrice ? 1.5 : 0
      const wSum = wName + wSku + wPrice || 1
      if (showName)
        nameRow = Number((nameMin + (leftover * wName) / wSum).toFixed(2))
      if (showSku)
        skuRow = Number((skuMin + (leftover * wSku) / wSum).toFixed(2))
      if (showPrice)
        priceRow = Number((priceMin + (leftover * wPrice) / wSum).toFixed(2))
    }
  }

  // Fit full name into allocated row (shrink font; never ellipsis-truncate)
  let nameFont = 0
  if (showName) {
    const fitted = resolveNameBlock(
      text,
      nameResolved.fontDes,
      contentWidthMm,
      floor.name,
      nameRow
    )
    nameFont = fitted.fontDes
    // If still short on height at min font, steal from barcode (keep barcode floor)
    const need = nameContentMm(nameFont, fitted.lines)
    if (need > nameRow + 0.05 && showBarcode && barcodeRow > barcodeMin) {
      const steal = Math.min(barcodeRow - barcodeMin, need - nameRow)
      nameRow = Number((nameRow + steal).toFixed(2))
      barcodeRow = Number((barcodeRow - steal).toFixed(2))
    }
    // Final pass after possible steal
    nameFont = resolveNameBlock(
      text,
      nameFont,
      contentWidthMm,
      floor.name,
      nameRow
    ).fontDes
  }

  const skuFont = showSku
    ? clampFontToRow(skuFontDes, skuRow, skuContentMm)
    : 0
  const priceFont = showPrice
    ? clampFontToRow(priceFontDes, priceRow, (f) =>
        priceContentMm(f, Math.min(unitFontDes, f * 0.4))
      )
    : 0
  const unitFont = showPrice
    ? Number(Math.min(unitFontDes, Math.max(1.4, priceFont * 0.38)).toFixed(2))
    : 0

  const priceFontFinal =
    showPrice && priceContentMm(priceFont, unitFont) > priceRow
      ? clampFontToRow(priceFont, priceRow, (f) =>
          priceContentMm(f, Math.min(unitFont, f * 0.38))
        )
      : priceFont

  const barcodeSecondary = showHumanReadable ? 1.7 : 0

  return {
    padTopMm,
    padSideMm,
    padBottomMm,
    gapMm,
    name: showName
      ? {
          rowMm: nameRow,
          fontMm: nameFont,
          secondaryFontMm: 0
        }
      : null,
    sku: showSku
      ? { rowMm: skuRow, fontMm: skuFont, secondaryFontMm: 0 }
      : null,
    price: showPrice
      ? {
          rowMm: priceRow,
          fontMm: priceFontFinal,
          secondaryFontMm: unitFont
        }
      : null,
    barcode: showBarcode
      ? {
          rowMm: barcodeRow,
          fontMm: 0,
          secondaryFontMm: barcodeSecondary
        }
      : null,
    showHumanReadable
  }
}

/** @deprecated — use computeLabelLayout */
export function computeLabelRowHeights(input: {
  size: LabelSize
  fields: LabelFields
  productName: string
  payload: ProductLabelPayload
}) {
  const layout = computeLabelLayout({
    ...input,
    price: 0
  })
  return {
    padTopMm: layout.padTopMm,
    padSideMm: layout.padSideMm,
    nameMm: layout.name?.rowMm ?? null,
    skuMm: layout.sku?.rowMm ?? null,
    priceMm: layout.price?.rowMm ?? null,
    barcodeMm: layout.barcode?.rowMm ?? null,
    showHumanReadable: layout.showHumanReadable
  }
}

export function nameFontMm(text: string, _size?: LabelSize): number {
  return desiredNameFont(text)
}

export function priceAmountFontMm(price: number, _size?: LabelSize): number {
  return desiredPriceFont(price)
}
