import type { PanthelyConfig } from '@/app/(dashboard)/fronttervezo/fronttervezoTypes'

/** Festett: bruttó Ft/m² — jelenleg fix (minta + szín + fényesség nem váltja az árat). */
export const FRONTTERVEZO_FESTETT_GROSS_PRICE_PER_SQM = 75_000

const FESTETT_VAT_RATE = 0.27

export type FestettQuoteLineInput = {
  id: string
  marasMinta: string
  szin: string
  fenyseg: string
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null
  megjegyzes?: string
}

type CuttingFeeLike = { panthelyfuras_fee_per_hole?: number | null } | null

export type FronttervezoFestettQuoteResult = {
  rows: Array<{
    marasMinta: string
    szin: string
    fenyseg: string
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

export function computeFronttervezoFestettQuote(
  lines: FestettQuoteLineInput[],
  cuttingFee: CuttingFeeLike,
  customerDiscountPercent: number
): FronttervezoFestettQuoteResult | null {
  if (!lines.length) return null

  const byKey = new Map<string, FestettQuoteLineInput[]>()

  for (const l of lines) {
    const key = `${l.marasMinta}\t${l.szin}\t${l.fenyseg}`

    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(l)
  }

  const rows = Array.from(byKey.entries()).map(([key, items]) => {
    const [marasMinta, szin, fenyseg] = key.split('\t')
    const panelsDb = items.reduce((sum, r) => sum + r.mennyiseg, 0)
    const areaMm2 = items.reduce((sum, r) => sum + r.magassagMm * r.szelessegMm * r.mennyiseg, 0)
    const sqm = areaMm2 / 1_000_000
    const grossPerSqm = FRONTTERVEZO_FESTETT_GROSS_PRICE_PER_SQM
    const gross = sqm * grossPerSqm
    const net = gross / (1 + FESTETT_VAT_RATE)
    const vat = gross - net

    return { marasMinta, szin, fenyseg, panelsDb, sqm, grossPerSqm, net, vat, gross }
  })

  const totalPanelsDb = lines.reduce((sum, r) => sum + r.mennyiseg, 0)
  const totalHolesDb = lines.reduce((sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0), 0)
  const pantUnitNet = cuttingFee?.panthelyfuras_fee_per_hole ?? 50
  const pantNet = totalHolesDb * pantUnitNet
  const pantVat = pantNet * FESTETT_VAT_RATE
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
