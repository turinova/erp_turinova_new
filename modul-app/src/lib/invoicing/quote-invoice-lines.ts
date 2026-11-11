import {
  fitNetFirstLines,
  type GrossTargetLine,
  type NetFirstInvoiceLine
} from '@/lib/invoicing/net-first-lines'
import { inferVatPercent, normalizeVatPercent } from '@/lib/money/vat-split'
import { formatQuoteFeeLabel } from '@/lib/quotes/fee-totals'

export type QuoteInvoiceLine = NetFirstInvoiceLine

/** Összesített (default) vs anyagonkénti tételrészletezés. */
export type QuoteInvoiceDetailLevel = 'summary' | 'by_material'

export type MapQuoteInvoiceLinesOpts = {
  detailLevel?: QuoteInvoiceDetailLevel
}

/** Ami a számlatételekhez kell — QuoteDetail és a PDF payload is kielégíti. */
export type QuoteInvoiceSource = {
  order_number: string | null
  quote_number: string
  final_total_gross: number
  material_lines: Array<{
    material_name: string
    /** Tört (0.27); régi sornál hiányozhat → nettó/bruttóból becsült. */
    vat_rate?: number | null
    boards_charged: number
    charged_sqm: number
    waste_multi: number
    board_grain_mm: number
    board_cross_mm: number
    material_net: number
    material_gross: number
    cutting_length_m: number
    cutting_net: number
    cutting_gross: number
    edge_length_m: number
    edge_net: number
    edge_gross: number
    services?: Array<{
      service_type: string
      quantity: number
      unit: string
      net_price: number
      gross_price: number
    }> | null
  }>
  accessories: Array<{
    accessory_name: string
    quantity: number
    unit_shortform: string
    tax_rate_percent: number
    gross_price: number
  }>
  fees: Array<{
    kind: 'fee' | 'credit'
    fee_name: string
    comment: string | null
    quantity: number
    unit_shortform: string
    tax_rate_percent: number
    gross_price: number
  }>
}

type MaterialLine = QuoteInvoiceSource['material_lines'][number]

/** Régi (±2 Ft) tizedes snapshotok elnyelése; nagyobb eltérés = adathiba. */
const GROSS_TOLERANCE = 2

function roundQty(n: number): number {
  return Math.round(n * 100) / 100
}

export function materialVatPercent(ml: MaterialLine): number {
  const rate = Number(ml.vat_rate)
  if (ml.vat_rate != null && Number.isFinite(rate)) {
    return normalizeVatPercent(rate * 100)
  }
  return inferVatPercent(ml.material_net, ml.material_gross, 27)
}

export function cuttingVatPercent(ml: MaterialLine): number {
  return inferVatPercent(ml.cutting_net, ml.cutting_gross, materialVatPercent(ml))
}

export function edgeVatPercent(ml: MaterialLine): number {
  return inferVatPercent(ml.edge_net, ml.edge_gross, materialVatPercent(ml))
}

export function serviceVatPercent(
  ml: MaterialLine,
  svc: { net_price: number; gross_price: number }
): number {
  return inferVatPercent(svc.net_price, svc.gross_price, materialVatPercent(ml))
}

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

function qtyOrOne(qty: number): number {
  return qty >= 0.01 ? qty : 1
}

function serviceLabel(serviceType: string, materialName?: string): string {
  const base =
    serviceType === 'duplungolas'
      ? 'Duplungolás'
      : serviceType === 'szogvagas'
        ? 'Szögvágás'
        : serviceType === 'panthelyfuras'
          ? 'Pánthelyfúrás'
          : serviceType
  if (materialName?.trim()) return `${base} — ${materialName.trim()}`
  return base
}

function serviceQty(unit: string, qtyRaw: number): number {
  return unit === 'm²'
    ? qtyOrOne(roundQty(qtyRaw))
    : Math.max(1, Math.round(qtyRaw) || 1)
}

/** Kulcs szerint csoportosított összesítő sor (vegyes ÁFA ne olvadjon össze). */
class RateGroups {
  private groups = new Map<
    string,
    { name: string; unit: string; vatPercent: number; quantity: number; gross: number }
  >()

  add(key: string, name: string, unit: string, vatPercent: number, quantity: number, gross: number) {
    const k = `${key}|${vatPercent}`
    const g = this.groups.get(k)
    if (g) {
      g.quantity += quantity
      g.gross += gross
    } else {
      this.groups.set(k, { name, unit, vatPercent, quantity, gross })
    }
  }

  toTargets(qtyFor: (unit: string, qty: number) => { quantity: number; unit: string }): GrossTargetLine[] {
    return [...this.groups.values()].map((g) => ({
      name: g.name,
      ...qtyFor(g.unit, g.quantity),
      vatPercent: g.vatPercent,
      gross: g.gross
    }))
  }
}

function lengthQty(_unit: string, qty: number) {
  const q = roundQty(qty)
  return q >= 0.01 ? { quantity: q, unit: 'm' } : { quantity: 1, unit: 'db' }
}

function summaryTargets(src: QuoteInvoiceSource): GrossTargetLine[] {
  const material = new RateGroups()
  const cutting = new RateGroups()
  const edge = new RateGroups()
  const services = new RateGroups()

  for (const ml of src.material_lines) {
    material.add('m', 'Táblás anyag', 'm²', materialVatPercent(ml), materialInvoiceDisplayM2(ml), Number(ml.material_gross) || 0)
    cutting.add('c', 'Szabás díj', 'm', cuttingVatPercent(ml), Number(ml.cutting_length_m) || 0, Number(ml.cutting_gross) || 0)
    edge.add('e', 'Élzárás', 'm', edgeVatPercent(ml), Number(ml.edge_length_m) || 0, Number(ml.edge_gross) || 0)
    for (const svc of ml.services ?? []) {
      const unit = svc.unit || (svc.service_type === 'duplungolas' ? 'm²' : 'db')
      services.add(svc.service_type, serviceLabel(svc.service_type), unit, serviceVatPercent(ml, svc), Number(svc.quantity) || 0, Number(svc.gross_price) || 0)
    }
  }

  return [
    ...material.toTargets((unit, qty) => ({ quantity: qtyOrOne(roundQty(qty)), unit })),
    ...cutting.toTargets(lengthQty),
    ...edge.toTargets(lengthQty),
    ...services.toTargets((unit, qty) => ({ quantity: serviceQty(unit, qty), unit }))
  ]
}

function byMaterialTargets(src: QuoteInvoiceSource): GrossTargetLine[] {
  const targets: GrossTargetLine[] = []
  for (const ml of src.material_lines) {
    const name = ml.material_name?.trim() || 'Táblás anyag'
    targets.push({
      name,
      quantity: qtyOrOne(roundQty(materialInvoiceDisplayM2(ml))),
      unit: 'm²',
      vatPercent: materialVatPercent(ml),
      gross: Number(ml.material_gross) || 0
    })
    targets.push({
      name: `Szabás — ${name}`,
      ...lengthQty('m', Number(ml.cutting_length_m) || 0),
      vatPercent: cuttingVatPercent(ml),
      gross: Number(ml.cutting_gross) || 0
    })
    targets.push({
      name: `Élzárás — ${name}`,
      ...lengthQty('m', Number(ml.edge_length_m) || 0),
      vatPercent: edgeVatPercent(ml),
      gross: Number(ml.edge_gross) || 0
    })
    for (const svc of ml.services ?? []) {
      const unit = svc.unit || (svc.service_type === 'duplungolas' ? 'm²' : 'db')
      targets.push({
        name: serviceLabel(svc.service_type, name),
        quantity: serviceQty(unit, Number(svc.quantity) || 0),
        unit,
        vatPercent: serviceVatPercent(ml, svc),
        gross: Number(svc.gross_price) || 0
      })
    }
  }
  return targets
}

function accessoryAndFeeTargets(src: QuoteInvoiceSource): GrossTargetLine[] {
  const targets: GrossTargetLine[] = []
  for (const acc of src.accessories) {
    targets.push({
      name: acc.accessory_name,
      quantity: Number(acc.quantity) || 1,
      unit: acc.unit_shortform || 'db',
      vatPercent: normalizeVatPercent(acc.tax_rate_percent),
      gross: Number(acc.gross_price) || 0
    })
  }
  for (const fee of src.fees) {
    // DB: credit gross_price már negatív; régi pozitív sor se forduljon díjjá.
    const grossAbs = Math.abs(Number(fee.gross_price) || 0)
    targets.push({
      name: formatQuoteFeeLabel(fee.fee_name, fee.comment, {
        creditPrefix: fee.kind === 'credit'
      }),
      quantity: Math.abs(Number(fee.quantity)) || 1,
      unit: fee.unit_shortform || 'db',
      vatPercent: normalizeVatPercent(fee.tax_rate_percent),
      gross: fee.kind === 'credit' ? -grossAbs : grossAbs
    })
  }
  return targets
}

/**
 * Számla tételek — sor bruttó = DB snapshot; nettó/ÁFA nettó-első bontás
 * (áfa = kerekít(nettó × kulcs / 100)), Σ bruttó = `final_total_gross` fillérre.
 * - summary: anyag + szabás + él + megmunkálás (ÁFA kulcsonként) + termékek + díjak
 * - by_material: anyagonként név + m² + szabás/él/megmunkálás
 * Mennyiség soha nem waste-szel növelt charged_sqm — a hulladék az egységárban van.
 */
export function mapQuoteInvoiceLines(
  src: QuoteInvoiceSource,
  opts: MapQuoteInvoiceLinesOpts = {}
): { ok: true; lines: QuoteInvoiceLine[] } | { ok: false; message: string } {
  const detailLevel = opts.detailLevel ?? 'summary'
  const due = Math.round(Number(src.final_total_gross) || 0)
  const targets = [
    ...(detailLevel === 'by_material' ? byMaterialTargets(src) : summaryTargets(src)),
    ...accessoryAndFeeTargets(src)
  ].filter((t) => Math.round(t.gross) !== 0)

  if (targets.length === 0) {
    if (due <= 0) {
      return { ok: false, message: 'Nincs számlázható tétel az ajánlaton.' }
    }
    targets.push({
      name: `Megrendelés ${src.order_number ?? src.quote_number}`,
      quantity: 1,
      unit: 'db',
      vatPercent: 27,
      gross: due,
      splitMode: 'keep'
    })
  }

  const fitted = fitNetFirstLines(targets, due, { tolerance: GROSS_TOLERANCE })
  if (!fitted.ok) {
    return {
      ok: false,
      message: `${fitted.message} Ellenőrizd az ajánlat tételeit, majd mentsd újra.`
    }
  }
  if (fitted.lines.length === 0) {
    return { ok: false, message: 'Nincs számlázható tétel az ajánlaton.' }
  }
  return fitted
}

/** Ajánlat összesítő nettó / ÁFA — ugyanaz, mint a (summary) számlán. */
export function quoteNetFirstTotals(
  src: QuoteInvoiceSource
): { net: number; vat: number; gross: number } | null {
  const mapped = mapQuoteInvoiceLines(src, { detailLevel: 'summary' })
  if (!mapped.ok) return null
  return mapped.lines.reduce(
    (acc, l) => ({
      net: acc.net + l.lineNet,
      vat: acc.vat + l.lineVat,
      gross: acc.gross + l.lineGross
    }),
    { net: 0, vat: 0, gross: 0 }
  )
}

/** Összesítő (summary) számlatételek nettója tételnév szerint — UI kijelzéshez. */
export function summaryInvoiceNetByName(
  src: QuoteInvoiceSource
): Map<string, number> {
  const out = new Map<string, number>()
  const mapped = mapQuoteInvoiceLines(src, { detailLevel: 'summary' })
  if (!mapped.ok) return out
  for (const l of mapped.lines) {
    out.set(l.name, (out.get(l.name) ?? 0) + l.lineNet)
  }
  return out
}

export function quoteHasBilling(detail: {
  customer: {
    billing_name: string | null
    billing_city: string | null
    billing_street: string | null
    name: string | null
  }
}): boolean {
  const c = detail.customer
  return Boolean(
    c.billing_name?.trim() ||
      c.billing_city?.trim() ||
      c.billing_street?.trim() ||
      c.name?.trim()
  )
}
