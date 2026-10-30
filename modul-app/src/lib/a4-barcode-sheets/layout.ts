/**
 * A4 cell zones — scale with cell size (4×6 dense / 2×4 wall-readable).
 */

import type { A4CellFields } from '@/lib/a4-barcode-sheets/types'
import {
  A4_BARCODE_HARD_MIN_H_MM,
  A4_BARCODE_TARGET_MIN_H_MM
} from '@/lib/a4-barcode-sheets/barcode-render'

export const A4_CELL_PAD_MM = 1.4
/** Gap between stacked text blocks (mm) — scales lightly with cell. */
export const A4_STACK_GAP_MM = 0.4

/** Cap barcode on medium cells; large cells use higher frac/cap. */
export const A4_BARCODE_ZONE_MAX_MM = 11.5
export const A4_BARCODE_ZONE_FRAC = 0.28

/** Baseline bands @ ~4×6 (contentH ≈ 45 mm). */
export const A4_TEXT_BAND_MM = {
  nameLine: 4.4,
  sku: 5.8,
  price: 6.4
} as const

/** Reference content height for scale=1 (4×6 ≈ 50×48 cell). */
export const A4_LAYOUT_REF_CONTENT_H_MM = 45

/** Legacy weights kept for allocateZoneMm helpers / docs. */
export const A4_ZONE_WEIGHT = {
  name: 32,
  sku: 14,
  price: 26,
  barcode: 28
} as const

export type A4ZoneId = keyof typeof A4_ZONE_WEIGHT

export type A4ZoneBox = {
  yFromTop: number
  height: number
}

export type A4CellPack = {
  contentW: number
  contentH: number
  /** ≥1 — drives band/font/barcode growth on 2×4. */
  layoutScale: number
  zones: Record<A4ZoneId, A4ZoneBox>
  nameMaxChars: number
  nameCharsPerLine: number
  nameLinesBudget: 1 | 2
  barcodeSoftWarning: string | null
}

export function allocateZoneMm(
  weights: Partial<Record<A4ZoneId, number>>,
  totalMm: number
): Record<A4ZoneId, number> {
  const ids = (Object.keys(A4_ZONE_WEIGHT) as A4ZoneId[]).filter(
    (k) => (weights[k] ?? 0) > 0
  )
  const result: Record<A4ZoneId, number> = {
    name: 0,
    sku: 0,
    price: 0,
    barcode: 0
  }
  if (totalMm <= 0 || ids.length === 0) return result

  const sumW = ids.reduce((s, k) => s + (weights[k] ?? 0), 0)
  const exact = ids.map((k) => {
    const raw = ((weights[k] ?? 0) / sumW) * totalMm
    const floor = Math.floor(raw * 100) / 100
    return { k, raw, floor, frac: raw - floor }
  })
  let rem =
    Math.round((totalMm - exact.reduce((s, e) => s + e.floor, 0)) * 100) / 100
  exact.sort((a, b) => b.frac - a.frac)
  for (const e of exact) {
    if (rem < 0.005) break
    e.floor = Math.round((e.floor + 0.01) * 100) / 100
    rem = Math.round((rem - 0.01) * 100) / 100
  }
  for (const e of exact) result[e.k] = e.floor
  return result
}

/** Default product name snap length (editor + place). */
export const A4_NAME_DEFAULT_MAX_CHARS = 44

export function nameCharsPerLineForWidth(contentWMm: number): number {
  return Math.max(
    12,
    Math.min(
      Math.ceil(A4_NAME_DEFAULT_MAX_CHARS / 2),
      Math.floor(contentWMm / 1.75)
    )
  )
}

/** Always 44 — cell width must not shorten the snap. */
export function nameMaxCharsForWidth(_contentWMm: number): number {
  void _contentWMm
  return A4_NAME_DEFAULT_MAX_CHARS
}

/** Layout scale from cell content height (1 @ 4×6, ~1.55 @ 2×4). */
export function a4LayoutScale(contentHMm: number): number {
  return Math.max(1, Math.min(2.15, contentHMm / A4_LAYOUT_REF_CONTENT_H_MM))
}

function emptyZones(): Record<A4ZoneId, A4ZoneBox> {
  return {
    name: { yFromTop: 0, height: 0 },
    sku: { yFromTop: 0, height: 0 },
    price: { yFromTop: 0, height: 0 },
    barcode: { yFromTop: 0, height: 0 }
  }
}

function barcodeZoneTarget(contentH: number, scale: number): number {
  const frac = scale >= 1.35 ? 0.26 : A4_BARCODE_ZONE_FRAC
  const maxMm = scale >= 1.35 ? Math.min(22, 11.5 * scale) : A4_BARCODE_ZONE_MAX_MM
  return Math.min(
    maxMm,
    Math.max(A4_BARCODE_HARD_MIN_H_MM, contentH * frac)
  )
}

/**
 * Pack: scale bands with cell size; fill cell on 2×4; barcode pinned bottom.
 */
export function packA4Cell(
  cellWMm: number,
  cellHMm: number,
  fields: A4CellFields,
  opts?: { nameLineCount?: 1 | 2 }
): A4CellPack {
  const pad = A4_CELL_PAD_MM
  const contentW = Math.max(1, cellWMm - 2 * pad)
  const contentH = Math.max(1, cellHMm - 2 * pad)
  const scale = a4LayoutScale(contentH)
  const stackGap = A4_STACK_GAP_MM * Math.min(1.4, 0.7 + scale * 0.3)
  const perLine = nameCharsPerLineForWidth(contentW)
  const nameLinesBudget: 1 | 2 = opts?.nameLineCount === 1 ? 1 : 2

  const nameLineMm = A4_TEXT_BAND_MM.nameLine * scale
  const skuBandMm = A4_TEXT_BAND_MM.sku * scale
  const priceBandMm = A4_TEXT_BAND_MM.price * scale
  const nameCapMm = Math.min(
    contentH * (scale >= 1.35 ? 0.32 : 0.22),
    nameLineMm * nameLinesBudget * 1.05
  )

  const base: A4CellPack = {
    contentW,
    contentH,
    layoutScale: scale,
    zones: emptyZones(),
    nameMaxChars: A4_NAME_DEFAULT_MAX_CHARS,
    nameCharsPerLine: perLine,
    nameLinesBudget,
    barcodeSoftWarning: null
  }

  const showName = fields.showName
  const showSku = fields.showSku
  const showPrice = fields.showPrice
  const showBarcode = fields.showBarcode
  const textOn = [showName, showSku, showPrice].filter(Boolean).length

  if (!showName && !showSku && !showPrice && !showBarcode) {
    return base
  }

  if (showBarcode && textOn === 0) {
    return {
      ...base,
      zones: {
        ...emptyZones(),
        barcode: { yFromTop: 0, height: contentH }
      },
      barcodeSoftWarning:
        contentH < A4_BARCODE_TARGET_MIN_H_MM
          ? `Vonalkód ~${contentH.toFixed(0)} mm — válts nagyobb cellára.`
          : null
    }
  }

  const gapCount = Math.max(0, textOn - 1) + (showBarcode && textOn > 0 ? 1 : 0)
  const gapsTotal = gapCount * stackGap

  let barcodeH = showBarcode ? barcodeZoneTarget(contentH, scale) : 0
  let textAvail = Math.max(0, contentH - barcodeH - gapsTotal)

  const minText =
    (showName ? nameLineMm * 0.7 : 0) +
    (showSku ? skuBandMm * 0.65 : 0) +
    (showPrice ? priceBandMm * 0.65 : 0)
  if (showBarcode && textAvail < minText) {
    const need = minText - textAvail
    barcodeH = Math.max(A4_BARCODE_HARD_MIN_H_MM, barcodeH - need)
    textAvail = Math.max(0, contentH - barcodeH - gapsTotal)
  }

  let nameH = 0
  let skuH = 0
  let priceH = 0

  if (textOn > 0 && textAvail > 0) {
    if (showName) {
      nameH = Math.min(nameCapMm, textAvail * (scale >= 1.35 ? 0.34 : 0.4))
    }
    let rem = Math.max(0, textAvail - nameH)

    if (scale >= 1.35) {
      // 2×4 wall: fill rem across name boost + sku + price
      const weights: Partial<Record<'name' | 'sku' | 'price', number>> = {}
      if (showName) weights.name = 26
      if (showSku) weights.sku = 38
      if (showPrice) weights.price = 36
      const sumW =
        Object.values(weights).reduce((s, w) => s + (w ?? 0), 0) || 1
      const addName = showName ? (rem * (weights.name ?? 0)) / sumW : 0
      nameH = Math.min(nameCapMm * 1.15, nameH + addName)
      rem = Math.max(0, textAvail - nameH)
      const sum2 =
        (showSku ? 38 : 0) + (showPrice ? 36 : 0) || 1
      skuH = showSku ? (rem * 38) / sum2 : 0
      priceH = showPrice ? (rem * 36) / sum2 : 0
    } else {
      const weights: Partial<Record<'sku' | 'price', number>> = {}
      if (showSku) weights.sku = 48
      if (showPrice) weights.price = 40
      const sumW =
        Object.values(weights).reduce((s, w) => s + (w ?? 0), 0) || 1
      if (sumW > 0) {
        skuH = showSku ? (rem * (weights.sku ?? 0)) / sumW : 0
        priceH = showPrice ? (rem * (weights.price ?? 0)) / sumW : 0
      }
      if (showSku) skuH = Math.max(skuH, Math.min(skuBandMm, rem * 0.35))
      if (showPrice)
        priceH = Math.max(priceH, Math.min(priceBandMm, rem * 0.35))
      const used = skuH + priceH
      if (used > rem && used > 0) {
        const s = rem / used
        skuH *= s
        priceH *= s
      }
    }
  }

  const textBlock =
    nameH + skuH + priceH + Math.max(0, textOn - 1) * stackGap
  const spaceAboveBar = Math.max(
    0,
    contentH - barcodeH - (showBarcode && textOn > 0 ? stackGap : 0)
  )
  // Large cells: less floating pad — fill; medium: slight optical center
  const topPad =
    textOn > 0
      ? Math.max(
          0,
          (spaceAboveBar - textBlock) * (scale >= 1.35 ? 0.12 : 0.42)
        )
      : 0

  const zones = emptyZones()
  let y = topPad
  if (showName) {
    zones.name = { yFromTop: y, height: Math.round(nameH * 100) / 100 }
    y += nameH + (showSku || showPrice || showBarcode ? stackGap : 0)
  }
  if (showSku) {
    zones.sku = { yFromTop: y, height: Math.round(skuH * 100) / 100 }
    y += skuH + (showPrice || showBarcode ? stackGap : 0)
  }
  if (showPrice) {
    zones.price = { yFromTop: y, height: Math.round(priceH * 100) / 100 }
    y += priceH + (showBarcode ? stackGap : 0)
  }
  if (showBarcode) {
    const barTop = Math.max(y, contentH - barcodeH)
    zones.barcode = {
      yFromTop: Math.round(barTop * 100) / 100,
      height: Math.round((contentH - barTop) * 100) / 100
    }
  }

  const linesBudget: 1 | 2 =
    showName && zones.name.height < nameLineMm * 1.15 ? 1 : nameLinesBudget

  return {
    contentW,
    contentH,
    layoutScale: scale,
    zones,
    nameMaxChars: A4_NAME_DEFAULT_MAX_CHARS,
    nameCharsPerLine: perLine,
    nameLinesBudget: linesBudget,
    barcodeSoftWarning:
      showBarcode &&
      zones.barcode.height > 0 &&
      zones.barcode.height < A4_BARCODE_TARGET_MIN_H_MM
        ? `Vonalkód ~${zones.barcode.height.toFixed(0)} mm — biztosabb scanhez 2×4 rács.`
        : null
  }
}

/** Hard cut — no ellipsis (PDF WinAnsi would expand … → "..." and shrink line 2). */
export function truncateA4(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max))
}

/**
 * Wrap to ≤2 lines — never drops characters from `name`
 * (already hard-capped to 44). Long line 2 → PDF shrinks shared font.
 */
export function fitNameLines(
  name: string,
  maxCharsPerLine: number
): [string] | [string, string] {
  const t = name.trim()
  if (!t) return ['']
  if (t.length <= maxCharsPerLine) return [t]

  const target = Math.max(8, maxCharsPerLine)
  const words = t.split(/\s+/)

  if (words.length === 1) {
    const splitAt = Math.min(target, Math.ceil(t.length / 2))
    return [t.slice(0, splitAt), t.slice(splitAt)]
  }

  let line1 = ''
  let i = 0
  for (; i < words.length; i++) {
    const next = line1 ? `${line1} ${words[i]}` : words[i]
    if (next.length > target && line1) break
    line1 = next
  }
  if (!line1) {
    const splitAt = Math.min(target, Math.ceil(t.length / 2))
    return [t.slice(0, splitAt), t.slice(splitAt)]
  }
  const rest = words.slice(i).join(' ')
  if (!rest) return [line1]
  return [line1, rest]
}

export function fitFontSizePt(
  zoneHMm: number,
  lines: number,
  opts?: { min?: number; max?: number }
): number {
  const min = opts?.min ?? 7
  const max = opts?.max ?? 22
  const lineCount = Math.max(1, lines)
  const pt = (zoneHMm / lineCount / 1.12) * (72 / 25.4)
  return Math.min(max, Math.max(min, pt))
}

/** ASCII space ezres tagoló — Helvetica/PDF-safe (nem NBSP). */
export function formatA4PriceAmount(priceGross: number): string {
  const n = Math.round(priceGross)
  const abs = Math.abs(n).toString()
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return n < 0 ? `-${grouped}` : grouped
}

export function formatA4PriceLine(
  priceGross: number | null | undefined,
  unitSnap: string | null | undefined
): string | null {
  if (priceGross == null || !Number.isFinite(priceGross)) return null
  const unit = (unitSnap ?? '').trim() || 'db'
  return `${formatA4PriceAmount(priceGross)} Ft/${unit}`
}
