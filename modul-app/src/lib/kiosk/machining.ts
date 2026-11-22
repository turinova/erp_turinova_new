import type { KioskMachining, PanthelyOldal } from '@/lib/kiosk/types'
import { EMPTY_KIOSK_MACHINING } from '@/lib/kiosk/types'
import {
  machiningSummaryLabel,
  SZOG_CORNER_UI
} from '@/lib/kiosk/machining-copy'

export const PANTHELY_QTY_CHIPS = [2, 3, 4, 5] as const

/** @deprecated use SZOG_CORNER_UI — alias a meglévő importokhoz */
export const SZOG_CORNERS = SZOG_CORNER_UI

export function isMachiningNone(m: KioskMachining): boolean {
  return !m.duplungolas && m.panthely == null && m.szog == null
}

export function hasAnyMachining(m: KioskMachining): boolean {
  return !isMachiningNone(m)
}

/**
 * Primary engedélyezés.
 * `null` = nincs megmunkálás (default) — nem kell külön „nélkül” gomb.
 */
export function isMachiningReady(
  m: KioskMachining | null,
  grainMm: number | null,
  crossMm: number | null
): boolean {
  if (m == null || isMachiningNone(m)) return true
  if (m.panthely) {
    const q = m.panthely.quantity
    if (q < 2 || q > 20) return false
  }
  if (m.szog) {
    if (!grainMm || !crossMm) return false
    const { alongGrainMm, alongCrossMm } = m.szog
    if (alongGrainMm < 20 || alongCrossMm < 20) return false
    if (alongGrainMm >= grainMm || alongCrossMm >= crossMm) return false
  }
  return true
}

export function defaultSzogCut(
  grainMm: number,
  crossMm: number
): NonNullable<KioskMachining['szog']> {
  const alongGrainMm = Math.max(
    20,
    Math.min(Math.round(grainMm * 0.3), grainMm - 20)
  )
  const alongCrossMm = Math.max(
    20,
    Math.min(Math.round(crossMm * 0.3), crossMm - 20)
  )
  return { corner: 'TL', alongGrainMm, alongCrossMm }
}

export function panthelyOldalLabel(o: PanthelyOldal): string {
  return o === 'hosszu' ? 'Hosszú oldal' : 'Rövid oldal'
}

export { EMPTY_KIOSK_MACHINING, machiningSummaryLabel }
