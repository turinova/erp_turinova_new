/**
 * Kosár: méretek másolása / áthelyezése másik dekórra (ugyanaz a vastagság).
 */

import { sanitizeEdgeIdsForDuplung } from '@/lib/kiosk/mock-pricing'
import { kioskMaxCrossMm, kioskMaxGrainMm } from '@/lib/kiosk/size-limits'
import type { KioskCartLine } from '@/lib/kiosk/types'

export type RecolorBoard = {
  id: string
  name: string
  thicknessMm: number
  lengthMm: number
  widthMm: number
  trimLeftMm: number
  trimRightMm: number
  trimTopMm: number
  trimBottomMm: number
}

export type RecolorMode = 'copy' | 'move'

export type RecolorFitFailure = {
  ok: false
  errors: string[]
}

export type RecolorFitOk = { ok: true }

/** Minden sor belefér-e a cél lap max méretébe. */
export function validateRecolorFit(
  lines: KioskCartLine[],
  target: RecolorBoard
): RecolorFitOk | RecolorFitFailure {
  const maxGrain = kioskMaxGrainMm(target)
  const maxCross = kioskMaxCrossMm(target)
  const errors: string[] = []

  if (maxGrain <= 0 || maxCross <= 0) {
    return {
      ok: false,
      errors: [
        'Ez a lap nem vágható (szélezés / táblaméret). Kérj segítséget a pultnál.'
      ]
    }
  }

  for (const line of lines) {
    const label = line.label?.trim() || `${line.grainMm} × ${line.crossMm} mm`
    if (line.grainMm > maxGrain) {
      errors.push(
        `${label}: a szálirány ${line.grainMm} mm, ezen a lapon max. ${maxGrain} mm.`
      )
    }
    if (line.crossMm > maxCross) {
      errors.push(
        `${label}: a keresztirány ${line.crossMm} mm, ezen a lapon max. ${maxCross} mm.`
      )
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true }
}

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export type ApplyRecolorInput = {
  cart: KioskCartLine[]
  sourceSheetId: string
  target: RecolorBoard
  mode: RecolorMode
  maxRows: number
  /** Mapelt él típus id-k (duplung true/false szerint). */
  allowedTypeIds: (duplung: boolean) => string[]
}

export type ApplyRecolorResult =
  | {
      ok: true
      cart: KioskCartLine[]
      /** Volt-e él, ami a cél anyagnál nem maradt meg. */
      edgesDropped: boolean
      movedOrCopied: number
    }
  | { ok: false; error: string; detailErrors?: string[] }

/**
 * Másolat: új sorok a cél anyagra.
 * Áthelyezés: a forrás csoport sorainak sheetId cseréje.
 */
export function applyRecolorCart(
  input: ApplyRecolorInput
): ApplyRecolorResult {
  const sourceLines = input.cart.filter((l) => l.sheetId === input.sourceSheetId)
  if (sourceLines.length === 0) {
    return { ok: false, error: 'Nincs tétel ehhez az anyaghoz.' }
  }

  if (input.target.id === input.sourceSheetId) {
    return {
      ok: false,
      error: 'Válassz másik dekórt. Ez ugyanaz a lap.'
    }
  }

  const fit = validateRecolorFit(sourceLines, input.target)
  if (!fit.ok) {
    return {
      ok: false,
      error: 'Ezek a méretek nem férnek fel erre a lapra.',
      detailErrors: fit.errors
    }
  }

  if (input.mode === 'copy') {
    if (input.cart.length + sourceLines.length > input.maxRows) {
      return {
        ok: false,
        error: `Max. ${input.maxRows} tétel lehet a kosárban. Törölj valamit, vagy áthelyezést válassz.`
      }
    }
  }

  let edgesDropped = false

  const remap = (line: KioskCartLine): KioskCartLine => {
    const duplung = Boolean(line.machining.duplungolas)
    const before = line.edgeIds
    const edgeIds = sanitizeEdgeIdsForDuplung(
      before,
      duplung,
      input.allowedTypeIds(duplung)
    )
    if (Object.keys(before).length > Object.keys(edgeIds).length) {
      edgesDropped = true
    }
    return {
      ...line,
      sheetId: input.target.id,
      edgeIds,
      lineGross: 0
    }
  }

  if (input.mode === 'move') {
    const cart = input.cart.map((line) =>
      line.sheetId === input.sourceSheetId ? remap(line) : line
    )
    return {
      ok: true,
      cart,
      edgesDropped,
      movedOrCopied: sourceLines.length
    }
  }

  const copies = sourceLines.map((line) => ({
    ...remap(line),
    id: newLineId()
  }))

  return {
    ok: true,
    cart: [...input.cart, ...copies],
    edgesDropped,
    movedOrCopied: copies.length
  }
}
