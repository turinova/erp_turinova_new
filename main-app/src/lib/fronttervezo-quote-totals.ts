import { supabaseServer } from '@/lib/supabase-server'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Újraszámolja a fronttervezo_quotes fees + total + final mezőket.
 * Kedvezmény: lines + services + pozitív díjak bruttójára.
 */
export async function recalculateFronttervezoQuoteTotals(quoteId: string): Promise<void> {
  const [{ data: quote }, { data: fees }] = await Promise.all([
    supabaseServer
      .from('fronttervezo_quotes')
      .select(
        'lines_total_net, lines_total_vat, lines_total_gross, services_total_net, services_total_vat, services_total_gross, discount_percent'
      )
      .eq('id', quoteId)
      .is('deleted_at', null)
      .single(),
    supabaseServer
      .from('fronttervezo_quote_fees')
      .select('unit_price_net, quantity, vat_rate')
      .eq('quote_id', quoteId)
      .is('deleted_at', null)
  ])

  if (!quote) return

  const feesTotalNet =
    fees?.reduce((sum, f) => sum + Number(f.unit_price_net) * Number(f.quantity || 1), 0) || 0
  const feesTotalVat =
    fees?.reduce((sum, f) => {
      const net = Number(f.unit_price_net) * Number(f.quantity || 1)
      return sum + net * Number(f.vat_rate)
    }, 0) || 0
  const feesTotalGross = feesTotalNet + feesTotalVat

  const linesNet = Number(quote.lines_total_net) || 0
  const linesVat = Number(quote.lines_total_vat) || 0
  const linesGross = Number(quote.lines_total_gross) || 0
  const servicesNet = Number(quote.services_total_net) || 0
  const servicesVat = Number(quote.services_total_vat) || 0
  const servicesGross = Number(quote.services_total_gross) || 0

  const totalNet = round2(linesNet + servicesNet + feesTotalNet)
  const totalVat = round2(linesVat + servicesVat + feesTotalVat)
  const totalGross = round2(linesGross + servicesGross + feesTotalGross)

  const discountPercent = Number(quote.discount_percent) || 0
  const positiveBase = linesGross + servicesGross + Math.max(0, feesTotalGross)
  const discountAmount = round2(positiveBase * (discountPercent / 100))
  const finalTotal = round2(positiveBase - discountAmount + Math.min(0, feesTotalGross))

  await supabaseServer
    .from('fronttervezo_quotes')
    .update({
      fees_total_net: round2(feesTotalNet),
      fees_total_vat: round2(feesTotalVat),
      fees_total_gross: round2(feesTotalGross),
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      final_total_after_discount: finalTotal,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
}
