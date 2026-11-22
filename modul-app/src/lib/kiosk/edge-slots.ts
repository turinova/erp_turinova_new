/**
 * Él glossary — egy forrás a táblához, preview badge-hez, summaryhoz.
 * Tilos: fent/lent, L1/W1, kisbetűs „szál a”.
 */

import type { EdgeSide, EdgeSlot } from '@/lib/kiosk/types'

export type EdgeSlotUi = {
  slot: EdgeSlot
  /** Tábla / kosár: Szál A */
  label: string
  /** Preview badge: A / B / F */
  badge: string
}

export const EDGE_SLOT_UI: EdgeSlotUi[] = [
  { slot: 'top', label: 'Szál A', badge: 'A' },
  { slot: 'right', label: 'Kereszt A', badge: 'A' },
  { slot: 'bottom', label: 'Szál B', badge: 'B' },
  { slot: 'left', label: 'Kereszt B', badge: 'B' },
  { slot: 'ferde', label: 'Ferde', badge: 'F' }
]

export const EDGE_STRAIGHT_UI = EDGE_SLOT_UI.filter(
  (e) => e.slot !== 'ferde'
) as Array<EdgeSlotUi & { slot: EdgeSide }>

export function edgeSlotLabel(slot: EdgeSlot): string {
  return EDGE_SLOT_UI.find((e) => e.slot === slot)?.label ?? slot
}

export function edgeSlotBadge(slot: EdgeSlot): string {
  return EDGE_SLOT_UI.find((e) => e.slot === slot)?.badge ?? '?'
}

export const EDGE_COPY = {
  stepSub:
    'A táblában válaszd ki élenként, milyen élzáró kell. A rajzon A és B a két szemközti él.',
  helpBody:
    'A táblában válassz típust élénként. A rajzon A/B (és F = ferde) mutatja, melyik élről van szó.'
} as const
