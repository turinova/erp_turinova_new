export type KioskStep =
  | 'attract'
  | 'material'
  | 'size'
  | 'machining'
  | 'edge'
  | 'cart'
  | 'details'
  | 'success'

export type EdgeSide = 'top' | 'right' | 'bottom' | 'left'

/** Egyenes élek + opcionális ferde (szögvágás után). */
export type EdgeSlot = EdgeSide | 'ferde'

/** Opti-align: hosszu/rovid geometriai oldal. */
export type PanthelyOldal = 'hosszu' | 'rovid'

export type SzogCornerId = 'TL' | 'TR' | 'BL' | 'BR'

/**
 * Opti-kompatibilis multi-flag — egy darabon több megmunkálás egyszerre.
 * `null` a draftban = még nem döntött.
 * Üres objektum (minden off) = „Megmunkálás nélkül”.
 */
export type KioskMachining = {
  duplungolas: boolean
  panthely: { quantity: number; oldal: PanthelyOldal } | null
  szog: {
    corner: SzogCornerId
    alongGrainMm: number
    alongCrossMm: number
  } | null
}

export const EMPTY_KIOSK_MACHINING: KioskMachining = {
  duplungolas: false,
  panthely: null,
  szog: null
}

export type MockSheet = {
  id: string
  name: string
  thicknessMm: number
  lengthMm: number
  widthMm: number
  /** sheet_materials.on_stock — raktár vs rendelős */
  onStock: boolean
  /** sheet_materials.grain_direction — ha true, preview: Szál → */
  grainDirection: boolean
  manufacturerName: string
  machineCode: string
  /** CSS color / gradient for tile preview */
  swatch: string
  pricePerSqmGross: number
}

export type StockFilter = 'all' | 'stock' | 'order'

/**
 * Élzáró típus (kiosk beállításban → konkrét anyag).
 * `requiresDuplung`: false = csak duplung nélkül; true = csak duplunggal.
 */
export type MockEdge = {
  id: string
  name: string
  /** Preview / chip rövid címke */
  shortLabel: string
  color: string
  pricePerMGross: number
  requiresDuplung: boolean
}

export type KioskCartLine = {
  id: string
  sheetId: string
  /** Szálirány (mm) — Opti grainMm */
  grainMm: number
  /** Keresztirány (mm) — Opti crossMm */
  crossMm: number
  quantity: number
  machining: KioskMachining
  edgeIds: Partial<Record<EdgeSlot, string>>
  /** Opcionális megnevezés (pl. „Konyha, ajtó”) → quote_panels.label */
  label: string
  /** Mock bruttó sorár */
  lineGross: number
}

export const KIOSK_LABEL_MAX = 40

export type KioskGuestBilling = {
  name: string
  taxNumber: string
  postalCode: string
  city: string
  street: string
  houseNumber: string
}

/** none = nem kér számlát · here = kioskon kitölti */
export type KioskBillingMode = 'none' | 'here'

export type KioskGuest = {
  name: string
  phone: string
  /** Opcionális — nem kötelező a leadáshoz. */
  email: string
  /** Méret/szín/él felelősség-elfogadás (UI; később audit a quote-on). */
  consent: boolean
  billingMode: KioskBillingMode
  /** Csak `billingMode === 'here'` esetén releváns (persist később). */
  billing: KioskGuestBilling
}
