/**
 * Sharp A4 barcode PNG — integer module pixels + quiet zone; no soft stretch.
 * Browser-only (canvas).
 */

import JsBarcode from 'jsbarcode'

import { isValidEan13 } from '@/lib/barcodes/ean13'
import {
  BARCODE_MIN_X_MM,
  estimateBarcodeModules
} from '@/lib/labels/layout'

const MODULE_PX = 4
/** Code128 / EAN quiet ≈ 10 modules; keep ≥ this many. */
const QUIET_MODULES = 10
/** Prefer bar height for handheld POS (mm). Soft floor / hard floor / visual cap. */
export const A4_BARCODE_TARGET_MIN_H_MM = 9
export const A4_BARCODE_HARD_MIN_H_MM = 7
/** Soft cap on medium cells; large zones (2×4) may draw taller via zoneH. */
export const A4_BARCODE_DRAW_MAX_H_MM = 11
export const A4_BARCODE_DRAW_MAX_LARGE_H_MM = 20

export type A4BarcodeRenderResult =
  | {
      ok: true
      dataUrl: string
      drawWidthMm: number
      drawHeightMm: number
      xMm: number
      quietMm: number
      softWarning: string | null
    }
  | { ok: false; message: string }

/**
 * Fit barcode into zone (full width incl. quiet). Bars fill height as much as possible.
 */
export function renderA4BarcodePng(input: {
  value: string
  zoneWidthMm: number
  zoneHeightMm: number
}): A4BarcodeRenderResult {
  const raw = input.value.trim()
  if (!raw) {
    return { ok: false, message: 'Üres vonalkód.' }
  }
  if (typeof document === 'undefined') {
    return { ok: false, message: 'Canvas nem elérhető.' }
  }

  const modules = estimateBarcodeModules(raw)
  const totalModules = modules + 2 * QUIET_MODULES
  const zoneW = Math.max(8, input.zoneWidthMm)
  const zoneH = Math.max(4, input.zoneHeightMm)

  let xMm = zoneW / totalModules
  if (xMm < BARCODE_MIN_X_MM) {
    // Shrink quiet to 7 modules (GS1 allows ~7 mm at 0.5 X with tolerance)
    const totalTight = modules + 2 * 7
    xMm = zoneW / totalTight
    if (xMm < BARCODE_MIN_X_MM * 0.92) {
      return {
        ok: false,
        message:
          'A vonalkód nem fér scannelhetően a cellába. Válassz ritkább rácsot (pl. 2×4) vagy belső EAN-t.'
      }
    }
  }

  const quietMods = xMm >= BARCODE_MIN_X_MM ? QUIET_MODULES : 7
  const quietMm = quietMods * xMm
  const drawWidthMm = (modules + 2 * quietMods) * xMm
  // Medium cells: ~11 mm; wall/2×4 zones grow up to LARGE max
  const barCap =
    zoneH > 14 ? A4_BARCODE_DRAW_MAX_LARGE_H_MM : A4_BARCODE_DRAW_MAX_H_MM
  const drawHeightMm = Math.min(
    barCap,
    zoneH * 0.94,
    Math.max(A4_BARCODE_HARD_MIN_H_MM, Math.min(zoneH, barCap))
  )

  const barHeightPx = Math.max(
    40,
    Math.round((drawHeightMm / xMm) * MODULE_PX)
  )

  const canvas = document.createElement('canvas')
  const format = isValidEan13(raw) ? 'EAN13' : 'CODE128'
  try {
    JsBarcode(canvas, raw, {
      format,
      displayValue: false,
      margin: quietMods * MODULE_PX,
      width: MODULE_PX,
      height: barHeightPx,
      background: '#ffffff',
      lineColor: '#000000'
    })
  } catch {
    return { ok: false, message: 'Nem sikerült a vonalkód rajzolása.' }
  }

  const softWarning =
    drawHeightMm < A4_BARCODE_TARGET_MIN_H_MM
      ? `A vonalkód magassága ~${drawHeightMm.toFixed(0)} mm — biztosabb scanhez válts nagyobb cellára (2×4).`
      : null

  return {
    ok: true,
    dataUrl: canvas.toDataURL('image/png'),
    drawWidthMm,
    drawHeightMm,
    xMm,
    quietMm,
    softWarning
  }
}
