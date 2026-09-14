import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type {
  OptiEdgeMaterialOption,
  OptiSheetMaterialOption
} from '@/lib/opti/queries'

export type OptiSessionMode = 'staff' | 'partner'

/** Staff megrendelő draft a sessionben (OptiCustomerDraft-kompatibilis). */
export type OptiSessionCustomer = {
  customerId: string | null
  name: string
  email: string
  mobile: string
  billingName: string
  billingCountry: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
}

export type OptiSessionSnapshot = {
  v: 1
  panels: OptiPanelDraft[]
  sheetMaterialId: string
  customer: OptiSessionCustomer | null
  projectName: string
}

const EMPTY: OptiSessionSnapshot = {
  v: 1,
  panels: [],
  sheetMaterialId: '',
  customer: null,
  projectName: ''
}

export function optiSessionKey(
  tenantId: string,
  mode: OptiSessionMode
): string {
  return `modul-opti:v1:${tenantId}:${mode}`
}

function isPanelShape(value: unknown): value is OptiPanelDraft {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.sheetMaterialId === 'string' &&
    typeof p.sheetMaterialName === 'string' &&
    typeof p.grainMm === 'number' &&
    typeof p.crossMm === 'number' &&
    typeof p.quantity === 'number'
  )
}

function parseSnapshot(raw: string): OptiSessionSnapshot | null {
  try {
    const data = JSON.parse(raw) as Partial<OptiSessionSnapshot>
    if (data.v !== 1 || !Array.isArray(data.panels)) return null
    const panels = data.panels.filter(isPanelShape)
    return {
      v: 1,
      panels,
      sheetMaterialId:
        typeof data.sheetMaterialId === 'string' ? data.sheetMaterialId : '',
      customer:
        data.customer && typeof data.customer === 'object'
          ? (data.customer as OptiSessionCustomer)
          : null,
      projectName:
        typeof data.projectName === 'string' ? data.projectName : ''
    }
  } catch {
    return null
  }
}

export function readOptiSession(
  tenantId: string,
  mode: OptiSessionMode
): OptiSessionSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(optiSessionKey(tenantId, mode))
    if (!raw) return null
    return parseSnapshot(raw)
  } catch {
    return null
  }
}

export function writeOptiSession(
  tenantId: string,
  mode: OptiSessionMode,
  snapshot: OptiSessionSnapshot
): void {
  if (typeof window === 'undefined') return
  try {
    const key = optiSessionKey(tenantId, mode)
    const hasWork =
      snapshot.panels.length > 0 ||
      Boolean(snapshot.sheetMaterialId) ||
      Boolean(snapshot.customer?.name?.trim()) ||
      Boolean(snapshot.projectName.trim())
    if (!hasWork) {
      sessionStorage.removeItem(key)
      return
    }
    sessionStorage.setItem(key, JSON.stringify({ ...snapshot, v: 1 as const }))
  } catch {
    // quota / private mode — ignore
  }
}

export function clearOptiSession(
  tenantId: string,
  mode: OptiSessionMode
): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(optiSessionKey(tenantId, mode))
  } catch {
    // ignore
  }
}

/** Drop panels that reference missing sheet / edge materials. */
export function sanitizeOptiSessionPanels(
  panels: OptiPanelDraft[],
  sheetMaterials: OptiSheetMaterialOption[],
  edgeMaterials: OptiEdgeMaterialOption[]
): { panels: OptiPanelDraft[]; dropped: number } {
  const sheetIds = new Set(sheetMaterials.map((m) => m.id))
  const edgeIds = new Set(edgeMaterials.map((e) => e.id))

  const next: OptiPanelDraft[] = []
  let dropped = 0
  for (const panel of panels) {
    if (!sheetIds.has(panel.sheetMaterialId)) {
      dropped += 1
      continue
    }
    const edges = [
      panel.edgeAId,
      panel.edgeBId,
      panel.edgeCId,
      panel.edgeDId
    ]
    if (edges.some((id) => id && !edgeIds.has(id))) {
      dropped += 1
      continue
    }
    next.push(panel)
  }
  return { panels: next, dropped }
}

export function emptyOptiSession(): OptiSessionSnapshot {
  return { ...EMPTY, panels: [] }
}
