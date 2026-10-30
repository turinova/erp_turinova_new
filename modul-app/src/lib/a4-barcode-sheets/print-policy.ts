/**
 * A4 cell barcode policy — separate from 33×25 ZPL (do not call resolvePrintableBarcode blindly).
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import {
  estimateBarcodeModules,
  BARCODE_MIN_X_MM
} from '@/lib/labels/layout'
import type { LabelBarcodeSource } from '@/lib/labels/types'

/** Quiet zone each side on office laser / inkjet (mm). */
const A4_QUIET_MM = 1.5

/** Pad inside cell for text / borders (mm) — barcode uses remaining width. */
const A4_CELL_PAD_MM = 2

export type A4ResolveResult = {
  value: string | null
  source: LabelBarcodeSource | 'none'
  forcedInternal: boolean
  blocked: boolean
  message: string | null
  action: 'ok' | 'use_internal' | 'create_internal' | 'skip'
}

export function a4FitsCode(
  code: string,
  cellInnerWidthMm: number
): boolean {
  const raw = code.trim()
  if (!raw) return false
  const usable = Math.max(1, cellInnerWidthMm - 2 * A4_CELL_PAD_MM)
  const modules = estimateBarcodeModules(raw)
  const quiet = A4_QUIET_MM
  const x = (usable - 2 * quiet) / modules
  return x >= BARCODE_MIN_X_MM * 0.95
}

/**
 * Prefer valid internal EAN; fit against cell width (not 33×25).
 */
export function resolveA4PrintableBarcode(
  payload: {
    barcode: string | null | undefined
    barcodeInternal: string | null | undefined
  },
  cellInnerWidthMm: number,
  source: LabelBarcodeSource = 'auto'
): A4ResolveResult {
  const supplier = payload.barcode?.trim() || ''
  const internal = payload.barcodeInternal?.trim() || ''
  const hasValidInternal = Boolean(internal && isValidEan13(internal))

  let requested: string | null = null
  if (source === 'supplier') requested = supplier || null
  else if (source === 'internal') requested = internal || null
  else {
    if (hasValidInternal) requested = internal
    else if (supplier) requested = supplier
    else requested = internal || null
  }

  if (!requested) {
    return {
      value: null,
      source: 'none',
      forcedInternal: false,
      blocked: true,
      message:
        'Nincs nyomtatható vonalkód. Generálj belső EAN-t a terméken, vagy add meg a gyártói kódot.',
      action: 'create_internal'
    }
  }

  if (a4FitsCode(requested, cellInnerWidthMm)) {
    const usingInternal = hasValidInternal && requested === internal
    return {
      value: requested,
      source: usingInternal ? 'internal' : source === 'auto' ? (usingInternal ? 'internal' : 'supplier') : source,
      forcedInternal: false,
      blocked: false,
      message: null,
      action: 'ok'
    }
  }

  // Requested too wide — try internal EAN if different
  if (
    hasValidInternal &&
    requested !== internal &&
    a4FitsCode(internal, cellInnerWidthMm)
  ) {
    return {
      value: internal,
      source: 'internal',
      forcedInternal: true,
      blocked: false,
      message:
        'A gyártói kód nem fér a cellába scannelhetően — belső EAN-t használunk.',
      action: 'ok'
    }
  }

  if (hasValidInternal && requested === internal) {
    return {
      value: null,
      source: 'none',
      forcedInternal: false,
      blocked: true,
      message:
        'A vonalkód nem fér scannelhetően ebbe a cellába. Válassz ritkább rácsot (pl. 2×4).',
      action: 'skip'
    }
  }

  return {
    value: null,
    source: 'none',
    forcedInternal: false,
    blocked: true,
    message: hasValidInternal
      ? 'A gyártói kód nem fér a cellába. Válaszd a belső EAN-t, vagy ritkább rácsot.'
      : 'A gyártói kód nem fér a cellába scannelhetően. Generálj belső EAN-t, vagy ritkább rácsot.',
    action: hasValidInternal ? 'use_internal' : 'create_internal'
  }
}
