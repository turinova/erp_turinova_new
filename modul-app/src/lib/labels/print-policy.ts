/**
 * 33×25 mm barcode print policy — physics + clerk hard gates.
 * Long CODE128 (e.g. DT-CZ…) cannot fit at scannable ^BY2; force internal EAN.
 */

import { isValidEan13 } from '@/lib/barcodes/ean13'
import { code128Fits33mm, ean13Data12ForZpl } from '@/lib/labels/zpl'
import type {
  LabelBarcodeSource,
  ProductLabelPayload
} from '@/lib/labels/types'

export type BarcodeScanKind = 'ean13' | 'code128_ok' | 'code128_overflow' | 'empty'

export function classifyBarcodeFor33x25(code: string | null | undefined): {
  kind: BarcodeScanKind
  value: string | null
} {
  const v = code?.trim() || ''
  if (!v) return { kind: 'empty', value: null }
  if (ean13Data12ForZpl(v)) return { kind: 'ean13', value: v }
  if (code128Fits33mm(v)) return { kind: 'code128_ok', value: v }
  return { kind: 'code128_overflow', value: v }
}

export function isScannableOn33x25(code: string | null | undefined): boolean {
  const k = classifyBarcodeFor33x25(code).kind
  return k === 'ean13' || k === 'code128_ok'
}

export type ResolvePrintableBarcodeResult = {
  /** Code to send to ZPL / sheet (null = no barcode). */
  value: string | null
  /** Effective source after policy. */
  source: LabelBarcodeSource | 'none'
  /** True when we overrode supplier/auto to internal EAN. */
  forcedInternal: boolean
  /** True when barcode cannot be printed scannably. */
  blocked: boolean
  /** Clerk-facing message (null if OK). */
  message: string | null
  /** Suggested action. */
  action: 'ok' | 'use_internal' | 'create_internal' | 'print_without_barcode'
}

/**
 * Resolve what may be printed on 33×25.
 * Overflow CODE128 → valid internal EAN if present; else blocked.
 */
export function resolvePrintableBarcode(
  payload: Pick<ProductLabelPayload, 'barcode' | 'barcodeInternal'>,
  source: LabelBarcodeSource = 'auto'
): ResolvePrintableBarcodeResult {
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

  const supplierOverflow =
    Boolean(supplier) &&
    classifyBarcodeFor33x25(supplier).kind === 'code128_overflow'

  const classified = classifyBarcodeFor33x25(requested)

  if (classified.kind === 'ean13' || classified.kind === 'code128_ok') {
    const usingInternal =
      hasValidInternal && classified.value === internal
    const warnForced = usingInternal && supplierOverflow
    return {
      value: classified.value,
      source: usingInternal ? 'internal' : source,
      forcedInternal: warnForced,
      blocked: false,
      message: null,
      action: warnForced ? 'use_internal' : 'ok'
    }
  }

  if (classified.kind === 'code128_overflow') {
    if (hasValidInternal) {
      return {
        value: internal,
        source: 'internal',
        forcedInternal: true,
        blocked: false,
        message: null,
        action: 'use_internal'
      }
    }
    return {
      value: null,
      source: 'none',
      forcedInternal: false,
      blocked: true,
      message:
        'Nincs belső EAN. A gyártói kód nem fér olvashatóan a 33×25 címkére. Generálj belső vonalkódot a terméken, vagy kapcsold ki a Vonalkód mezőt.',
      action: 'create_internal'
    }
  }

  // empty requested
  if (hasValidInternal) {
    const warnForced = supplierOverflow
    return {
      value: internal,
      source: 'internal',
      forcedInternal: warnForced || source !== 'internal',
      blocked: false,
      message: null,
      action: warnForced ? 'use_internal' : 'ok'
    }
  }

  if (supplier) {
    const s = classifyBarcodeFor33x25(supplier)
    if (s.kind === 'ean13' || s.kind === 'code128_ok') {
      return {
        value: supplier,
        source: 'supplier',
        forcedInternal: false,
        blocked: false,
        message: null,
        action: 'ok'
      }
    }
    return {
      value: null,
      source: 'none',
      forcedInternal: false,
      blocked: true,
      message:
        'Nincs belső EAN. A gyártói kód nem fér olvashatóan a 33×25 címkére. Generálj belső vonalkódot a terméken, vagy kapcsold ki a Vonalkód mezőt.',
      action: 'create_internal'
    }
  }

  return {
    value: null,
    source: 'none',
    forcedInternal: false,
    blocked: true,
    message:
      'Nincs nyomtatható vonalkód. Generálj belső EAN-t a terméken, vagy kapcsold ki a Vonalkód mezőt.',
    action: 'create_internal'
  }
}

/** Default source for dialog open — prefer internal EAN; never default to overflow supplier. */
export function defaultBarcodeSource(
  payload: ProductLabelPayload | null
): LabelBarcodeSource {
  if (!payload) return 'auto'
  const internal = payload.barcodeInternal?.trim() || ''
  const supplier = payload.barcode?.trim() || ''
  if (internal && isValidEan13(internal)) return 'internal'
  if (supplier && isScannableOn33x25(supplier)) return 'supplier'
  if (internal && !supplier) return 'internal'
  if (supplier && !isScannableOn33x25(supplier)) {
    // Prefer auto so resolve can show create_internal; UI will block
    return 'auto'
  }
  return 'auto'
}
