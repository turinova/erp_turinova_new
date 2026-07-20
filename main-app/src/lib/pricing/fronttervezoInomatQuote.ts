import type { PanthelyConfig } from '@/app/(dashboard)/fronttervezo/fronttervezoTypes'

import {
  grossPerSqmForInomatSzin,
  INOMAT_SZIN_OPTIONS,
  NETTFRONT_VAT_RATE,
  normalizeInomatSzin,
  sellNetPerSqmForInomatSzin,
  type InomatColorDef,
  type InomatSzin
} from './inomatCatalog'

export {
  grossPerSqmForInomatSzin,
  INOMAT_SZIN_OPTIONS,
  normalizeInomatSzin,
  sellNetPerSqmForInomatSzin,
  type InomatSzin
}
export {
  INOMAT_ALL_COLORS,
  INOMAT_HG_COLORS,
  INOMAT_MATT_COLORS,
  buildInomatCatalogFromSkus,
  getInomatColorDef,
  getInomatFinishGroup,
  getInomatFinishLabel,
  isInomatSzin,
  NETTFRONT_VAT_RATE,
  splitInomatCatalog,
  type InomatColorDef,
  type NettfrontSkuRow
} from './inomatCatalog'

/** Session / UI sor — megegyezik az Inomat szekció `InomatLineItem` alakjával */
export type InomatQuoteLineInput = {
  id: string
  szin: string
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null
  megjegyzes?: string
}

type CuttingFeeLike = { panthelyfuras_fee_per_hole?: number | null } | null

export type FronttervezoInomatQuoteResult = {
  rows: Array<{
    szin: string
    panelsDb: number
    sqm: number
    grossPerSqm: number
    net: number
    vat: number
    gross: number
  }>
  panthely: { panelsDb: number; holesDb: number; net: number; vat: number; gross: number }
  totals: {
    net: number
    vat: number
    gross: number
    discountPercent: number
    discountGross: number
    finalGross: number
  }
}

/** Egy tétel bruttó becslése (szín × m²), pánt nélkül — lista élő árához. */
export function estimateInomatLinePanelGross(
  line: {
    szin: string
    magassagMm: number
    szelessegMm: number
    mennyiseg: number
  },
  catalog: InomatColorDef[] = []
): { sqm: number; grossPerSqm: number; gross: number } {
  const sqm = (line.magassagMm * line.szelessegMm * line.mennyiseg) / 1_000_000
  const sellNet = sellNetPerSqmForInomatSzin(line.szin, catalog)
  const net = sqm * sellNet
  const gross = net * (1 + NETTFRONT_VAT_RATE)
  const grossPerSqm = grossPerSqmForInomatSzin(line.szin, catalog)

  return { sqm, grossPerSqm, gross }
}

export function computeFronttervezoInomatQuote(
  lines: InomatQuoteLineInput[],
  cuttingFee: CuttingFeeLike,
  customerDiscountPercent: number,
  catalog: InomatColorDef[] = []
): FronttervezoInomatQuoteResult | null {
  if (!lines.length) return null

  const byColor = new Map<string, InomatQuoteLineInput[]>()

  for (const l of lines) {
    const c = normalizeInomatSzin(l.szin, catalog)

    if (!byColor.has(c)) byColor.set(c, [])
    byColor.get(c)!.push({ ...l, szin: c })
  }

  const rows = Array.from(byColor.entries()).map(([c, items]) => {
    const panelsDb = items.reduce((sum, r) => sum + r.mennyiseg, 0)
    const areaMm2 = items.reduce((sum, r) => sum + r.magassagMm * r.szelessegMm * r.mennyiseg, 0)
    const sqm = areaMm2 / 1_000_000
    const sellNetPerSqm = sellNetPerSqmForInomatSzin(c, catalog)
    const net = sqm * sellNetPerSqm
    const vat = net * NETTFRONT_VAT_RATE
    const gross = net + vat
    const grossPerSqm = grossPerSqmForInomatSzin(c, catalog)

    return { szin: c, panelsDb, sqm, grossPerSqm, net, vat, gross }
  })

  const totalPanelsDb = lines.reduce((sum, r) => sum + r.mennyiseg, 0)
  const totalHolesDb = lines.reduce((sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0), 0)
  const pantUnitNet = cuttingFee?.panthelyfuras_fee_per_hole ?? 50
  const pantNet = totalHolesDb * pantUnitNet
  const pantVat = pantNet * NETTFRONT_VAT_RATE
  const pantGross = pantNet + pantVat

  const totalsNet = rows.reduce((sum, r) => sum + r.net, 0) + pantNet
  const totalsVat = rows.reduce((sum, r) => sum + r.vat, 0) + pantVat
  const totalsGross = rows.reduce((sum, r) => sum + r.gross, 0) + pantGross

  const discountPercent = customerDiscountPercent || 0
  const discountGross = (totalsGross * discountPercent) / 100
  const finalGross = totalsGross - discountGross

  return {
    rows,
    panthely: { panelsDb: totalPanelsDb, holesDb: totalHolesDb, net: pantNet, vat: pantVat, gross: pantGross },
    totals: {
      net: totalsNet,
      vat: totalsVat,
      gross: totalsGross,
      discountPercent,
      discountGross,
      finalGross
    }
  }
}
