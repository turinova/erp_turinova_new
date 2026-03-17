/**
 * Order status workflow: labels, colors, allowed transitions.
 * See docs/ORDER_STATUS_WORKFLOW.md and docs/ORDER_FULFILLMENT_IMPLEMENTATION_PLAN.md
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Áttekintésre vár',
  new: 'Új',
  picking: 'Begyűjtés',
  picked: 'Kiszedve',
  verifying: 'Ellenőrzés',
  packing: 'Csomagolás',
  shipped: 'Átadva / Úton',
  ready_for_pickup: 'Átvehető',
  delivered: 'Kézbesítve',
  cancelled: 'Törölve',
  refunded: 'Visszatérítve'
}

export type OrderStatusChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning'

export const ORDER_STATUS_COLORS: Record<string, OrderStatusChipColor> = {
  pending_review: 'warning',
  new: 'info',
  picking: 'primary',
  picked: 'primary',
  verifying: 'secondary',
  packing: 'primary',
  shipped: 'info',
  ready_for_pickup: 'info',
  delivered: 'success',
  cancelled: 'error',
  refunded: 'error'
}

/** Allowed next statuses per current status (from ORDER_STATUS_WORKFLOW.md) */
export const ALLOWED_NEXT_STATUS: Record<string, string[]> = {
  new: ['picking', 'cancelled'],
  picking: ['picked', 'cancelled'],
  picked: ['verifying', 'packing', 'cancelled'],
  verifying: ['packing', 'cancelled'],
  packing: ['shipped', 'ready_for_pickup', 'cancelled'],
  shipped: ['delivered'],
  ready_for_pickup: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
  pending_review: ['new', 'cancelled'] // allow moving from pending_review to new or cancelled
}

export function getAllowedNextStatus(current: string): string[] {
  return ALLOWED_NEXT_STATUS[current] ?? []
}

export function isTerminalStatus(status: string): boolean {
  return status === 'cancelled' || status === 'refunded'
}

/** Statuses that allow soft delete (remove from list). See docs/ORDER_RESERVATION_AND_DELETE.md */
export const DELETABLE_ORDER_STATUSES = ['pending_review', 'new', 'cancelled', 'refunded']

export function canDeleteOrder(status: string): boolean {
  return DELETABLE_ORDER_STATUSES.includes(status)
}

/** Fulfillability badge (only for status === 'new') */
export type FulfillabilityBadge = 'Hiány' | 'Beszerzés alatt' | 'Csomagolható' | 'Ellenőrzés' | null

export const FULFILLABILITY_STATUS_TO_BADGE: Record<string, FulfillabilityBadge> = {
  not_fulfillable: 'Hiány',
  partially_fulfillable: 'Hiány',
  po_created: 'Beszerzés alatt',
  fully_fulfillable: 'Csomagolható',
  unknown: 'Ellenőrzés',
  checking: 'Ellenőrzés'
}

export const FULFILLABILITY_BADGE_COLORS: Record<string, OrderStatusChipColor> = {
  Hiány: 'warning',
  'Beszerzés alatt': 'info',
  Csomagolható: 'success',
  Ellenőrzés: 'default'
}

/**
 * Get fulfillability badge label for display (only meaningful when order.status === 'new').
 */
export function getFulfillabilityBadge(fulfillabilityStatus: string | null | undefined): FulfillabilityBadge {
  if (!fulfillabilityStatus) return 'Ellenőrzés'
  return FULFILLABILITY_STATUS_TO_BADGE[fulfillabilityStatus] ?? 'Ellenőrzés'
}

/** Buffer-style chip and row colors for fulfillability (same palette as order buffer page) */
export interface FulfillabilityDisplayStyle {
  label: FulfillabilityBadge
  chipStyle: { bgcolor: string; color: string; borderColor: string }
  rowBg: string | undefined
  rowBgHover: string | undefined
}

const FULFILLABILITY_DISPLAY_STYLES: Record<string, FulfillabilityDisplayStyle> = {
  Csomagolható: {
    label: 'Csomagolható',
    chipStyle: { bgcolor: '#e8f5e9', color: '#1b5e20', borderColor: '#a5d6a7' },
    rowBg: 'rgba(232, 245, 233, 0.45)',
    rowBgHover: 'rgba(200, 230, 201, 0.5)'
  },
  Hiány: {
    label: 'Hiány',
    chipStyle: { bgcolor: '#ffebee', color: '#b71c1c', borderColor: '#ef9a9a' },
    rowBg: 'rgba(255, 235, 238, 0.45)',
    rowBgHover: 'rgba(255, 205, 210, 0.5)'
  },
  'Beszerzés alatt': {
    label: 'Beszerzés alatt',
    chipStyle: { bgcolor: '#e3f2fd', color: '#1565c0', borderColor: '#90caf9' },
    rowBg: 'rgba(227, 242, 253, 0.5)',
    rowBgHover: 'rgba(187, 222, 251, 0.5)'
  },
  Ellenőrzés: {
    label: 'Ellenőrzés',
    chipStyle: { bgcolor: '#fafafa', color: '#616161', borderColor: 'rgba(0,0,0,0.12)' },
    rowBg: undefined,
    rowBgHover: undefined
  }
}

/** For status === 'new': get primary display (fulfillability as main info) with buffer-style row + chip. */
export function getFulfillabilityDisplayStyle(fulfillabilityStatus: string | null | undefined): FulfillabilityDisplayStyle {
  const badge = getFulfillabilityBadge(fulfillabilityStatus)
  return FULFILLABILITY_DISPLAY_STYLES[badge ?? 'Ellenőrzés'] ?? FULFILLABILITY_DISPLAY_STYLES.Ellenőrzés
}
