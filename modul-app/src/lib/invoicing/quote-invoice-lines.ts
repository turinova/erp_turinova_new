import type { QuoteDetail } from '@/lib/quotes/queries'

export type QuoteInvoiceLine = {
  name: string
  quantity: number
  unit: string
  unitNet: number
  vatPercent: number
  lineNet: number
  lineVat: number
  lineGross: number
}

/** Összesített (default) vs anyagonkénti tételrészletezés. */
export type QuoteInvoiceDetailLevel = 'summary' | 'by_material'

export type MapQuoteInvoiceLinesOpts = {
  detailLevel?: QuoteInvoiceDetailLevel
}

const GROSS_TOLERANCE = 2

function roundMoney(n: number): number {
  return Math.round(n)
}

function roundQty(n: number): number {
  return Math.round(n * 100) / 100
}

function lineFromGross(
  name: string,
  grossRaw: number,
  netRaw: number | null,
  opts?: { quantity?: number; unit?: string; vatPercent?: number }
): QuoteInvoiceLine | null {
  const gross = roundMoney(grossRaw)
  if (gross === 0) return null
  // Számlázz: mennyiség > 0 kell; negatív bruttó (jóváírás) 1 db-bal megy
  let qty = opts?.quantity && opts.quantity > 0 ? opts.quantity : 1
  if (qty < 0.01) qty = 1
  const unit = opts?.unit || 'db'
  const vatPercent = opts?.vatPercent ?? 27
  let net: number
  if (netRaw != null && Number.isFinite(netRaw)) {
    net = roundMoney(netRaw)
  } else {
    net = roundMoney(gross / (1 + vatPercent / 100))
  }
  // Jóváírás: net ugyanolyan előjelű, mint a gross
  if (gross < 0 && net > 0) net = -Math.abs(net)
  if (gross > 0 && net < 0) net = Math.abs(net)
  const vat = gross - net
  return {
    name,
    quantity: qty,
    unit,
    unitNet: qty > 0 ? net / qty : net,
    vatPercent,
    lineNet: net,
    lineVat: vat,
    lineGross: gross
  }
}

function materialQtyUnit(ml: QuoteDetail['material_lines'][number]): {
  quantity: number
  unit: string
} {
  const boards = Number(ml.boards_charged) || 0
  const sqm = Number(ml.charged_sqm) || 0
  if (ml.pricing_method === 'full_board' && boards >= 0.01) {
    return { quantity: roundQty(boards), unit: 'db' }
  }
  if (sqm >= 0.01) {
    return { quantity: roundQty(sqm), unit: 'm²' }
  }
  if (boards >= 0.01) {
    return { quantity: roundQty(boards), unit: 'db' }
  }
  return { quantity: 1, unit: 'db' }
}

function pushAccessoriesAndFees(
  detail: QuoteDetail,
  lines: QuoteInvoiceLine[]
) {
  for (const acc of detail.accessories) {
    const qty = Number(acc.quantity) || 1
    const line = lineFromGross(
      acc.accessory_name,
      Number(acc.gross_price) || 0,
      Number(acc.unit_price_net) * qty,
      {
        quantity: qty,
        unit: acc.unit_shortform || 'db',
        vatPercent: Number(acc.tax_rate_percent) || 27
      }
    )
    if (line) lines.push(line)
  }

  for (const fee of detail.fees) {
    const qty = Number(fee.quantity) || 1
    const sign = fee.kind === 'credit' ? -1 : 1
    const gross = sign * (Number(fee.gross_price) || 0)
    const net = sign * (Number(fee.unit_price_net) || 0) * qty
    const line = lineFromGross(
      fee.kind === 'credit' ? `Jóváírás: ${fee.fee_name}` : fee.fee_name,
      gross,
      net,
      {
        quantity: Math.abs(qty) || 1,
        unit: fee.unit_shortform || 'db',
        vatPercent: Number(fee.tax_rate_percent) || 27
      }
    )
    if (line) lines.push(line)
  }
}

function mapSummaryMaterialLines(detail: QuoteDetail): QuoteInvoiceLine[] {
  const lines: QuoteInvoiceLine[] = []

  let materialGross = 0
  let materialNet = 0
  let cuttingGross = 0
  let cuttingNet = 0
  let cuttingLength = 0
  let edgeGross = 0
  let edgeNet = 0
  let edgeLength = 0

  for (const ml of detail.material_lines) {
    materialGross += Number(ml.material_gross) || 0
    materialNet += Number(ml.material_net) || 0
    cuttingGross += Number(ml.cutting_gross) || 0
    cuttingNet += Number(ml.cutting_net) || 0
    cuttingLength += Number(ml.cutting_length_m) || 0
    edgeGross += Number(ml.edge_gross) || 0
    edgeNet += Number(ml.edge_net) || 0
    edgeLength += Number(ml.edge_length_m) || 0
  }

  const material = lineFromGross('Táblás anyag', materialGross, materialNet, {
    quantity: 1,
    unit: 'db'
  })
  if (material) lines.push(material)

  const cutQty = roundQty(cuttingLength)
  const cutting = lineFromGross('Szabás díj', cuttingGross, cuttingNet, {
    quantity: cutQty >= 0.01 ? cutQty : 1,
    unit: cutQty >= 0.01 ? 'm' : 'db'
  })
  if (cutting) lines.push(cutting)

  const edgeQty = roundQty(edgeLength)
  const edge = lineFromGross('Élzárás', edgeGross, edgeNet, {
    quantity: edgeQty >= 0.01 ? edgeQty : 1,
    unit: edgeQty >= 0.01 ? 'm' : 'db'
  })
  if (edge) lines.push(edge)

  return lines
}

function mapByMaterialLines(detail: QuoteDetail): QuoteInvoiceLine[] {
  const lines: QuoteInvoiceLine[] = []

  for (const ml of detail.material_lines) {
    const name = ml.material_name?.trim() || 'Táblás anyag'
    const { quantity, unit } = materialQtyUnit(ml)
    const material = lineFromGross(
      name,
      Number(ml.material_gross) || 0,
      Number(ml.material_net) || 0,
      { quantity, unit }
    )
    if (material) lines.push(material)

    const cutLen = roundQty(Number(ml.cutting_length_m) || 0)
    const cutting = lineFromGross(
      `Szabás — ${name}`,
      Number(ml.cutting_gross) || 0,
      Number(ml.cutting_net) || 0,
      {
        quantity: cutLen >= 0.01 ? cutLen : 1,
        unit: cutLen >= 0.01 ? 'm' : 'db'
      }
    )
    if (cutting) lines.push(cutting)

    const edgeLen = roundQty(Number(ml.edge_length_m) || 0)
    const edge = lineFromGross(
      `Élzárás — ${name}`,
      Number(ml.edge_gross) || 0,
      Number(ml.edge_net) || 0,
      {
        quantity: edgeLen >= 0.01 ? edgeLen : 1,
        unit: edgeLen >= 0.01 ? 'm' : 'db'
      }
    )
    if (edge) lines.push(edge)
  }

  return lines
}

function reconcileToDue(
  detail: QuoteDetail,
  lines: QuoteInvoiceLine[]
): { ok: true; lines: QuoteInvoiceLine[] } | { ok: false; message: string } {
  const due = roundMoney(detail.final_total_gross)

  if (lines.length === 0) {
    if (due <= 0) {
      return { ok: false, message: 'Nincs számlázható tétel az ajánlaton.' }
    }
    const fallback = lineFromGross(
      `Megrendelés ${detail.order_number ?? detail.quote_number}`,
      due,
      null,
      { quantity: 1, unit: 'db' }
    )
    if (!fallback) {
      return { ok: false, message: 'Nincs számlázható tétel az ajánlaton.' }
    }
    return { ok: true, lines: [fallback] }
  }

  const sumGross = lines.reduce((s, l) => s + l.lineGross, 0)
  const diff = due - sumGross
  if (Math.abs(diff) > GROSS_TOLERANCE) {
    const fallback = lineFromGross(
      `Megrendelés ${detail.order_number ?? detail.quote_number}`,
      due,
      null,
      { quantity: 1, unit: 'db' }
    )
    if (!fallback) {
      return {
        ok: false,
        message: `A számlatételek összege (${sumGross} Ft) nem egyezik a végösszeggel (${due} Ft).`
      }
    }
    return { ok: true, lines: [fallback] }
  }

  if (diff !== 0) {
    const adj = lineFromGross('Kerekítés', diff, null, {
      quantity: 1,
      unit: 'db'
    })
    if (adj) lines.push(adj)
  }

  return { ok: true, lines }
}

/**
 * Számla tételek.
 * - summary: anyag összesítve + szabás + él + termékek + díjak
 * - by_material: anyagonként név + szabás/él méter + termékek + díjak
 */
export function mapQuoteInvoiceLines(
  detail: QuoteDetail,
  opts: MapQuoteInvoiceLinesOpts = {}
): { ok: true; lines: QuoteInvoiceLine[] } | { ok: false; message: string } {
  const detailLevel = opts.detailLevel ?? 'summary'
  const lines =
    detailLevel === 'by_material'
      ? mapByMaterialLines(detail)
      : mapSummaryMaterialLines(detail)

  pushAccessoriesAndFees(detail, lines)
  return reconcileToDue(detail, lines)
}

export function quoteHasBilling(detail: QuoteDetail): boolean {
  const c = detail.customer
  return Boolean(
    c.billing_name?.trim() ||
      c.billing_city?.trim() ||
      c.billing_street?.trim() ||
      c.name?.trim()
  )
}
