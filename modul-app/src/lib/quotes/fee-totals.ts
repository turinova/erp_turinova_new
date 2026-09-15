import type { SupabaseClient } from '@supabase/supabase-js'

export type QuoteFeeKind = 'fee' | 'credit'

export type QuoteFeeRow = {
  id: string
  fee_type_id: string | null
  kind: QuoteFeeKind
  fee_name: string
  quantity: number
  unit_id: string | null
  unit_shortform: string
  unit_price_net: number
  tax_rate_percent: number
  vat_amount: number
  gross_price: number
  comment: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Lapszabászat + díjak + termékek → végösszeg (≥ 0). */
export function computeFinalTotalGross(
  lapszabaszatGross: number,
  feesTotalGross: number,
  accessoriesTotalGross = 0
): number {
  return Math.max(
    0,
    round2(lapszabaszatGross + feesTotalGross + accessoriesTotalGross)
  )
}

export async function listQuoteFees(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<QuoteFeeRow[]> {
  const { data, error } = await supabase
    .from('quote_fees')
    .select(
      `
      id,
      fee_type_id,
      kind,
      fee_name,
      quantity,
      unit_id,
      unit_shortform,
      unit_price_net,
      tax_rate_percent,
      vat_amount,
      gross_price,
      comment
    `
    )
    .eq('tenant_id', tenantId)
    .eq('quote_id', quoteId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listQuoteFees', error.message)
    throw new Error('Nem sikerült betölteni a díjakat.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fee_type_id: row.fee_type_id,
    kind: row.kind as QuoteFeeKind,
    fee_name: row.fee_name,
    quantity: Number(row.quantity),
    unit_id: row.unit_id ?? null,
    unit_shortform: row.unit_shortform || 'db',
    unit_price_net: Number(row.unit_price_net),
    tax_rate_percent: Number(row.tax_rate_percent),
    vat_amount: Number(row.vat_amount),
    gross_price: Number(row.gross_price),
    comment: row.comment
  }))
}

/**
 * Újraszámolja fees + accessories totals és final_total_gross.
 * A payment_status-t a DB trigger számolja újra (final_total_gross változás).
 */
export async function recalculateQuoteDocumentTotals(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<{ ok: true; finalTotalGross: number } | { ok: false; message: string }> {
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, total_gross')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  const [feesResult, accessoriesResult] = await Promise.all([
    supabase
      .from('quote_fees')
      .select('unit_price_net, quantity, vat_amount, gross_price')
      .eq('quote_id', quoteId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('quote_accessories')
      .select('unit_price_net, quantity, vat_amount, gross_price')
      .eq('quote_id', quoteId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
  ])

  if (feesResult.error) {
    console.error('recalculateQuoteDocumentTotals fees', feesResult.error.message)
    return { ok: false, message: 'Nem sikerült összesíteni a díjakat.' }
  }
  if (accessoriesResult.error) {
    console.error(
      'recalculateQuoteDocumentTotals accessories',
      accessoriesResult.error.message
    )
    return { ok: false, message: 'Nem sikerült összesíteni a termékeket.' }
  }

  let feesTotalNet = 0
  let feesTotalVat = 0
  let feesTotalGross = 0
  for (const f of feesResult.data ?? []) {
    feesTotalNet += Number(f.unit_price_net) * Number(f.quantity)
    feesTotalVat += Number(f.vat_amount)
    feesTotalGross += Number(f.gross_price)
  }

  let accessoriesTotalNet = 0
  let accessoriesTotalVat = 0
  let accessoriesTotalGross = 0
  for (const a of accessoriesResult.data ?? []) {
    accessoriesTotalNet += Number(a.unit_price_net) * Number(a.quantity)
    accessoriesTotalVat += Number(a.vat_amount)
    accessoriesTotalGross += Number(a.gross_price)
  }

  feesTotalNet = round2(feesTotalNet)
  feesTotalVat = round2(feesTotalVat)
  feesTotalGross = round2(feesTotalGross)
  accessoriesTotalNet = round2(accessoriesTotalNet)
  accessoriesTotalVat = round2(accessoriesTotalVat)
  accessoriesTotalGross = round2(accessoriesTotalGross)

  const lapszabaszatGross = Number(quote.total_gross) || 0
  const finalTotalGross = computeFinalTotalGross(
    lapszabaszatGross,
    feesTotalGross,
    accessoriesTotalGross
  )

  const { error: updateError } = await supabase
    .from('quotes')
    .update({
      fees_total_net: feesTotalNet,
      fees_total_vat: feesTotalVat,
      fees_total_gross: feesTotalGross,
      accessories_total_net: accessoriesTotalNet,
      accessories_total_vat: accessoriesTotalVat,
      accessories_total_gross: accessoriesTotalGross,
      final_total_gross: finalTotalGross,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (updateError) {
    console.error('recalculateQuoteDocumentTotals update', updateError.message)
    return { ok: false, message: 'Nem sikerült menteni az összesítőt.' }
  }

  return { ok: true, finalTotalGross }
}

/** Alias — fee-actions kompatibilitás. */
export const recalculateQuoteFeeTotals = recalculateQuoteDocumentTotals
