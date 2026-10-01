export type PosCartLine = {
  kind: 'product' | 'sheet_material' | 'linear_material'
  accessoryId: string | null
  sheetMaterialId: string | null
  linearMaterialId: string | null
  name: string
  sku: string
  unitShortform: string
  quantity: number
  unitPriceGross: number
  taxPercent: number
  discountPercentage: number
  /** Eladási egységben (db / m² / m). */
  onHand: number | null
  areaOrLengthFactor?: number | null
  stockUnit?: 'db' | 'fm' | null
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

const STORAGE_KEY = 'modul-pos-session-v3'

function normalizeCartLine(raw: unknown): PosCartLine | null {
  if (!raw || typeof raw !== 'object') return null
  const l = raw as Record<string, unknown>
  const accessoryId =
    typeof l.accessoryId === 'string' ? l.accessoryId : null
  const sheetMaterialId =
    typeof l.sheetMaterialId === 'string' ? l.sheetMaterialId : null
  const linearMaterialId =
    typeof l.linearMaterialId === 'string' ? l.linearMaterialId : null

  let kind = l.kind as PosCartLine['kind'] | undefined
  if (!kind) {
    if (sheetMaterialId) kind = 'sheet_material'
    else if (linearMaterialId) kind = 'linear_material'
    else kind = 'product'
  }

  if (kind === 'product' && !accessoryId) return null
  if (kind === 'sheet_material' && !sheetMaterialId) return null
  if (kind === 'linear_material' && !linearMaterialId) return null

  return {
    kind,
    accessoryId: kind === 'product' ? accessoryId : null,
    sheetMaterialId: kind === 'sheet_material' ? sheetMaterialId : null,
    linearMaterialId: kind === 'linear_material' ? linearMaterialId : null,
    name: String(l.name ?? ''),
    sku: String(l.sku ?? ''),
    unitShortform: String(l.unitShortform ?? 'db'),
    quantity: Number(l.quantity) || 0,
    unitPriceGross: Number(l.unitPriceGross) || 0,
    taxPercent: Number(l.taxPercent) || 0,
    discountPercentage: Number(l.discountPercentage) || 0,
    onHand: l.onHand == null ? null : Number(l.onHand),
    areaOrLengthFactor:
      l.areaOrLengthFactor == null ? null : Number(l.areaOrLengthFactor),
    stockUnit:
      l.stockUnit === 'fm' || l.stockUnit === 'db' ? l.stockUnit : null
  }
}

export function loadPosSession(): PosSessionState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      sessionStorage.getItem(STORAGE_KEY) ??
      sessionStorage.getItem('modul-pos-session-v2')
    if (!raw) return null
    const parsed = JSON.parse(raw) as PosSessionState
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.lines)) return null
    const lines = parsed.lines
      .map(normalizeCartLine)
      .filter((l): l is PosCartLine => l != null && l.quantity > 0)
    return {
      warehouseId: parsed.warehouseId ?? '',
      registerId: parsed.registerId ?? '',
      customerId: parsed.customerId ?? '',
      lines,
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
    sessionStorage.removeItem('modul-pos-session-v2')
  } catch {
    // ignore
  }
}
