import type { PanthelyConfig } from '@/app/(dashboard)/fronttervezo/fronttervezoTypes'

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

const SZIN_OPTIONS = ['Bronz', 'Pearl', 'Gold'] as const

/**
 * INOMAT: bruttó Ft/m² színenként.
 * TODO: később DB-ből.
 */
const INOMAT_GROSS_PRICE_PER_SQM_BY_COLOR: Record<(typeof SZIN_OPTIONS)[number], number> = {
  Bronz: 35403,
  Pearl: 35403,
  Gold: 35403
}

const INOMAT_VAT_RATE = 0.27

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

function grossPerSqmForSzin(szin: string): number {
  if (SZIN_OPTIONS.includes(szin as (typeof SZIN_OPTIONS)[number])) {
    return INOMAT_GROSS_PRICE_PER_SQM_BY_COLOR[szin as (typeof SZIN_OPTIONS)[number]]
  }

  return INOMAT_GROSS_PRICE_PER_SQM_BY_COLOR.Bronz
}

export function computeFronttervezoInomatQuote(
  lines: InomatQuoteLineInput[],
  cuttingFee: CuttingFeeLike,
  customerDiscountPercent: number
): FronttervezoInomatQuoteResult | null {
  if (!lines.length) return null

  const byColor = new Map<string, InomatQuoteLineInput[]>()

  for (const l of lines) {
    const c = l.szin

    if (!byColor.has(c)) byColor.set(c, [])
    byColor.get(c)!.push(l)
  }

  const rows = Array.from(byColor.entries()).map(([c, items]) => {
    const panelsDb = items.reduce((sum, r) => sum + r.mennyiseg, 0)
    const areaMm2 = items.reduce((sum, r) => sum + r.magassagMm * r.szelessegMm * r.mennyiseg, 0)
    const sqm = areaMm2 / 1_000_000
    const grossPerSqm = grossPerSqmForSzin(c)
    const gross = sqm * grossPerSqm
    const net = gross / (1 + INOMAT_VAT_RATE)
    const vat = gross - net

    return { szin: c, panelsDb, sqm, grossPerSqm, net, vat, gross }
  })

  const totalPanelsDb = lines.reduce((sum, r) => sum + r.mennyiseg, 0)
  const totalHolesDb = lines.reduce((sum, r) => sum + (r.panthely ? r.panthely.mennyiseg * r.mennyiseg : 0), 0)
  const pantUnitNet = cuttingFee?.panthelyfuras_fee_per_hole ?? 50
  const pantNet = totalHolesDb * pantUnitNet
  const pantVat = pantNet * INOMAT_VAT_RATE
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
