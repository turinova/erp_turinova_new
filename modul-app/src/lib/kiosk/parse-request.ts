import type { KioskPriceLineInput } from '@/lib/kiosk/map-to-opti'
import { EMPTY_KIOSK_BILLING } from '@/lib/kiosk/guest'
import { KIOSK_LABEL_MAX, type KioskGuest } from '@/lib/kiosk/types'

export function parseKioskLines(raw: unknown): KioskPriceLineInput[] | null {
  if (!Array.isArray(raw)) return null
  const lines: KioskPriceLineInput[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : null
    const sheetId = typeof row.sheetId === 'string' ? row.sheetId : null
    const grainMm = Number(row.grainMm)
    const crossMm = Number(row.crossMm)
    const quantity = Number(row.quantity)
    const machining = row.machining
    const edgeIds = row.edgeIds
    if (!id || !sheetId) return null
    if (!Number.isFinite(grainMm) || !Number.isFinite(crossMm)) return null
    if (!Number.isFinite(quantity)) return null
    if (!machining || typeof machining !== 'object') return null
    lines.push({
      id,
      sheetId,
      grainMm: Math.round(grainMm),
      crossMm: Math.round(crossMm),
      quantity: Math.round(quantity),
      machining: machining as KioskPriceLineInput['machining'],
      edgeIds:
        edgeIds && typeof edgeIds === 'object' && !Array.isArray(edgeIds)
          ? (edgeIds as KioskPriceLineInput['edgeIds'])
          : {},
      label:
        typeof row.label === 'string'
          ? row.label.trim().replace(/\s+/g, ' ').slice(0, KIOSK_LABEL_MAX)
          : ''
    })
  }
  return lines
}

function str(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export function parseKioskGuest(raw: unknown): KioskGuest | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  const b =
    g.billing && typeof g.billing === 'object'
      ? (g.billing as Record<string, unknown>)
      : {}
  return {
    name: str(g.name, 120),
    phone: str(g.phone, 40),
    email: str(g.email, 200),
    consent: g.consent === true,
    billingMode: g.billingMode === 'here' ? 'here' : 'none',
    billing: {
      ...EMPTY_KIOSK_BILLING,
      name: str(b.name, 200),
      taxNumber: str(b.taxNumber, 40),
      postalCode: str(b.postalCode, 10),
      city: str(b.city, 120),
      street: str(b.street, 200),
      houseNumber: str(b.houseNumber, 40)
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseSubmissionId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : null
}
