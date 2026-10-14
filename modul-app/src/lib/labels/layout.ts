import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'

export type LabelTemplateId = 'shelf' | 'full' | 'sku' | 'barcode' | 'price'

/**
 * Templates — Polc first (customer shelf). Hierarchy: Ár > Név > barcode > SKU.
 */
export const LABEL_TEMPLATES: Array<{
  id: LabelTemplateId
  label: string
  hint: string
  fields: (hasBarcode: boolean) => LabelFields
}> = [
  {
    id: 'shelf',
    label: 'Polc',
    hint: 'Név + ár + kód (polcra)',
    fields: (hasBarcode) => ({
      showName: true,
      showSku: false,
      showPrice: true,
      showBarcode: hasBarcode
    })
  },
  {
    id: 'full',
    label: 'Teljes',
    hint: 'Név + ár + apró SKU + kód',
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
    hint: 'SKU + ár + kód (raktár)',
    fields: (hasBarcode) => ({
      showName: false,
      showSku: true,
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
  /** Primary text size (name / sku / price amount). */
  fontMm: number
  /** Secondary: inline /unit under price amount, or HRI under bars. */
  secondaryFontMm: number
}

/** Where the SKU block renders in the sheet. */
export type SkuPlacement = 'row' | 'over-barcode'

export type LabelLayout = {
  padTopMm: number
  padSideMm: number
  padBottomMm: number
  safetyInsetMm: number
  gapMm: number
  quietZoneMm: number
  name: LabelBlockLayout | null
  sku: LabelBlockLayout | null
  /** `over-barcode` = thin strip above bars (Teljes); `row` = own grid row (Nagy SKU). */
  skuPlacement: SkuPlacement | null
  price: LabelBlockLayout | null
  /** Always true — amount + /unit on one baseline. */
  priceUnitInline: boolean
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
export const BARCODE_TARGET_HEIGHT_MM = 7.5

/** Hard floor — below this, refuse print. */
export const BARCODE_ABSOLUTE_MIN_HEIGHT_MM = 5.5

/** Secondary SKU strip (Teljes) — readable but still under name/price. */
export const SKU_SECONDARY_FONT_MM = 2.7

/** Warehouse pick SKU. */
export const SKU_WAREHOUSE_FONT_MM = 4.0

/** @deprecated — use SKU_SECONDARY_FONT_MM / SKU_WAREHOUSE_FONT_MM */
export const SKU_DESIRED_FONT_MM = SKU_SECONDARY_FONT_MM

export const UNIT_MIN_FONT_MM = 2.0

const PAD = {
  top: 0.85,
  side: 0.95,
  bottom: 0.85,
  safety: 0.25
} as const

/** Tight rhythm — little air between name / price / barcode. */
const GAP_MM = 0.12

/** Slightly optimistic — 2-line shelf titles stay ≥ ~2.5 mm. */
const CHAR_WIDTH_FACTOR = 0.52
const NAME_MIN_FONT = 2.0
const NAME_MAX_LINES = 2

function desiredNameFont(text: string): number {
  const len = text.trim().length
  let base = 3.0
  if (len > 70) base = 2.35
  else if (len > 50) base = 2.55
  else if (len > 35) base = 2.75
  else if (len > 22) base = 2.9
  return Number(base.toFixed(2))
}

function desiredPriceFont(price: number): number {
  const digits = new Intl.NumberFormat('hu-HU').format(price).length
  let base = 5.4
  if (digits > 8) base = 3.8
  else if (digits > 6) base = 4.4
  else if (digits > 5) base = 4.9
  return Number(base.toFixed(2))
}

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
  return fontMm * 1.14 * lines
}

function resolveNameFont(
  text: string,
  desiredFont: number,
  contentWidthMm: number,
  maxRowMm: number,
  maxLines: number
): { fontMm: number; lines: number } {
  let font = desiredFont
  for (let i = 0; i < 40; i++) {
    const rawLines = nameLinesForWidth(text, font, contentWidthMm)
    const lines = Math.min(maxLines, rawLines)
    const need = nameContentMm(font, lines)
    if (rawLines > maxLines && font > NAME_MIN_FONT) {
      font = Number((font * 0.9).toFixed(2))
      continue
    }
    if (need > maxRowMm + 0.05 && font > NAME_MIN_FONT) {
      font = Number((font * 0.92).toFixed(2))
      continue
    }
    return {
      fontMm: Number(Math.max(NAME_MIN_FONT, font).toFixed(2)),
      lines
    }
  }
  const lines = Math.min(
    maxLines,
    nameLinesForWidth(text, font, contentWidthMm)
  )
  return {
    fontMm: Number(Math.max(NAME_MIN_FONT, font).toFixed(2)),
    lines
  }
}

function clampFont(desired: number, maxMm: number, minMm: number): number {
  return Number(Math.max(minMm, Math.min(desired, maxMm)).toFixed(2))
}

/**
 * CODE128 symbol width in modules (excluding quiet zones).
 * Matches jsbarcode auto subset: pure digits → Code C (2 digits/symbol);
 * otherwise Code B (1 char/symbol). Stop = 13 modules.
 */
export function estimateCode128Modules(value: string): number {
  const raw = value.trim()
  if (!raw) return 11 + 11 + 13

  const isDigits = /^\d+$/.test(raw)
  let dataSymbols: number
  if (isDigits) {
    const n = raw.length
    const pairs = Math.floor(n / 2)
    if (n % 2 === 0) {
      dataSymbols = 1 + pairs + 1
    } else {
      dataSymbols = 1 + pairs + 1 + 1 + 1
    }
  } else {
    dataSymbols = 1 + raw.length + 1
  }
  return dataSymbols * 11 + 13
}

export function computeQuietZoneMm(xMm: number): number {
  return Math.max(1.5, 10 * xMm)
}

export function solveBarcodeXMm(
  contentWidthMm: number,
  modules: number
): { xMm: number; quietZoneMm: number; symbolWidthMm: number } {
  const m = Math.max(1, modules)
  let x = contentWidthMm / (m + 20)
  let quiet = computeQuietZoneMm(x)
  if (quiet > 10 * x + 0.001) {
    x = Math.max(0.01, (contentWidthMm - 3) / m)
    quiet = computeQuietZoneMm(x)
  }
  const symbolWidthMm = m * x
  const total = 2 * quiet + symbolWidthMm
  if (total > contentWidthMm + 0.01) {
    x = Math.max(0.01, (contentWidthMm - 2 * Math.max(1.5, quiet)) / m)
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
  const skuStripMm =
    layout.skuPlacement === 'over-barcode' && layout.sku
      ? layout.sku.rowMm + 0.15
      : 0
  const barHeightMm = Math.max(0, layout.barcode.rowMm - hriMm - skuStripMm)

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

type ZoneMode = 'shelf' | 'full' | 'warehouse' | 'barcode' | 'price-only'

function detectMode(input: {
  showName: boolean
  showSku: boolean
  showPrice: boolean
  showBarcode: boolean
}): ZoneMode {
  const { showName, showSku, showPrice, showBarcode } = input
  if (showBarcode && !showName && !showSku && !showPrice) return 'barcode'
  if (!showBarcode && showName && showPrice && !showSku) return 'price-only'
  if (showSku && !showName) return 'warehouse'
  if (showName && showSku) return 'full'
  return 'shelf'
}

/**
 * Fixed-zone layout (NIST / shelf-edge hierarchy):
 * Ár > Név > barcode > SKU. Unit inline with price (Ft/db).
 */
export function computeLabelLayout(input: {
  size: LabelSize
  fields: LabelFields
  productName: string
  price: number
  payload: ProductLabelPayload
  showHumanReadable?: boolean
}): LabelLayout {
  const { w, h } = labelSizeMm(input.size)
  const padTopMm = PAD.top
  const padSideMm = PAD.side
  const padBottomMm = PAD.bottom
  const safetyInsetMm = PAD.safety
  const gapMm = GAP_MM

  const barcodeVal = labelBarcodeValue(input.payload)
  const showName = input.fields.showName
  const showSku = input.fields.showSku && Boolean(input.payload.sku?.trim())
  const showPrice = input.fields.showPrice
  const showBarcode = input.fields.showBarcode && Boolean(barcodeVal)
  const showHumanReadable = Boolean(
    showBarcode && (input.showHumanReadable ?? false)
  )

  const text = input.productName.trim() || input.payload.name || '—'
  const contentWidthMm = Math.max(8, w - 2 * (padSideMm + safetyInsetMm))

  const modules = barcodeVal ? estimateCode128Modules(barcodeVal) : 40
  const { quietZoneMm: resolvedQuiet } = showBarcode
    ? solveBarcodeXMm(contentWidthMm, modules)
    : { quietZoneMm: 1.5 }

  const mode = detectMode({ showName, showSku, showPrice, showBarcode })

  const visibleCount =
    Number(showName) +
    Number(showSku && mode === 'warehouse') +
    Number(showPrice) +
    Number(showBarcode)
  // Teljes: SKU lives inside barcode zone — not a separate gap
  const gapCount = Math.max(0, visibleCount - 1)
  const available = Math.max(
    4,
    h - padTopMm - padBottomMm - 2 * safetyInsetMm - gapCount * gapMm
  )

  let nameRow = 0
  let skuRow = 0
  let priceRow = 0
  let barcodeRow = 0
  let skuPlacement: SkuPlacement | null = null

  const skuStripMm = 2.95
  const hriReserve = showHumanReadable ? 1.9 : 0
  const barcodeFloor = BARCODE_ABSOLUTE_MIN_HEIGHT_MM + hriReserve

  if (mode === 'barcode') {
    barcodeRow = available
  } else if (mode === 'price-only') {
    priceRow = Math.min(8.5, available * 0.42)
    nameRow = available - priceRow
  } else if (mode === 'warehouse') {
    // SKU dominant row → price → barcode
    const barcodeWant = Math.max(
      barcodeFloor,
      Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve, available * 0.4)
    )
    const priceWant = Math.min(5.4, available * 0.26)
    barcodeRow = barcodeWant
    priceRow = priceWant
    skuRow = Math.max(5.2, available - barcodeRow - priceRow)
    skuPlacement = 'row'
  } else if (mode === 'full') {
    // name → price → barcode(+SKU strip); compact text rows, leftover → barcode
    if (showBarcode) {
      const strip = showSku ? skuStripMm : 0
      const priceWant = Math.min(5.4, available * 0.26)
      const barcodeWant = Math.max(
        barcodeFloor + strip,
        Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve + strip, available * 0.42)
      )
      barcodeRow = barcodeWant
      priceRow = priceWant
      nameRow = Math.max(4.4, available - barcodeRow - priceRow)
      if (showSku) {
        skuRow = skuStripMm
        skuPlacement = 'over-barcode'
      }
    } else {
      const priceWant = Math.min(5.6, available * 0.32)
      priceRow = priceWant
      if (showSku) {
        skuRow = skuStripMm
        skuPlacement = 'row'
        nameRow = Math.max(4.4, available - priceRow - skuRow)
      } else {
        nameRow = Math.max(4.8, available - priceRow)
      }
    }
  } else {
    // shelf: compact name + price, leftover → barcode
    const barcodeWant = Math.max(
      barcodeFloor,
      Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve, available * 0.42)
    )
    const priceWant = Math.min(5.5, available * 0.27)
    barcodeRow = barcodeWant
    priceRow = priceWant
    nameRow = Math.max(4.5, available - barcodeRow - priceRow)
  }

  // If barcode+name+price overflow, cut name then price (never barcode below floor)
  const primarySum =
    (showName ? nameRow : 0) +
    (skuPlacement === 'row' ? skuRow : 0) +
    (showPrice ? priceRow : 0) +
    (showBarcode ? barcodeRow : 0)
  if (showBarcode && primarySum > available + 0.05) {
    let overflow = primarySum - available
    if (showName && overflow > 0) {
      const cut = Math.min(overflow, Math.max(0, nameRow - 4.2))
      nameRow = Number((nameRow - cut).toFixed(2))
      overflow -= cut
    }
    if (showPrice && overflow > 0) {
      const cut = Math.min(overflow, Math.max(0, priceRow - 5.0))
      priceRow = Number((priceRow - cut).toFixed(2))
      overflow -= cut
    }
    if (skuPlacement === 'row' && overflow > 0) {
      const cut = Math.min(overflow, Math.max(0, skuRow - 5.0))
      skuRow = Number((skuRow - cut).toFixed(2))
      overflow -= cut
    }
    if (overflow > 0.01) {
      barcodeRow = Number(Math.max(barcodeFloor, barcodeRow - overflow).toFixed(2))
    }
  }

  // Fonts fit zones
  const nameFitted = showName
    ? resolveNameFont(
        text,
        desiredNameFont(text),
        contentWidthMm,
        nameRow,
        NAME_MAX_LINES
      )
    : { fontMm: 0, lines: 1 }

  // Name must stay ≥ secondary SKU when both visible
  let nameFont = nameFitted.fontMm
  if (showName && showSku && skuPlacement === 'over-barcode') {
    nameFont = Math.max(nameFont, SKU_SECONDARY_FONT_MM + 0.45)
    nameFont = clampFont(nameFont, nameRow / 1.14, NAME_MIN_FONT)
  }

  const skuFont =
    skuPlacement === 'row'
      ? clampFont(SKU_WAREHOUSE_FONT_MM, skuRow * 0.92, 3.2)
      : skuPlacement === 'over-barcode'
        ? clampFont(SKU_SECONDARY_FONT_MM, skuRow * 0.95, 2.3)
        : 0

  // Inline price: amount + /unit on one line → secondary ~45% of amount
  let priceFont = showPrice
    ? clampFont(desiredPriceFont(input.price), priceRow * 0.88, 3.2)
    : 0
  let unitFont = showPrice
    ? Number(
        Math.max(
          UNIT_MIN_FONT_MM,
          Math.min(priceFont * 0.48, priceRow * 0.42)
        ).toFixed(2)
      )
    : 0
  // Ensure amount + unit fit one line height
  if (showPrice && Math.max(priceFont, unitFont) > priceRow - 0.2) {
    priceFont = clampFont(priceFont, priceRow - 0.25, 3.0)
    unitFont = Number(
      Math.max(1.7, Math.min(unitFont, priceFont * 0.48)).toFixed(2)
    )
  }

  const barcodeSecondary = showHumanReadable ? 1.55 : 0

  // Shrink text rows to content — spare goes to barcode (less empty between fields)
  if (showName && nameRow > 0) {
    const lines = Math.min(
      NAME_MAX_LINES,
      nameLinesForWidth(text, nameFont, contentWidthMm)
    )
    const tight = nameContentMm(nameFont, lines) + 0.15
    if (tight + 0.2 < nameRow) {
      const spare = nameRow - tight
      nameRow = Number(tight.toFixed(2))
      if (showBarcode) barcodeRow = Number((barcodeRow + spare).toFixed(2))
    }
  }
  if (showPrice && priceRow > 0) {
    const tight = Math.max(priceFont, unitFont) + 0.25
    if (tight + 0.15 < priceRow) {
      const spare = priceRow - tight
      priceRow = Number(tight.toFixed(2))
      if (showBarcode) barcodeRow = Number((barcodeRow + spare).toFixed(2))
    }
  }

  // When over-barcode, sku strip is drawn inside barcode cell
  let barcodeZone = showBarcode ? barcodeRow : 0
  let skuInZone = skuPlacement === 'over-barcode' ? skuRow : 0
  if (skuPlacement === 'over-barcode' && showBarcode) {
    barcodeZone = barcodeRow
    skuInZone = skuStripMm
  }

  return {
    padTopMm,
    padSideMm,
    padBottomMm,
    safetyInsetMm,
    gapMm,
    quietZoneMm: Number(resolvedQuiet.toFixed(3)),
    name: showName
      ? { rowMm: nameRow, fontMm: nameFont, secondaryFontMm: 0 }
      : null,
    sku:
      showSku && skuPlacement
        ? {
            rowMm: skuPlacement === 'over-barcode' ? skuInZone : skuRow,
            fontMm: skuFont,
            secondaryFontMm: 0
          }
        : null,
    skuPlacement,
    price: showPrice
      ? {
          rowMm: priceRow,
          fontMm: priceFont,
          secondaryFontMm: unitFont
        }
      : null,
    priceUnitInline: true,
    barcode: showBarcode
      ? {
          rowMm: barcodeZone,
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
