import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'

export type LabelTemplateId = 'full' | 'sku' | 'shelf' | 'barcode' | 'price'

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
    id: 'sku',
    label: 'Nagy SKU',
    hint: 'SKU, ár, kód (nincs név)',
    fields: (hasBarcode) => ({
      showName: false,
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
  /** Extra inset beyond pad — print tolerance (Brother/DYMO shift). */
  safetyInsetMm: number
  gapMm: number
  /** CODE128 quiet zone each side (mm), inside content width. */
  quietZoneMm: number
  name: LabelBlockLayout | null
  sku: LabelBlockLayout | null
  price: LabelBlockLayout | null
  barcode: LabelBlockLayout | null
  showHumanReadable: boolean
}

/** CSS px per mm at 96dpi — preview + print barcode SVG use the same base. */
export const LABEL_PX_PER_MM = 96 / 25.4

/**
 * Absolute min narrow-bar width (mm) for handheld POS on 33×25.
 * GS1 ideal ≥0.25; EAN-13 as CODE128C on this width lands ~0.21 — allow 0.20.
 */
export const BARCODE_MIN_X_MM = 0.2

/** Prefer at least this bar height (mm) when barcode is shown. */
export const BARCODE_TARGET_HEIGHT_MM = 8.0

/** Hard floor — below this, refuse print. */
export const BARCODE_ABSOLUTE_MIN_HEIGHT_MM = 5.5

/**
 * Scan-safe floors for 33×25: barcode first, then price/SKU, name shrinks.
 * HRI off by default → barcode floor is bars-only.
 * SKU floor ~3.2 mm — warehouse pick readability (was 2.5).
 */
const FLOOR_33 = {
  name: 2.8,
  sku: 3.2,
  /** Room for amount + readable unit line (~2.1 mm). */
  price: 4.8,
  barcode: 7.5,
  barcodeWithHuman: 9.2
} as const

/** Desired SKU font (mm) on 33×25 when space allows. */
export const SKU_DESIRED_FONT_MM = 3.6

/** Balanced pads — avoid top-starved / bottom-empty print look. */
const PAD = {
  top: 1.05,
  side: 1.0,
  bottom: 0.45,
  safety: 0.35
} as const

/** Minimum unit font on thermal (mm) — opacity/size for /db readability. */
export const UNIT_MIN_FONT_MM = 2.0

/**
 * Conservative glyph width for bold UI sans (mm per font-mm).
 * Higher = fewer chars/line = more lines reserved (avoids under-wrap).
 */
const CHAR_WIDTH_FACTOR = 0.62
/** With barcode + SKU: 1 line name — frees height for larger SKU. */
const NAME_MAX_LINES_WITH_BARCODE_AND_SKU = 1
const NAME_MAX_LINES_WITH_BARCODE = 2
const NAME_MAX_LINES_NO_BARCODE = 3
const NAME_MIN_FONT = 1.55

function desiredNameFont(text: string): number {
  const len = text.trim().length
  let base = 3.0
  if (len > 70) base = 1.75
  else if (len > 50) base = 2.0
  else if (len > 35) base = 2.3
  else if (len > 22) base = 2.55
  return Number(base.toFixed(2))
}

function desiredPriceFont(price: number): number {
  const digits = new Intl.NumberFormat('hu-HU').format(price).length
  let base = 5.2
  if (digits > 8) base = 3.6
  else if (digits > 6) base = 4.2
  else if (digits > 5) base = 4.6
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
  return fontMm * 1.12 * lines + 0.2
}

function skuContentMm(fontMm: number): number {
  return fontMm + 0.35
}

function priceContentMm(fontMm: number, unitFontMm: number): number {
  return fontMm + unitFontMm + 0.35
}

function barcodeContentMinMm(human: boolean): number {
  // Bars-only floor; HRI adds secondary line under bars.
  return human ? FLOOR_33.barcodeWithHuman : FLOOR_33.barcode
}

/**
 * CODE128 symbol width in modules (excluding quiet zones).
 * Matches jsbarcode auto subset: pure digits → Code C (2 digits/symbol);
 * otherwise Code B (1 char/symbol). Stop = 13 modules.
 */
export function estimateCode128Modules(value: string): number {
  const raw = value.trim()
  if (!raw) return 11 + 11 + 13 // start + check + stop

  const isDigits = /^\d+$/.test(raw)
  // Symbol chars excluding Stop; each is 11 modules; Stop adds 13 (= +2 over 11).
  let dataSymbols: number
  if (isDigits) {
    const n = raw.length
    const pairs = Math.floor(n / 2)
    if (n % 2 === 0) {
      // StartC + pairs + check
      dataSymbols = 1 + pairs + 1
    } else {
      // StartC + pairs + CodeB latch + last digit + check
      dataSymbols = 1 + pairs + 1 + 1 + 1
    }
  } else {
    // StartB + chars + check
    dataSymbols = 1 + raw.length + 1
  }
  return dataSymbols * 11 + 13
}

export function computeQuietZoneMm(xMm: number): number {
  return Math.max(1.5, 10 * xMm)
}

/**
 * Solve for X given content width and module count.
 * content = 2×quiet + modules×X, quiet = max(1.5, 10X)
 */
export function solveBarcodeXMm(
  contentWidthMm: number,
  modules: number
): { xMm: number; quietZoneMm: number; symbolWidthMm: number } {
  const m = Math.max(1, modules)
  // Case quiet = 10X: content = 20X + mX → X = content/(m+20)
  let x = contentWidthMm / (m + 20)
  let quiet = computeQuietZoneMm(x)
  if (quiet > 10 * x + 0.001) {
    // quiet stuck at 1.5 floor: content = 3 + mX → X = (content-3)/m
    x = Math.max(0.01, (contentWidthMm - 3) / m)
    quiet = computeQuietZoneMm(x)
  }
  const symbolWidthMm = m * x
  // If quiet+symbol overflows, shrink X
  const total = 2 * quiet + symbolWidthMm
  if (total > contentWidthMm + 0.01) {
    x = Math.max(0.01, (contentWidthMm - 2 * Math.max(1.5, quiet)) / m)
    // Recompute with floor quiet
    quiet = Math.min(computeQuietZoneMm(x), (contentWidthMm - m * x) / 2)
    quiet = Math.max(0.8, quiet)
    x = Math.max(0.01, (contentWidthMm - 2 * quiet) / m)
  }
  return {
    xMm: Number(x.toFixed(4)),
    quietZoneMm: Number(quiet.toFixed(3)),
    symbolWidthMm: Number((m * x).toFixed(3))
  }
}

export type LabelScanSafety = {
  ok: boolean
  reason: string | null
  xMm: number
  quietZoneMm: number
  barHeightMm: number
}

export function assessLabelScanSafety(input: {
  layout: LabelLayout
  barcodeValue: string | null
  labelWidthMm: number
}): LabelScanSafety {
  const { layout, barcodeValue, labelWidthMm } = input
  if (!layout.barcode || !barcodeValue?.trim()) {
    return {
      ok: true,
      reason: null,
      xMm: 0,
      quietZoneMm: 0,
      barHeightMm: 0
    }
  }

  const contentWidth = Math.max(
    4,
    labelWidthMm - 2 * (layout.padSideMm + layout.safetyInsetMm)
  )
  const modules = estimateCode128Modules(barcodeValue)
  const { xMm, quietZoneMm } = solveBarcodeXMm(contentWidth, modules)

  const hriMm = layout.showHumanReadable
    ? layout.barcode.secondaryFontMm + 0.35
    : 0
  const barHeightMm = Math.max(0, layout.barcode.rowMm - hriMm)

  if (xMm < BARCODE_MIN_X_MM) {
    return {
      ok: false,
      reason:
        'A vonalkód túl hosszú ehhez a 33×25 mm címkéhez — a sávok túl keskenyek lennének. Használj rövidebb (lehetőleg csak számos) kódot; a „Csak kód” sablon ezen nem segít.',
      xMm,
      quietZoneMm,
      barHeightMm
    }
  }
  if (barHeightMm < BARCODE_ABSOLUTE_MIN_HEIGHT_MM) {
    return {
      ok: false,
      reason:
        'A vonalkód sávja túl alacsony. Kapcsold ki a név/ár/SKU mezőket, kapcsold ki a „Kód számjegyei” opciót, vagy válaszd a „Csak kód” sablont.',
      xMm,
      quietZoneMm,
      barHeightMm
    }
  }
  if (quietZoneMm < 1.2) {
    return {
      ok: false,
      reason:
        'Nincs elég üres szegély (quiet zone) a vonalkód mellett — a szkenner nem tudná megbízhatóan olvasni. Rövidítsd a kódot.',
      xMm,
      quietZoneMm,
      barHeightMm
    }
  }

  return { ok: true, reason: null, xMm, quietZoneMm, barHeightMm }
}

/**
 * Fit product name: shrink font until wrap ≤ maxLines.
 * Never truncates — smaller type instead of ellipsis.
 */
function resolveNameBlock(
  text: string,
  desiredFont: number,
  contentWidthMm: number,
  floorName: number,
  maxLines: number,
  maxContentMm?: number
): { fontDes: number; lines: number; contentMin: number } {
  let font = desiredFont
  for (let i = 0; i < 36; i++) {
    const rawLines = nameLinesForWidth(text, font, contentWidthMm)
    if (rawLines > maxLines && font > NAME_MIN_FONT) {
      font = Number((font * 0.9).toFixed(2))
      continue
    }
    const lines = Math.min(maxLines, rawLines)
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
  const lines = Math.min(maxLines, nameLinesForWidth(text, font, contentWidthMm))
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
 * Scan-safe layout: quiet zone + bar height first; SKU ~3.6 mm (Nagy SKU ~4.2);
 * HRI off by default; excess barcode height → SKU then name.
 */
export function computeLabelLayout(input: {
  size: LabelSize
  fields: LabelFields
  productName: string
  price: number
  payload: ProductLabelPayload
  /** Default false — digits under bars waste scan height on 33×25. */
  showHumanReadable?: boolean
}): LabelLayout {
  const floor = FLOOR_33
  const { w, h } = labelSizeMm(input.size)

  const padTopMm = PAD.top
  const padSideMm = PAD.side
  const padBottomMm = PAD.bottom
  const safetyInsetMm = PAD.safety

  const barcodeVal = labelBarcodeValue(input.payload)
  const showName = input.fields.showName
  const showSku = input.fields.showSku && Boolean(input.payload.sku?.trim())
  const showPrice = input.fields.showPrice
  const showBarcode = input.fields.showBarcode && Boolean(barcodeVal)
  const showHumanReadable = Boolean(
    showBarcode && (input.showHumanReadable ?? false)
  )

  // Tight vertical rhythm — reclaim space for barcode / SKU
  const gapMm = !showSku && showName && showPrice ? 0.22 : 0.15

  const text = input.productName.trim() || input.payload.name || '—'
  const contentWidthMm = Math.max(
    8,
    w - 2 * (padSideMm + safetyInsetMm)
  )

  const modules = barcodeVal ? estimateCode128Modules(barcodeVal) : 40
  const { quietZoneMm: resolvedQuiet } = showBarcode
    ? solveBarcodeXMm(contentWidthMm, modules)
    : { quietZoneMm: 1.5 }

  const nameMaxLines = showBarcode
    ? showSku
      ? NAME_MAX_LINES_WITH_BARCODE_AND_SKU
      : NAME_MAX_LINES_WITH_BARCODE
    : NAME_MAX_LINES_NO_BARCODE

  const visibleCount =
    Number(showName) + Number(showSku) + Number(showPrice) + Number(showBarcode)
  const gapsTotal = Math.max(0, visibleCount - 1) * gapMm
  const available = Math.max(
    4,
    h - padTopMm - padBottomMm - 2 * safetyInsetMm - gapsTotal
  )

  const nameResolved = showName
    ? resolveNameBlock(
        text,
        desiredNameFont(text),
        contentWidthMm,
        floor.name,
        nameMaxLines
      )
    : { fontDes: 0, lines: 1, contentMin: 0 }

  // Nagy SKU sablon (nincs név): push toward ~4.2 mm when space allows
  const skuFontDes =
    showSku && !showName ? 4.2 : showSku ? SKU_DESIRED_FONT_MM : 0
  let priceFontDes = desiredPriceFont(input.price)
  if (!showSku && showName && showPrice) {
    priceFontDes = Number((priceFontDes * 0.94).toFixed(2))
  }
  const unitFontDes = 2.15

  const nameMin = showName ? nameResolved.contentMin : 0
  const skuMin = showSku ? Math.max(floor.sku, skuContentMm(skuFontDes)) : 0
  const priceMin = showPrice
    ? Math.max(floor.price, priceContentMm(priceFontDes, unitFontDes))
    : 0
  const barcodeMin = showBarcode
    ? Math.max(
        showHumanReadable ? floor.barcodeWithHuman : floor.barcode,
        barcodeContentMinMm(showHumanReadable)
      )
    : 0

  let nameRow = showName ? nameMin : 0
  let skuRow = showSku ? skuMin : 0
  let priceRow = showPrice ? priceMin : 0
  let barcodeRow = 0

  const textFixed = nameRow + skuRow + priceRow
  const skuDesiredRow = showSku ? skuContentMm(skuFontDes) : 0

  if (showBarcode) {
    const rem = available - textFixed
    if (rem >= barcodeMin) {
      // Give leftover to barcode (scan height)
      barcodeRow = Number(rem.toFixed(2))
      // Excess above soft target → SKU first (warehouse pick), then name
      const softCap = BARCODE_TARGET_HEIGHT_MM + 2
      if (barcodeRow > softCap) {
        let spare = Number((barcodeRow - Math.max(barcodeMin, softCap)).toFixed(2))
        if (showSku && skuRow < skuDesiredRow && spare > 0.05) {
          const giveSku = Math.min(spare, skuDesiredRow - skuRow)
          skuRow = Number((skuRow + giveSku).toFixed(2))
          barcodeRow = Number((barcodeRow - giveSku).toFixed(2))
          spare = Number((spare - giveSku).toFixed(2))
        }
        if (
          spare > 0.05 &&
          showName &&
          nameRow < nameContentMm(nameResolved.fontDes, nameResolved.lines)
        ) {
          const need = nameContentMm(nameResolved.fontDes, nameResolved.lines)
          const give = Math.min(spare, Math.max(0, need - nameRow))
          if (give > 0.05) {
            nameRow = Number((nameRow + give).toFixed(2))
            barcodeRow = Number((barcodeRow - give).toFixed(2))
          }
        }
      }
    } else {
      // Squeeze text blocks; never drop barcode below floor if possible
      // Prefer keeping SKU near floor (cut name/price first)
      const budget = Math.max(0, available - barcodeMin)
      const squeeze = textFixed > 0 ? Math.min(1, budget / textFixed) : 1
      nameRow = showName
        ? Math.max(floor.name * 0.75, Number((nameMin * squeeze).toFixed(2)))
        : 0
      skuRow = showSku
        ? Math.max(floor.sku * 0.95, Number((skuMin * squeeze).toFixed(2)))
        : 0
      priceRow = showPrice
        ? Math.max(floor.price * 0.9, Number((priceMin * squeeze).toFixed(2)))
        : 0
      barcodeRow = Math.max(
        barcodeMin,
        available - nameRow - skuRow - priceRow
      )
      const sum = nameRow + skuRow + priceRow + barcodeRow
      if (sum > available + 0.01) {
        // Last resort: cut name → price → SKU (SKU last)
        const overflow = sum - available
        let cut = overflow
        const cutFromName = showName
          ? Math.min(cut, Math.max(0, nameRow - floor.name * 0.75))
          : 0
        nameRow = Number((nameRow - cutFromName).toFixed(2))
        cut -= cutFromName
        const cutFromPrice = showPrice
          ? Math.min(cut, Math.max(0, priceRow - floor.price * 0.85))
          : 0
        priceRow = Number((priceRow - cutFromPrice).toFixed(2))
        cut -= cutFromPrice
        const cutFromSku = showSku
          ? Math.min(cut, Math.max(0, skuRow - floor.sku * 0.9))
          : 0
        skuRow = Number((skuRow - cutFromSku).toFixed(2))
        cut -= cutFromSku
        if (cut > 0.01) {
          barcodeRow = Number(Math.max(4.5, barcodeRow - cut).toFixed(2))
        }
      }
    }
  } else if (textFixed > 0) {
    const leftover = Math.max(0, available - textFixed)
    if (leftover > 0.1) {
      const wName = showName ? 0.9 : 0
      const wSku = showSku ? 1.35 : 0
      const wPrice = showPrice ? 1.2 : 0
      const wSum = wName + wSku + wPrice || 1
      if (showName)
        nameRow = Number((nameMin + (leftover * wName) / wSum).toFixed(2))
      if (showSku)
        skuRow = Number((skuMin + (leftover * wSku) / wSum).toFixed(2))
      if (showPrice)
        priceRow = Number((priceMin + (leftover * wPrice) / wSum).toFixed(2))
    }
  }

  // Fit name into allocated row (shrink font; never ellipsis-truncate)
  let nameFont = 0
  if (showName) {
    const fitted = resolveNameBlock(
      text,
      nameResolved.fontDes,
      contentWidthMm,
      floor.name,
      nameMaxLines,
      nameRow
    )
    nameFont = fitted.fontDes
    // Do NOT steal from barcode for name — scan height wins
  }

  const skuFont = showSku
    ? clampFontToRow(skuFontDes, skuRow, skuContentMm)
    : 0
  const priceFont = showPrice
    ? clampFontToRow(priceFontDes, priceRow, (f) =>
        priceContentMm(f, Math.min(unitFontDes, Math.max(UNIT_MIN_FONT_MM, f * 0.42)))
      )
    : 0
  // Prefer ≥2.0 mm unit for thermal readability; only shrink under hard squeeze
  let unitFont = showPrice
    ? Number(
        Math.min(
          unitFontDes,
          Math.max(UNIT_MIN_FONT_MM, priceFont * 0.42)
        ).toFixed(2)
      )
    : 0
  if (
    showPrice &&
    unitFont > 0 &&
    priceContentMm(priceFont, unitFont) > priceRow + 0.05
  ) {
    unitFont = Number(
      Math.max(
        1.7,
        Math.min(unitFont, priceRow - priceFont - 0.25)
      ).toFixed(2)
    )
  }

  const priceFontFinal =
    showPrice && priceContentMm(priceFont, unitFont) > priceRow
      ? clampFontToRow(priceFont, priceRow, (f) =>
          priceContentMm(
            f,
            Math.min(unitFont, Math.max(UNIT_MIN_FONT_MM * 0.85, f * 0.42))
          )
        )
      : priceFont

  const barcodeSecondary = showHumanReadable ? 1.55 : 0

  return {
    padTopMm,
    padSideMm,
    padBottomMm,
    safetyInsetMm,
    gapMm,
    quietZoneMm: Number(resolvedQuiet.toFixed(3)),
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
  showHumanReadable?: boolean
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

export function nameFontMm(text: string): number {
  return desiredNameFont(text)
}

export function priceAmountFontMm(price: number): number {
  return desiredPriceFont(price)
}
