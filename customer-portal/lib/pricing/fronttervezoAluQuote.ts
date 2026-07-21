/** ALU: bruttó Ft/m² — jelenleg minden (profil + szín) kombinációra azonos. */
export const FRONTTERVEZO_ALU_GROSS_PRICE_PER_SQM = 70_000

const ALU_VAT_RATE = 0.27

export type AluQuoteLineInput = {
  id: string
  profil: string
  szin: string
  pantolas: string
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  megjegyzes?: string
}

export type FronttervezoAluQuoteResult = {
  rows: Array<{
    profil: string
    szin: string
    panelsDb: number
    sqm: number
    grossPerSqm: number
    net: number
    vat: number
    gross: number
  }>
  totals: {
    net: number
    vat: number
    gross: number
    discountPercent: number
    discountGross: number
    finalGross: number
  }
}

export function computeFronttervezoAluQuote(
  lines: AluQuoteLineInput[],
  customerDiscountPercent: number
): FronttervezoAluQuoteResult | null {
  if (!lines.length) return null

  const byProfilSzin = new Map<string, AluQuoteLineInput[]>()

  for (const l of lines) {
    const key = `${l.profil}\t${l.szin}`

    if (!byProfilSzin.has(key)) byProfilSzin.set(key, [])
    byProfilSzin.get(key)!.push(l)
  }

  const rows = Array.from(byProfilSzin.entries()).map(([key, items]) => {
    const [profil, szin] = key.split('\t')
    const panelsDb = items.reduce((sum, r) => sum + r.mennyiseg, 0)
    const areaMm2 = items.reduce((sum, r) => sum + r.magassagMm * r.szelessegMm * r.mennyiseg, 0)
    const sqm = areaMm2 / 1_000_000
    const grossPerSqm = FRONTTERVEZO_ALU_GROSS_PRICE_PER_SQM
    const gross = sqm * grossPerSqm
    const net = gross / (1 + ALU_VAT_RATE)
    const vat = gross - net

    return { profil, szin, panelsDb, sqm, grossPerSqm, net, vat, gross }
  })

  const totalsNet = rows.reduce((sum, r) => sum + r.net, 0)
  const totalsVat = rows.reduce((sum, r) => sum + r.vat, 0)
  const totalsGross = rows.reduce((sum, r) => sum + r.gross, 0)

  const discountPercent = customerDiscountPercent || 0
  const discountGross = (totalsGross * discountPercent) / 100
  const finalGross = totalsGross - discountGross

  return {
    rows,
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
