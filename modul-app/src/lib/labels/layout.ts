import { isValidEan13 } from '@/lib/barcodes/ean13'
import {
  labelBarcodeValue,
  labelSizeMm,
  type LabelFields,
  type LabelSize,
  type ProductLabelPayload
} from '@/lib/labels/types'

export type LabelBarcodeFormat = 'EAN13' | 'CODE128'

export type LabelTemplateId = 'shelf' | 'full' | 'sku' | 'barcode' | 'price'

/**
 * Templates — Teljes default (SKU ON). Visual hierarchy by size: Ár > SKU > Név.
 * Name: max 2 lines with SKU (ellipsis) — cannot invade SKU; weight 550.
 */
export const LABEL_TEMPLATES: Array<{
  id: LabelTemplateId
  label: string
  hint: string
  fields: (hasBarcode: boolean) => LabelFields
}> = [
  {
    id: 'full',
    label: 'Teljes',
    hint: 'Név + ár + SKU + kód (alap)',
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
    hint: 'Név + ár + kód (SKU nélkül)',
    fields: (hasBarcode) => ({
      showName: true,
      showSku: false,
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
  /** Name only — hard CSS line-clamp (matches layout fit). */
  maxLines?: number
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
  /** `row` = own grid row (Teljes + Nagy SKU). `over-barcode` kept for type compat. */
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
 * GS1 retail / thermal on-demand ≥0.25; Zebra 203 dpi → ≥2 dots (0.25 mm).
 */
export const BARCODE_MIN_X_MM = 0.25

/** 203 dpi thermal dot pitch (mm). */
export const THERMAL_DOT_MM_203 = 25.4 / 203

/**
 * Print quiet zone (mm each side) — FIXED small, not GS1 10×X.
 * Large quiet was shrinking bars into the middle (unreadable). Scanners need
 * *some* white, but X thickness matters more on 33 mm labels.
 */
export const BARCODE_MIN_QUIET_MM = 1.0

/** Prefer at least this bar height (mm) when barcode is shown. */
export const BARCODE_TARGET_HEIGHT_MM = 10.0

/** Hard floor — below this, warn (soft). */
export const BARCODE_ABSOLUTE_MIN_HEIGHT_MM = 7.0

/** Snap X to whole thermal dots (min 2 dots ≈ 0.25 mm @ 203 dpi). */
export function snapXMmToThermalDots(xMm: number, minDots = 2): number {
  const dots = Math.max(minDots, Math.round(xMm / THERMAL_DOT_MM_203))
  return Number((dots * THERMAL_DOT_MM_203).toFixed(4))
}

/** EAN-13 bar modules (excl. quiet) — denser than CODE128C for the same 13 digits. */
export const EAN13_BAR_MODULES = 95

/**
 * JsBarcode narrow-bar width (CSS px) before SVG stretch-to-fill.
 * Match main-app AccessoryLabelPrintDialog (`width={2.5}`) — avoids sub-pixel
 * bars that thermal heads smear. Printed X comes from CSS 100% fill, not this.
 */
export const BARCODE_INTRINSIC_MODULE_PX = 2.5

/** Intrinsic SVG bar height (px) before stretch — main-app uses ~50 on 33×25. */
export const BARCODE_INTRINSIC_HEIGHT_PX = 50

/**
 * Teljes sablon SKU — fontosabb / nagyobb, mint a név (ops pick).
 * Saját sor a név és az ár között.
 */
export const SKU_SECONDARY_FONT_MM = 3.5

/** Warehouse pick SKU (Nagy SKU sablon). */
export const SKU_WAREHOUSE_FONT_MM = 4.2

/** @deprecated — use SKU_SECONDARY_FONT_MM / SKU_WAREHOUSE_FONT_MM */
export const SKU_DESIRED_FONT_MM = SKU_SECONDARY_FONT_MM

export const UNIT_MIN_FONT_MM = 2.0

/** SKU must stay at least this much larger than name (mm) when both shown. */
export const SKU_OVER_NAME_MM = 0.4

/**
 * Text inset. Barcode row breaks out (full-bleed) via negative margin in the sheet —
 * same idea as main-app (0 side pad on the symbol).
 */
const PAD = {
  top: 0.7,
  side: 0.45,
  bottom: 0.7,
  safety: 0.15
} as const

/**
 * Gap between blocks. Was 0.12 — name bled into SKU on print.
 * Fixed (no user toggle) so clerks can't collapse it.
 */
const GAP_MM = 0.4

/** Optimistic wrap — prefer larger name over early shrink. */
const CHAR_WIDTH_FACTOR = 0.5
/** Floor font — below this unreadable on 33×25 thermal. */
const NAME_MIN_FONT = 2.8
/**
 * Hard line caps — long names ellipsis, never invade SKU.
 * With SKU: 2 lines max. Without SKU: 3. Not configurable in UI.
 */
export const NAME_MAX_LINES_WITH_SKU = 2
export const NAME_MAX_LINES_BARCODE = 2
export const NAME_MAX_LINES_NO_BARCODE = 3

/** Extra air after name when SKU follows (mm) — baked into name row pad. */
const NAME_BEFORE_SKU_PAD_MM = 0.2

function desiredNameFont(text: string): number {
  const len = text.trim().length
  let base = 3.5
  if (len > 70) base = 3.0
  else if (len > 50) base = 3.15
  else if (len > 35) base = 3.3
  else if (len > 22) base = 3.4
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

/**
 * Fit name by shrinking font only — never truncates characters.
 * Prefer ≤ maxLines; if still too many at NAME_MIN_FONT, keep all lines
 * (caller must expand nameRow).
 */
function resolveNameFont(
  text: string,
  desiredFont: number,
  contentWidthMm: number,
  maxRowMm: number,
  maxLines: number
): { fontMm: number; lines: number } {
  let font = desiredFont
  for (let i = 0; i < 48; i++) {
    const rawLines = nameLinesForWidth(text, font, contentWidthMm)
    if (rawLines > maxLines && font > NAME_MIN_FONT) {
      font = Number((font * 0.9).toFixed(2))
      continue
    }
    const lines = rawLines
    const need = nameContentMm(font, lines)
    if (need > maxRowMm + 0.05 && font > NAME_MIN_FONT) {
      font = Number((font * 0.92).toFixed(2))
      continue
    }
    return {
      fontMm: Number(Math.max(NAME_MIN_FONT, font).toFixed(2)),
      lines
    }
  }
  const fontMm = Number(Math.max(NAME_MIN_FONT, font).toFixed(2))
  return {
    fontMm,
    lines: nameLinesForWidth(text, fontMm, contentWidthMm)
  }
}

function clampFont(desired: number, maxMm: number, minMm: number): number {
  return Number(Math.max(minMm, Math.min(desired, maxMm)).toFixed(2))
}

/**
 * Prefer native EAN-13 for valid 13-digit codes — ~95 modules vs ~123 CODE128C
 * → thicker X on the same 33 mm label (scanners + retail).
 */
export function resolveLabelBarcodeFormat(value: string): LabelBarcodeFormat {
  return isValidEan13(value.trim()) ? 'EAN13' : 'CODE128'
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

/** Modules for the format we will actually render. */
export function estimateBarcodeModules(value: string): number {
  if (resolveLabelBarcodeFormat(value) === 'EAN13') return EAN13_BAR_MODULES
  return estimateCode128Modules(value)
}

export function computeQuietZoneMm(_xMm: number): number {
  // Fixed print quiet — do not grow with 10×X (that starved bar width on 33×25).
  void _xMm
  return BARCODE_MIN_QUIET_MM
}

/**
 * Maximize narrow-bar width (X) for the label width.
 * Quiet is a small fixed pad; remaining width → bars (edge-to-edge scan).
 */
export function solveBarcodeXMm(
  contentWidthMm: number,
  modules: number
): { xMm: number; quietZoneMm: number; symbolWidthMm: number } {
  const m = Math.max(1, modules)
  const W = Math.max(4, contentWidthMm)

  let quiet = BARCODE_MIN_QUIET_MM
  let x = Math.max(0.01, (W - 2 * quiet) / m)

  // If still below min X, shrink quiet slightly (floor 0.75 mm)
  if (x < BARCODE_MIN_X_MM && quiet > 0.75) {
    quiet = 0.75
    x = Math.max(0.01, (W - 2 * quiet) / m)
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

  // Barcode is full-bleed across the label (text keeps side pad).
  const contentWidth = Math.max(4, labelWidthMm)
  const modules = estimateBarcodeModules(barcodeValue)
  const { xMm, quietZoneMm } = solveBarcodeXMm(contentWidth, modules)

  const hriMm = layout.showHumanReadable
    ? layout.barcode.secondaryFontMm + 0.35
    : 0
  const skuStripMm =
    layout.skuPlacement === 'over-barcode' && layout.sku
      ? layout.sku.rowMm + 0.15
      : 0
  const barHeightMm = Math.max(0, layout.barcode.rowMm - hriMm - skuStripMm)

  const xDots = snapXMmToThermalDots(xMm, 2)
  if (xMm < BARCODE_MIN_X_MM || xDots < BARCODE_MIN_X_MM - 0.01) {
    return {
      ok: false,
      reason:
        'A vonalkód sávjai túl keskenyek (X < 0,25 mm / 2 printer-pont) — a szkenner nem olvasná. Válaszd a „Belső EAN” kódot, vagy a „Csak kód” sablont.',
      xMm,
      quietZoneMm,
      barHeightMm
    }
  }
  if (barHeightMm < BARCODE_ABSOLUTE_MIN_HEIGHT_MM) {
    return {
      ok: false,
      reason:
        'A vonalkód sávja túl alacsony. Kapcsold ki a név/ár/SKU mezőket, vagy válaszd a „Csak kód” sablont.',
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
  /** Text / name wrap width (inset). */
  const contentWidthMm = Math.max(8, w - 2 * (padSideMm + safetyInsetMm))
  /** Barcode uses full label width (full-bleed stretch). */
  const barcodeContentWidthMm = Math.max(8, w)

  const modules = barcodeVal ? estimateBarcodeModules(barcodeVal) : 40
  const { quietZoneMm: resolvedQuiet } = showBarcode
    ? solveBarcodeXMm(barcodeContentWidthMm, modules)
    : { quietZoneMm: BARCODE_MIN_QUIET_MM }

  const mode = detectMode({ showName, showSku, showPrice, showBarcode })

  // Teljes + Nagy SKU: SKU saját sor (név és ár között / domináns)
  const skuTakesOwnRow = showSku && (mode === 'warehouse' || mode === 'full')
  const visibleCount =
    Number(showName) +
    Number(skuTakesOwnRow) +
    Number(showPrice) +
    Number(showBarcode)
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

  const hriReserve = showHumanReadable ? 1.9 : 0
  const barcodeFloor = BARCODE_ABSOLUTE_MIN_HEIGHT_MM + hriReserve
  // Hard caps — user cannot raise these in the dialog
  const nameMaxLines =
    showName && showSku
      ? NAME_MAX_LINES_WITH_SKU
      : showBarcode
        ? NAME_MAX_LINES_BARCODE
        : NAME_MAX_LINES_NO_BARCODE
  /** Teljes: SKU row height for ~3.5 mm type. */
  const skuFullRowMm = 3.85

  if (mode === 'barcode') {
    barcodeRow = available
  } else if (mode === 'price-only') {
    priceRow = Math.min(7.5, available * 0.38)
    nameRow = available - priceRow
  } else if (mode === 'warehouse') {
    const barcodeWant = Math.max(
      Math.max(barcodeFloor, 9.0),
      Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve, available * 0.4)
    )
    const priceWant = Math.min(4.8, available * 0.22)
    barcodeRow = barcodeWant
    priceRow = priceWant
    skuRow = Math.max(4.8, available - barcodeRow - priceRow)
    skuPlacement = 'row'
  } else if (mode === 'full') {
    // SKU saját sor (nagyobb, mint a név) → ár → barcode; leftover → név
    if (showSku) {
      skuRow = skuFullRowMm
      skuPlacement = 'row'
    }
    if (showBarcode) {
      // Scan-first: barcode gets ~42% height (was ~34%) — thicker readable bars
      const priceWant = Math.min(4.6, available * 0.2)
      const barcodeSoft = Math.max(
        Math.max(barcodeFloor, 9.0),
        Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve, available * 0.44)
      )
      priceRow = priceWant
      barcodeRow = barcodeSoft
      nameRow = Math.max(
        3.6,
        available - barcodeRow - priceRow - (showSku ? skuRow : 0)
      )
    } else {
      const priceWant = Math.min(5.2, available * 0.28)
      priceRow = priceWant
      nameRow = Math.max(
        4.2,
        available - priceRow - (showSku ? skuRow : 0)
      )
    }
  } else {
    // shelf: scan-first barcode share
    const barcodeWant = Math.max(
      Math.max(barcodeFloor, 9.0),
      Math.min(BARCODE_TARGET_HEIGHT_MM + hriReserve, available * 0.42)
    )
    const priceWant = Math.min(4.8, available * 0.22)
    barcodeRow = barcodeWant
    priceRow = priceWant
    nameRow = Math.max(4.5, available - barcodeRow - priceRow)
  }

  // Overflow: cut name / price / barcode — keep SKU row (ops-critical)
  const primarySum =
    (showName ? nameRow : 0) +
    (skuPlacement === 'row' ? skuRow : 0) +
    (showPrice ? priceRow : 0) +
    (showBarcode ? barcodeRow : 0)
  if (showBarcode && primarySum > available + 0.05) {
    let overflow = primarySum - available
    if (showName && overflow > 0) {
      const cut = Math.min(overflow, Math.max(0, nameRow - 3.8))
      nameRow = Number((nameRow - cut).toFixed(2))
      overflow -= cut
    }
    if (showPrice && overflow > 0) {
      const cut = Math.min(overflow, Math.max(0, priceRow - 4.6))
      priceRow = Number((priceRow - cut).toFixed(2))
      overflow -= cut
    }
    if (overflow > 0.01) {
      barcodeRow = Number(
        Math.max(barcodeFloor, barcodeRow - overflow).toFixed(2)
      )
    }
  }

  // Fit name within hard line cap; steal from barcode if needed — never from SKU
  let nameFitted = showName
    ? resolveNameFont(
        text,
        desiredNameFont(text),
        contentWidthMm,
        nameRow,
        nameMaxLines
      )
    : { fontMm: 0, lines: 1 }

  if (showName && showBarcode) {
    for (let i = 0; i < 12; i++) {
      const need =
        nameContentMm(nameFitted.fontMm, nameFitted.lines) +
        0.15 +
        (showSku ? NAME_BEFORE_SKU_PAD_MM : 0)
      const needsMoreRoom = need > nameRow + 0.05
      if (!needsMoreRoom) break
      // Cap name growth — do not expand past max lines' worth of space
      const maxNameRow =
        nameContentMm(NAME_MIN_FONT, nameMaxLines) +
        0.4 +
        (showSku ? NAME_BEFORE_SKU_PAD_MM : 0)
      if (nameRow >= maxNameRow - 0.05) break
      const spare = barcodeRow - barcodeFloor
      if (spare < 0.15) break
      const give = Math.min(
        spare,
        Math.max(0.2, need - nameRow + 0.3),
        maxNameRow - nameRow
      )
      if (give < 0.1) break
      barcodeRow = Number((barcodeRow - give).toFixed(2))
      nameRow = Number((nameRow + give).toFixed(2))
      nameFitted = resolveNameFont(
        text,
        desiredNameFont(text),
        contentWidthMm,
        nameRow,
        nameMaxLines
      )
    }
  }

  // Clamp name row to fitted content (hard ceiling) — prevents bleed into SKU
  if (showName && nameFitted.lines > 0) {
    const lines = Math.min(nameFitted.lines, nameMaxLines)
    const ceiling =
      nameContentMm(nameFitted.fontMm, lines) +
      0.2 +
      (showSku ? NAME_BEFORE_SKU_PAD_MM : 0)
    if (nameRow > ceiling + 0.05) {
      const spare = nameRow - ceiling
      nameRow = Number(ceiling.toFixed(2))
      if (showBarcode) barcodeRow = Number((barcodeRow + spare).toFixed(2))
    }
  }

  // Teljes / Nagy SKU: row font; then cap name below SKU on Teljes
  const skuFont =
    skuPlacement === 'row'
      ? mode === 'warehouse'
        ? clampFont(SKU_WAREHOUSE_FONT_MM, skuRow * 0.92, 3.4)
        : clampFont(SKU_SECONDARY_FONT_MM, skuRow * 0.92, 3.2)
      : 0

  let nameFont = nameFitted.fontMm
  if (showName && showSku && skuFont > 0) {
    // SKU fontosabb / nagyobb, mint a név
    const nameCap = Math.max(NAME_MIN_FONT, skuFont - SKU_OVER_NAME_MM)
    nameFont = Math.min(nameFont, nameCap)
    nameFont = clampFont(nameFont, nameRow / 1.12, Math.min(NAME_MIN_FONT, nameCap))
  }

  // Inline price: amount + /unit — size hierarchy, weight 550 in sheet
  let priceFont = showPrice
    ? clampFont(desiredPriceFont(input.price), priceRow * 0.9, 3.4)
    : 0
  let unitFont = showPrice
    ? Number(
        Math.max(
          UNIT_MIN_FONT_MM,
          Math.min(priceFont * 0.48, priceRow * 0.42)
        ).toFixed(2)
      )
    : 0
  if (showPrice && Math.max(priceFont, unitFont) > priceRow - 0.2) {
    priceFont = clampFont(priceFont, priceRow - 0.25, 3.2)
    unitFont = Number(
      Math.max(1.7, Math.min(unitFont, priceFont * 0.48)).toFixed(2)
    )
  }

  const barcodeSecondary = showHumanReadable ? 1.55 : 0

  // Tighten name to content (clipped to max lines) — spare → barcode
  if (showName && nameRow > 0) {
    const lines = Math.min(nameFitted.lines, nameMaxLines)
    const tight =
      nameContentMm(nameFont, lines) +
      0.15 +
      (showSku ? NAME_BEFORE_SKU_PAD_MM : 0)
    if (tight + 0.1 < nameRow) {
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
      // Never grow name when SKU is present (overlap risk) — give to barcode
      if (showBarcode) {
        barcodeRow = Number((barcodeRow + spare).toFixed(2))
      } else if (showName && !showSku) {
        nameRow = Number((nameRow + spare).toFixed(2))
      }
    }
  }

  const barcodeZone = showBarcode ? barcodeRow : 0

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
          secondaryFontMm: 0,
          maxLines: nameMaxLines
        }
      : null,
    sku:
      showSku && skuPlacement
        ? {
            rowMm: skuRow,
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
