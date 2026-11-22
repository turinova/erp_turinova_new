import type { KioskEdgeTypeId } from '@/lib/kiosk/edge-types'
import type { KioskCatalogMode } from '@/lib/kiosk/settings-types'

/** Kiosk Anyag csempe — tenant sheet_materials. */
export type KioskSheetCard = {
  id: string
  name: string
  thicknessMm: number
  lengthMm: number
  widthMm: number
  onStock: boolean
  grainDirection: boolean
  manufacturerName: string
  machineCode: string
  /** image_url vagy swatch fallback */
  imageUrl: string | null
  swatch: string
  /** Bruttó Ft/m² (display); ár számítás szerveren. */
  pricePerSqmGross: number
  /** max mérethez */
  trimTopMm: number
  trimRightMm: number
  trimBottomMm: number
  trimLeftMm: number
}

/** Mapelt él típus a kiosk UI-hoz. */
export type KioskMappedEdge = {
  typeId: KioskEdgeTypeId
  name: string
  shortLabel: string
  color: string
  requiresDuplung: boolean
  edgeMaterialId: string
  edgeMaterialLabel: string
}

export type KioskBootstrapPayload = {
  tenant: {
    id: string
    slug: string
    name: string
    logoUrl: string | null
  }
  settings: {
    enabled: boolean
    catalogMode: KioskCatalogMode
    maxPanelRows: number
    maxQtyPerLine: number
    idleWarnSec: number
    idleResetSec: number
  }
  sheets: KioskSheetCard[]
  /** Üres kereső: gyakori (quote usage), max 8 — már katalógus-szűrt. */
  featuredSheets: KioskSheetCard[]
  edges: KioskMappedEdge[]
}

export type KioskBootstrapErrorCode =
  | 'not_found'
  | 'disabled'
  | 'no_lapszabaszat'
  | 'config'

export type KioskBootstrapResult =
  | { ok: true; data: KioskBootstrapPayload }
  | { ok: false; code: KioskBootstrapErrorCode; message: string }
