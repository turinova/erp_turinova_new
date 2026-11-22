/**
 * Kiosk Méret — Opti parity (`maxGrainMm` / `maxCrossMm`).
 * Soft &lt;150 mm csak kiosk (doc 61).
 */

import { maxCrossMm, maxGrainMm } from '@/lib/opti/queries'

export type KioskBoardDims = {
  lengthMm: number
  widthMm: number
  trimLeftMm: number
  trimRightMm: number
  trimTopMm: number
  trimBottomMm: number
  /** Szálirányos dekor: majdnem négyzetnél figyelmeztetünk (felcserélt méret). */
  grainDirection?: boolean
}

export const KIOSK_SOFT_MIN_MM = 150

/** Ennél kisebb arányos eltérésnél a darab „majdnem négyzet”. */
export const KIOSK_NEAR_SQUARE_RATIO = 0.1

export function isNearSquare(grainMm: number, crossMm: number): boolean {
  if (!(grainMm > 0 && crossMm > 0)) return false
  const larger = Math.max(grainMm, crossMm)
  return Math.abs(grainMm - crossMm) / larger <= KIOSK_NEAR_SQUARE_RATIO
}

export function toOptiDimMaterial(sheet: KioskBoardDims) {
  return {
    length_mm: sheet.lengthMm,
    width_mm: sheet.widthMm,
    trim_left_mm: sheet.trimLeftMm,
    trim_right_mm: sheet.trimRightMm,
    trim_top_mm: sheet.trimTopMm,
    trim_bottom_mm: sheet.trimBottomMm
  }
}

export function kioskMaxGrainMm(sheet: KioskBoardDims): number {
  return maxGrainMm(toOptiDimMaterial(sheet))
}

export function kioskMaxCrossMm(sheet: KioskBoardDims): number {
  return maxCrossMm(toOptiDimMaterial(sheet))
}

/** Opti clampDimensionRaw parity — ha > max, a max kerül a mezőbe. */
export function clampDimensionRaw(raw: string, maxMm: number | null): string {
  const trimmed = raw.trim()
  if (!trimmed) return raw
  const num = Number.parseFloat(trimmed.replace(',', '.'))
  if (!Number.isFinite(num) || num <= 0) return raw
  if (maxMm !== null && num > maxMm) return String(maxMm)
  return raw
}

export function formatGrainMaxHint(sheet: KioskBoardDims): string {
  const max = kioskMaxGrainMm(sheet)
  if (
    sheet.trimLeftMm === 0 &&
    sheet.trimRightMm === 0
  ) {
    return `Max: ${max} mm`
  }
  return `Max: ${max} mm (${sheet.lengthMm} − ${sheet.trimLeftMm} − ${sheet.trimRightMm})`
}

export function formatCrossMaxHint(sheet: KioskBoardDims): string {
  const max = kioskMaxCrossMm(sheet)
  if (sheet.trimTopMm === 0 && sheet.trimBottomMm === 0) {
    return `Max: ${max} mm`
  }
  return `Max: ${max} mm (${sheet.widthMm} − ${sheet.trimTopMm} − ${sheet.trimBottomMm})`
}

export type KioskSizeValidation = {
  hardErrors: string[]
  softWarn: string | null
  hardBlock: boolean
  maxGrain: number
  maxCross: number
}

export function validateKioskSize(input: {
  sheet: KioskBoardDims | null
  grainRaw: string
  crossRaw: string
  grainMm: number | null
  crossMm: number | null
}): KioskSizeValidation {
  const maxGrain = input.sheet ? kioskMaxGrainMm(input.sheet) : 0
  const maxCross = input.sheet ? kioskMaxCrossMm(input.sheet) : 0
  const hardErrors: string[] = []

  if (!input.sheet) {
    return {
      hardErrors: ['Válassz lapot.'],
      softWarn: null,
      hardBlock: true,
      maxGrain,
      maxCross
    }
  }

  if (maxGrain <= 0 || maxCross <= 0) {
    hardErrors.push('Ez a lap nem vágható (szélezés / táblaméret). Kérj segítséget a pultnál.')
  }

  if (input.grainRaw.trim() && input.grainMm == null) {
    hardErrors.push('A szálirány nem érvényes szám.')
  }
  if (input.crossRaw.trim() && input.crossMm == null) {
    hardErrors.push('A keresztirány nem érvényes szám.')
  }

  if (input.grainMm != null && input.grainMm > maxGrain) {
    hardErrors.push(`A szálirány max. ${maxGrain} mm.`)
  }
  if (input.crossMm != null && input.crossMm > maxCross) {
    hardErrors.push(`A keresztirány max. ${maxCross} mm.`)
  }

  let softWarn: string | null = null
  if (
    (input.grainMm != null &&
      input.grainMm > 0 &&
      input.grainMm < KIOSK_SOFT_MIN_MM) ||
    (input.crossMm != null &&
      input.crossMm > 0 &&
      input.crossMm < KIOSK_SOFT_MIN_MM)
  ) {
    softWarn =
      'Biztos? 150 mm alatt nagyon kicsi. Ha centit mértél, szorozd 10-zel.'
  } else if (
    input.sheet.grainDirection &&
    input.grainMm != null &&
    input.crossMm != null &&
    input.grainMm !== input.crossMm &&
    isNearSquare(input.grainMm, input.crossMm)
  ) {
    softWarn =
      'Majdnem négyzet alakú darab. Nézd meg még egyszer, melyik méret a szálirány.'
  }

  const hardBlock =
    !input.sheet ||
    input.grainMm == null ||
    input.crossMm == null ||
    input.grainMm > maxGrain ||
    input.crossMm > maxCross ||
    maxGrain <= 0 ||
    maxCross <= 0 ||
    hardErrors.length > 0

  return { hardErrors, softWarn, hardBlock, maxGrain, maxCross }
}
