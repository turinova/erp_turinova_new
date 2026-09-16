import { z } from 'zod'

import {
  grossFromNet,
  netFromGross,
  parseDecimalInput
} from '@/lib/sheet-materials/parse'

/** Parse optional form fields; empty = null. Both or neither when any filled. */
export function parseOptionalPurchaseMargin(
  purchaseRaw: string,
  marginRaw: string
):
  | {
      ok: true
      purchasePriceNet: number | null
      marginFactor: number | null
    }
  | { ok: false; fieldErrors: Record<string, string> } {
  const pTrim = purchaseRaw.trim()
  const mTrim = marginRaw.trim()
  if (!pTrim && !mTrim) {
    return { ok: true, purchasePriceNet: null, marginFactor: null }
  }
  const fieldErrors: Record<string, string> = {}
  const purchase = pTrim ? parseDecimalInput(pTrim) : null
  const margin = mTrim ? parseDecimalInput(mTrim) : null
  if (pTrim && (purchase === null || purchase < 0)) {
    fieldErrors.purchasePriceNet = 'Érvényes beszerzési nettót adj meg.'
  }
  if (mTrim && (margin === null || margin <= 0 || margin > 100)) {
    fieldErrors.marginFactor = 'Érvényes szorzót adj meg (pl. 1.35).'
  }
  if (purchase != null && margin == null && !fieldErrors.marginFactor) {
    fieldErrors.marginFactor = 'Árrés szorzó is kell, vagy töröld a beszerzést.'
  }
  if (margin != null && purchase == null && !fieldErrors.purchasePriceNet) {
    fieldErrors.purchasePriceNet =
      'Beszerzési nettó is kell, vagy töröld a szorzót.'
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }
  return {
    ok: true,
    purchasePriceNet: purchase,
    marginFactor: margin
  }
}

/** Eladási nettó = round(beszerzés × szorzó). */
export function sellNetFromPurchase(
  purchasePriceNet: number,
  marginFactor: number
): number {
  return Math.round(purchasePriceNet * marginFactor)
}

export function sellGrossFromPurchase(
  purchasePriceNet: number,
  marginFactor: number,
  vatPercent: number
): number {
  return grossFromNet(
    sellNetFromPurchase(purchasePriceNet, marginFactor),
    vatPercent
  )
}

export const optionalPurchasePriceNetSchema = z
  .number({ invalid_type_error: 'Érvényes beszerzési nettót adj meg.' })
  .min(0, 'A beszerzési ár nem lehet negatív.')
  .nullable()

export const optionalMarginFactorSchema = z
  .number({ invalid_type_error: 'Érvényes árrés szorzót adj meg.' })
  .gt(0, 'A szorzó legyen nagyobb mint 0.')
  .max(100, 'A szorzó legfeljebb 100.')
  .nullable()

export type ResolveSellNetInput = {
  /** Eladási bruttó — ha megvan, ez a forrás. */
  priceGross: number | null
  purchasePriceNet: number | null
  marginFactor: number | null
  vatPercent: number
}

export type ResolveSellNetResult =
  | {
      ok: true
      priceNet: number
      purchasePriceNet: number | null
      marginFactor: number | null
    }
  | { ok: false; message: string }

/**
 * Excel / bulk: bruttó elsőbbség; ha nincs, beszerzés × szorzó.
 * A purchase/margin mindig továbbadódik (tárolásra), ha meg voltak adva.
 */
export function resolveSellNetFromPricing(
  input: ResolveSellNetInput
): ResolveSellNetResult {
  const purchase = input.purchasePriceNet
  const factor = input.marginFactor

  if (purchase != null && factor == null) {
    return {
      ok: false,
      message: 'Árrés szorzó is kell a beszerzési ár mellé (vagy hagyd mindkettőt üresen).'
    }
  }
  if (factor != null && purchase == null) {
    return {
      ok: false,
      message: 'Beszerzési nettó is kell az árrés szorzó mellé (vagy hagyd mindkettőt üresen).'
    }
  }

  if (input.priceGross != null) {
    if (input.priceGross < 0) {
      return { ok: false, message: 'Érvénytelen bruttó eladási ár.' }
    }
    return {
      ok: true,
      priceNet: netFromGross(input.priceGross, input.vatPercent),
      purchasePriceNet: purchase,
      marginFactor: factor
    }
  }

  if (purchase != null && factor != null) {
    return {
      ok: true,
      priceNet: sellNetFromPurchase(purchase, factor),
      purchasePriceNet: purchase,
      marginFactor: factor
    }
  }

  return {
    ok: false,
    message:
      'Adj meg bruttó eladási árat, vagy beszerzési nettót + árrés szorzót.'
  }
}
