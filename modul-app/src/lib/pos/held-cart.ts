import {
  normalizeCartLine,
  type PosCartLine,
  type PosFeeLine,
  type PosSessionState
} from '@/lib/pos/session'
import { computeSaleTotals } from '@/lib/sales/totals'

export type PosHeldCart = {
  warehouseId: string
  registerId: string
  parkedAt: string
  label: string | null
  customerId: string
  lines: PosCartLine[]
  fees: PosFeeLine[]
  globalDiscPct: number
}

const HELD_KEY = 'modul-pos-held-v1'

function normalizeFees(raw: unknown): PosFeeLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((f) => {
      if (!f || typeof f !== 'object') return null
      const row = f as Record<string, unknown>
      const key = typeof row.key === 'string' ? row.key : null
      const feeTypeId = typeof row.feeTypeId === 'string' ? row.feeTypeId : null
      if (!key || !feeTypeId) return null
      return {
        key,
        feeTypeId,
        name: String(row.name ?? ''),
        unitPriceGross: Number(row.unitPriceGross) || 0,
        taxRatePercent: Number(row.taxRatePercent) || 0
      }
    })
    .filter((f): f is PosFeeLine => f != null)
}

export function loadPosHeldCart(): PosHeldCart | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(HELD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PosHeldCart
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.lines)) return null
    const lines = parsed.lines
      .map(normalizeCartLine)
      .filter((l): l is PosCartLine => l != null && l.quantity > 0)
    if (lines.length === 0 && !(parsed.fees?.length > 0)) return null
    return {
      warehouseId: parsed.warehouseId ?? '',
      registerId: parsed.registerId ?? '',
      parkedAt: parsed.parkedAt ?? new Date().toISOString(),
      label: parsed.label?.trim() || null,
      customerId: parsed.customerId ?? '',
      lines,
      fees: normalizeFees(parsed.fees),
      globalDiscPct: Number(parsed.globalDiscPct) || 0
    }
  } catch {
    return null
  }
}

export function savePosHeldCart(held: PosHeldCart): boolean {
  if (typeof window === 'undefined') return false
  try {
    sessionStorage.setItem(HELD_KEY, JSON.stringify(held))
    return true
  } catch {
    return false
  }
}

export function clearPosHeldCart() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(HELD_KEY)
  } catch {
    // ignore
  }
}

export function heldCartMatchesRegister(
  held: PosHeldCart,
  warehouseId: string,
  registerId: string
): boolean {
  return (
    held.warehouseId === warehouseId &&
    (!registerId || held.registerId === registerId)
  )
}

/** Bruttó fizetendő a parked kosárból (chip). */
export function heldCartDue(held: PosHeldCart): number {
  return computeSaleTotals({
    lines: held.lines.map((l) => ({
      quantity: l.quantity,
      unitPriceGross: l.unitPriceGross,
      taxPercent: l.taxPercent,
      discountPercentage: l.discountPercentage
    })),
    fees: held.fees.map((f) => ({
      unitPriceGross: f.unitPriceGross,
      taxPercent: f.taxRatePercent
    })),
    globalDiscountPercent: held.globalDiscPct
  }).due
}

export function heldCartItemCount(held: PosHeldCart): number {
  return held.lines.length + held.fees.length
}

export function activeCartToHeld(
  state: Pick<
    PosSessionState,
    'warehouseId' | 'registerId' | 'customerId' | 'lines' | 'fees' | 'globalDiscPct'
  >,
  label?: string | null
): PosHeldCart | null {
  if (state.lines.length === 0 && state.fees.length === 0) return null
  return {
    warehouseId: state.warehouseId,
    registerId: state.registerId,
    parkedAt: new Date().toISOString(),
    label: label?.trim() || null,
    customerId: state.customerId,
    lines: state.lines,
    fees: state.fees,
    globalDiscPct: state.globalDiscPct
  }
}
