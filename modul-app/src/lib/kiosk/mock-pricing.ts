import { edgeSlotBadge, edgeSlotLabel } from '@/lib/kiosk/edge-slots'
import { KIOSK_EDGE_TYPES } from '@/lib/kiosk/edge-types'
import type { EdgeSide, EdgeSlot } from '@/lib/kiosk/types'

const SIDES: EdgeSide[] = ['top', 'right', 'bottom', 'left']
const ALL_SLOTS: EdgeSlot[] = [...SIDES, 'ferde']

function edgeTypeName(id: string): string {
  return KIOSK_EDGE_TYPES.find((e) => e.id === id)?.name ?? id
}

export type EdgeCartChip = {
  key: string
  /** Badge: A / B / F vagy „Körbe”. */
  badge: string
  /** Típusnév. */
  name: string
}

/**
 * Kosár Él oszlop — chippek A/B/F + típus (hely a sor Ft helyett).
 */
export function edgeCartChips(
  edgeIds: Partial<Record<EdgeSlot, string>>
): EdgeCartChip[] {
  const active = ALL_SLOTS.filter((s) => edgeIds[s])
  if (active.length === 0) return []

  const byType = new Map<string, EdgeSlot[]>()
  for (const s of active) {
    const id = edgeIds[s]!
    const list = byType.get(id) ?? []
    list.push(s)
    byType.set(id, list)
  }

  const straightActive = SIDES.filter((s) => edgeIds[s])
  const onlyOneType = byType.size === 1
  const soleId = onlyOneType ? [...byType.keys()][0]! : null
  const soleName = soleId ? edgeTypeName(soleId) : null

  if (
    soleName &&
    straightActive.length === 4 &&
    (!edgeIds.ferde || edgeIds.ferde === soleId)
  ) {
    return [{ key: 'korbe', badge: 'Körbe', name: soleName }]
  }

  return active.map((slot) => ({
    key: slot,
    badge: edgeSlotBadge(slot),
    name: edgeTypeName(edgeIds[slot]!)
  }))
}

/**
 * Összevont él-összegző (nincs él×teljes név lista).
 * A melyik él melyik: preview A/B badge.
 */
export function edgeSummaryLabel(
  edgeIds: Partial<Record<EdgeSlot, string>>
): string {
  const chips = edgeCartChips(edgeIds)
  if (chips.length === 0) return 'Nincs él'
  if (chips.length === 1 && chips[0]!.badge === 'Körbe') {
    return `Körbe: ${chips[0]!.name}`
  }
  if (chips.every((c) => c.name === chips[0]!.name)) {
    return `${chips[0]!.name} (${chips.length} él)`
  }
  return chips
    .map((c) =>
      c.badge === 'Körbe'
        ? `Körbe: ${c.name}`
        : `${c.name} (${edgeSlotLabel(c.key as EdgeSlot)})`
    )
    .join(', ')
}

/**
 * Duplung váltáskor: csak a megengedett típus id-k maradnak.
 * `allowedTypeIds` = bootstrapben mapelt + duplunghoz illő típusok.
 */
export function sanitizeEdgeIdsForDuplung(
  edgeIds: Partial<Record<EdgeSlot, string>>,
  duplung: boolean,
  allowedTypeIds?: string[]
): Partial<Record<EdgeSlot, string>> {
  const allowed = new Set(
    allowedTypeIds ??
      KIOSK_EDGE_TYPES.filter((e) => e.requiresDuplung === duplung).map(
        (e) => e.id
      )
  )
  const next: Partial<Record<EdgeSlot, string>> = {}
  for (const [slot, id] of Object.entries(edgeIds) as Array<
    [EdgeSlot, string]
  >) {
    if (id && allowed.has(id)) next[slot] = id
  }
  return next
}
