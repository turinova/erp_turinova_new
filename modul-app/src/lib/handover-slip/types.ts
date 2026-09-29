/** Átvételi blokk — Lapszabászat (Opti átadás). */

export type HandoverSlipCopies = 0 | 1 | 2
export type HandoverSlipSingleKind = 'customer' | 'original'
export type HandoverSlipQtyFormat = 'm2_db' | 'm2_only' | 'boards_only'
export type HandoverSlipCopyType = 'original' | 'customer'

export type HandoverSlipSettings = {
  enabled: boolean
  copies: HandoverSlipCopies
  singleCopyKind: HandoverSlipSingleKind
  paperWidthMm: 58 | 80
  autoOnHandover: boolean
  askBeforePrint: boolean
  showCompanyLogo: boolean
  showCompanyAddress: boolean
  showCompanyPhone: boolean
  showCompanyEmail: boolean
  showTaxNumber: boolean
  showOrderNumber: boolean
  showCustomerName: boolean
  showBarcode: boolean
  showPrintDatetime: boolean
  showMaterials: boolean
  showEdge: boolean
  showServices: boolean
  showFees: boolean
  showAccessories: boolean
  qtyFormat: HandoverSlipQtyFormat
  showLegalText: boolean
  legalText: string
  showGateLine: boolean
  gateLineText: string
  showSignatures: boolean
  customerCopyLabel: string
}

export const DEFAULT_HANDOVER_SLIP_SETTINGS: HandoverSlipSettings = {
  enabled: true,
  copies: 2,
  singleCopyKind: 'customer',
  paperWidthMm: 80,
  autoOnHandover: true,
  askBeforePrint: false,
  showCompanyLogo: true,
  showCompanyAddress: true,
  showCompanyPhone: true,
  showCompanyEmail: true,
  showTaxNumber: true,
  showOrderNumber: true,
  showCustomerName: true,
  showBarcode: true,
  showPrintDatetime: true,
  showMaterials: true,
  showEdge: true,
  showServices: true,
  showFees: false,
  showAccessories: false,
  qtyFormat: 'm2_db',
  showLegalText: true,
  legalText:
    'A megrendelő igazolja, hogy az árut mennyiségben és minőségben hiánytalanul átvette. Az átvételt követően reklamációra nincs lehetőség.',
  showGateLine: true,
  gateLineText:
    'Áru kizárólag ezen átvételi blokk bemutatásával adható ki.',
  showSignatures: true,
  customerCopyLabel: 'Vevői példány'
}

export type HandoverSlipCompany = {
  name: string
  postalCode: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  taxNumber: string | null
  logoUrl: string | null
}

export type HandoverSlipMaterialLine = {
  name: string
  chargedSqm: number
  boardsCharged: number
  wasteMulti: number
  edgeLengthM: number
}

export type HandoverSlipServiceLine = {
  name: string
  quantity: number
  unit: string
}

export type HandoverSlipData = {
  company: HandoverSlipCompany
  orderNumber: string
  customerName: string
  barcode: string | null
  materials: HandoverSlipMaterialLine[]
  services: HandoverSlipServiceLine[]
  feeLines: Array<{ name: string; qty: number }>
  accessoryLines: Array<{ name: string; qty: number }>
}

/** Mely példányokat nyomtatjuk a settings alapján. */
export function resolveSlipCopyTypes(
  settings: HandoverSlipSettings
): HandoverSlipCopyType[] {
  if (!settings.enabled || settings.copies === 0) return []
  if (settings.copies === 1) {
    return [settings.singleCopyKind]
  }
  return ['original', 'customer']
}

export function shouldAutoPrint(settings: HandoverSlipSettings): boolean {
  return (
    settings.enabled &&
    settings.autoOnHandover &&
    settings.copies > 0
  )
}
