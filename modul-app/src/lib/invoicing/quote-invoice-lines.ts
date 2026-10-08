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

type MaterialLine = QuoteDetail['material_lines'][number]

/**
 * Invoice quantity = physical / customer-facing m² (not waste-inflated).
 * - Full boards: boards_charged × board area
 * - Panel portion: charged_sqm / waste_multi (strip hulladék from charged)
 * Waste stays in unit price (lineNet / displayM2), not in qty.
 */
export function materialInvoiceDisplayM2(ml: MaterialLine): number {
  const boards = Number(ml.boards_charged) || 0
  const grain = Number(ml.board_grain_mm) || 0
  const cross = Number(ml.board_cross_mm) || 0
  const boardArea =
    grain > 0 && cross > 0 ? (grain * cross) / 1_000_000 : 0
  const waste = Number(ml.waste_multi) || 1
  const wasteSafe = waste > 0 ? waste : 1
  const chargedSqm = Number(ml.charged_sqm) || 0
  const panelDisplayM2 = chargedSqm > 0 ? chargedSqm / wasteSafe : 0
  return boards * boardArea + panelDisplayM2
}

function materialQtyUnit(ml: MaterialLine): {
  quantity: number
  unit: string
} {
  const displayM2 = roundQty(materialInvoiceDisplayM2(ml))
  if (displayM2 >= 0.01) {
    return { quantity: displayM2, unit: 'm²' }
  }
  return { quantity: 1, unit: 'm²' }
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
  let materialDisplayM2 = 0
  let cuttingGross = 0
  let cuttingNet = 0
  let cuttingLength = 0
  let edgeGross = 0
  let edgeNet = 0
  let edgeLength = 0

  for (const ml of detail.material_lines) {
    materialGross += Number(ml.material_gross) || 0
    materialNet += Number(ml.material_net) || 0
    materialDisplayM2 += materialInvoiceDisplayM2(ml)
    cuttingGross += Number(ml.cutting_gross) || 0
    cuttingNet += Number(ml.cutting_net) || 0
    cuttingLength += Number(ml.cutting_length_m) || 0
    edgeGross += Number(ml.edge_gross) || 0
    edgeNet += Number(ml.edge_net) || 0
    edgeLength += Number(ml.edge_length_m) || 0
  }

  const qtyM2 = roundQty(materialDisplayM2)
  const material = lineFromGross('Táblás anyag', materialGross, materialNet, {
    quantity: qtyM2 >= 0.01 ? qtyM2 : 1,
    unit: 'm²'
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
    // Absorb ±1–2 Ft into the last real line — never a visible "Kerekítés" row.
    const targetIdx = findAbsorbTargetIndex(lines, diff)
    if (targetIdx == null) {
      return {
        ok: false,
        message: `A számlatételek összege (${sumGross} Ft) nem egyezik a végösszeggel (${due} Ft).`
      }
    }
    lines[targetIdx] = absorbGrossDiff(lines[targetIdx]!, diff)
  }

  return { ok: true, lines }
}

/** Prefer last positive material/service line that can take the Ft delta. */
function findAbsorbTargetIndex(
  lines: QuoteInvoiceLine[],
  diff: number
): number | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (line.lineGross === 0) continue
    const next = line.lineGross + diff
    // Don't flip a positive line to ≤0 (or negative to ≥0) for a tiny fix
    if (line.lineGross > 0 && next <= 0) continue
    if (line.lineGross < 0 && next >= 0) continue
    return i
  }
  return null
}

function absorbGrossDiff(
  line: QuoteInvoiceLine,
  diff: number
): QuoteInvoiceLine {
  const lineGross = roundMoney(line.lineGross + diff)
  const lineNet =
    line.lineGross !== 0
      ? roundMoney(line.lineNet * (lineGross / line.lineGross))
      : roundMoney(lineGross / (1 + line.vatPercent / 100))
  const lineVat = lineGross - lineNet
  const qty = line.quantity > 0 ? line.quantity : 1
  return {
    ...line,
    lineGross,
    lineNet,
    lineVat,
    unitNet: lineNet / qty
  }
}

/**
 * Számla tételek.
 * - summary: anyag összesítve (m², hulladék nélkül) + szabás + él + termékek + díjak
 * - by_material: anyagonként név + m² (tábla + panel/waste) + szabás/él m
 * Mennyiség soha nem waste-szel növelt charged_sqm — a hulladék az egységárban van.
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
