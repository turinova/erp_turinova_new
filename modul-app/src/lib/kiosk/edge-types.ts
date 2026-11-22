/**
 * Kiosk élzáró típusok — fix UX chipkészlet.
 * Staff: típus → tényleges edge_materials.id (`tenant_kiosk_settings.edge_type_map`).
 */

export type KioskEdgeTypeId =
  | 'foil-04'
  | 'abs-1'
  | 'abs-2'
  | 'abs-42-1'
  | 'abs-42-2'

export type KioskEdgeTypeDef = {
  id: KioskEdgeTypeId
  name: string
  shortLabel: string
  /** Preview stroke szín (nem dekór). */
  color: string
  /** true = csak duplung ON-nál. */
  requiresDuplung: boolean
}

export const KIOSK_EDGE_TYPES: KioskEdgeTypeDef[] = [
  {
    id: 'foil-04',
    name: 'Élfólia 0.4 mm színazonos',
    shortLabel: '0.4',
    color: '#38bdf8',
    requiresDuplung: false
  },
  {
    id: 'abs-1',
    name: 'ABS 1 mm Színazonos',
    shortLabel: 'ABS 1',
    color: '#22c55e',
    requiresDuplung: false
  },
  {
    id: 'abs-2',
    name: 'ABS 2 mm Színazonos',
    shortLabel: 'ABS 2',
    color: '#f97316',
    requiresDuplung: false
  },
  {
    id: 'abs-42-1',
    name: 'ABS 42/1 mm Színazonos',
    shortLabel: '42/1',
    color: '#a855f7',
    requiresDuplung: true
  },
  {
    id: 'abs-42-2',
    name: 'ABS 42/2 mm Színazonos',
    shortLabel: '42/2',
    color: '#ef4444',
    requiresDuplung: true
  }
]

export const KIOSK_EDGE_TYPE_IDS = KIOSK_EDGE_TYPES.map((t) => t.id)

export function isKioskEdgeTypeId(raw: string): raw is KioskEdgeTypeId {
  return (KIOSK_EDGE_TYPE_IDS as string[]).includes(raw)
}

export function edgeTypesForDuplung(duplung: boolean): KioskEdgeTypeDef[] {
  return KIOSK_EDGE_TYPES.filter((e) => e.requiresDuplung === duplung)
}

export function defaultEdgeTypeId(duplung: boolean): KioskEdgeTypeId {
  return edgeTypesForDuplung(duplung)[0]?.id ?? 'foil-04'
}

/** edge_type_map jsonb → csak ismert típuskulcsok + nemüres uuid. */
export function parseEdgeTypeMap(
  raw: unknown
): Partial<Record<KioskEdgeTypeId, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Record<KioskEdgeTypeId, string>> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKioskEdgeTypeId(key)) continue
    if (typeof value !== 'string') continue
    const id = value.trim()
    if (!id) continue
    out[key] = id
  }
  return out
}
