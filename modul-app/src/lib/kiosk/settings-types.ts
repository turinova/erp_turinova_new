import type { KioskEdgeTypeId } from '@/lib/kiosk/edge-types'

export type KioskCatalogMode =
  | 'all'
  | 'stock_only'
  | 'favorites'
  | 'stock_and_favorites'

export type KioskSettings = {
  enabled: boolean
  catalogMode: KioskCatalogMode
  favoriteSheetIds: string[]
  edgeTypeMap: Partial<Record<KioskEdgeTypeId, string>>
  maxPanelRows: number
  maxQtyPerLine: number
  idleWarnSec: number
  idleResetSec: number
}

export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  enabled: false,
  catalogMode: 'stock_only',
  favoriteSheetIds: [],
  edgeTypeMap: {},
  maxPanelRows: 8,
  maxQtyPerLine: 20,
  idleWarnSec: 75,
  idleResetSec: 90
}

export type KioskDeviceRow = {
  id: string
  name: string
  lastSeenAt: string | null
  revokedAt: string | null
  createdAt: string
  hasToken: boolean
}

export type KioskEdgeOption = {
  id: string
  label: string
}

export type KioskSheetOption = {
  id: string
  name: string
  thicknessMm: number
  onStock: boolean
  manufacturerName: string
}

export const KIOSK_CATALOG_MODE_OPTIONS: Array<{
  value: KioskCatalogMode
  label: string
  hint: string
}> = [
  {
    value: 'stock_only',
    label: 'Csak raktáron',
    hint: 'Csak a raktáron lévő lapok.'
  },
  {
    value: 'all',
    label: 'Minden lap',
    hint: 'A raktáron lévők és a rendelésre kaphatók is.'
  },
  {
    value: 'favorites',
    label: 'Csak a kiválasztott lapok',
    hint: 'Csak azok, amiket lent kijelölsz.'
  },
  {
    value: 'stock_and_favorites',
    label: 'Raktáron lévők és a kiválasztottak',
    hint: 'A raktáron lévő lapok, plusz amiket lent kijelölsz.'
  }
]

export function isKioskCatalogMode(raw: string): raw is KioskCatalogMode {
  return (
    raw === 'all' ||
    raw === 'stock_only' ||
    raw === 'favorites' ||
    raw === 'stock_and_favorites'
  )
}
