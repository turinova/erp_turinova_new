export type PosCartLine = {
  accessoryId: string
  name: string
  sku: string
  unitShortform: string
  quantity: number
  unitPriceGross: number
  taxPercent: number
  discountPercentage: number
  onHand: number | null
}

export type PosFeeLine = {
  key: string
  feeTypeId: string
  name: string
  unitPriceGross: number
  taxRatePercent: number
}

export type PosSessionState = {
  warehouseId: string
  registerId: string
  customerId: string
  lines: PosCartLine[]
  fees: PosFeeLine[]
  globalDiscPct: number
}

const STORAGE_KEY = 'modul-pos-session-v2'

export function loadPosSession(): PosSessionState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PosSessionState
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.lines)) return null
    return {
      warehouseId: parsed.warehouseId ?? '',
      registerId: parsed.registerId ?? '',
      customerId: parsed.customerId ?? '',
      lines: parsed.lines,
      fees: Array.isArray(parsed.fees) ? parsed.fees : [],
      globalDiscPct: Number(parsed.globalDiscPct) || 0
    }
  } catch {
    return null
  }
}

export function savePosSession(state: PosSessionState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota / private mode — ignore
  }
}

export function clearPosSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
