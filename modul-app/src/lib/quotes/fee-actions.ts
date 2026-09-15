'use server'

import { revalidatePath } from 'next/cache'

import { netFromGross } from '@/lib/fee-types/parse'
import {
  recalculateQuoteFeeTotals,
  type QuoteFeeKind
} from '@/lib/quotes/fee-totals'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type QuoteFeeActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const EDITABLE_STATUSES = new Set(['draft', 'ordered'])

function revalidateQuote(quoteId: string) {
  revalidatePath(`/ajanlatok/${quoteId}`)
  revalidatePath(`/megrendelesek`)
  revalidatePath(`/ajanlatok`)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function addQuoteFee(input: {
  quoteId: string
  feeTypeId: string
  kind: QuoteFeeKind
  quantity: number
  unitPriceGross: number
  comment?: string
}): Promise<QuoteFeeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const kind = input.kind === 'credit' ? 'credit' : 'fee'
  const quantity = Math.floor(Number(input.quantity))
  const unitPriceGrossAbs = Math.round(Number(input.unitPriceGross))

  if (!Number.isFinite(quantity) || quantity < 1) {
    return {
      ok: false,
      message: 'A mennyiség legalább 1 legyen.',
      fieldErrors: { quantity: 'A mennyiség legalább 1 legyen.' }
    }
  }
  if (!Number.isFinite(unitPriceGrossAbs) || unitPriceGrossAbs < 0) {
    return {
      ok: false,
      message: 'Érvényes bruttó árat adj meg.',
      fieldErrors: { unitPriceGross: 'Érvényes bruttó árat adj meg.' }
    }
  }
  if (!input.feeTypeId) {
    return {
      ok: false,
      message: 'Válassz díjtípust.',
      fieldErrors: { feeTypeId: 'Válassz díjtípust.' }
    }
  }

  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('id, status, total_gross, fees_total_gross, accessories_total_gross')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  if (!EDITABLE_STATUSES.has(quote.status)) {
    return {
      ok: false,
      message: 'Ebben a státuszban már nem módosítható a díj.'
    }
  }

  const { data: feeType, error: feeTypeError } = await ctx.supabase
    .from('fee_types')
    .select(
      `
      id,
      name,
      price_net,
      active,
      unit_id,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('id', input.feeTypeId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (feeTypeError || !feeType) {
    return {
      ok: false,
      message: 'A választott díjtípus nem elérhető.',
      fieldErrors: { feeTypeId: 'A választott díjtípus nem elérhető.' }
    }
  }

  const tax = Array.isArray(feeType.tax_rates)
    ? feeType.tax_rates[0]
    : feeType.tax_rates
  const unit = Array.isArray(feeType.units) ? feeType.units[0] : feeType.units
  const taxPercent = Number(tax?.rate_percent ?? 0)
  const unitShortform = (unit?.shortform || 'db').trim() || 'db'
  const unitNetAbs = netFromGross(unitPriceGrossAbs, taxPercent)
  const sign = kind === 'credit' ? -1 : 1
  const unitPriceNet = round2(unitNetAbs * sign)
  const lineNet = round2(unitPriceNet * quantity)
  const lineGross = round2(unitPriceGrossAbs * quantity * sign)
  const vatAmount = round2(lineGross - lineNet)

  const existingFeesGross = Number(quote.fees_total_gross) || 0
  const accessoriesGross = Number(quote.accessories_total_gross) || 0
  const projectedFeesGross = round2(existingFeesGross + lineGross)
  if (
    round2(
      (Number(quote.total_gross) || 0) + projectedFeesGross + accessoriesGross
    ) < 0
  ) {
    return {
      ok: false,
      message:
        'A jóváírás nagyobb lenne, mint az ajánlat összege. Csökkentsd az összeget.'
    }
  }

  const comment = (input.comment ?? '').trim() || null

  const { error: insertError } = await ctx.supabase.from('quote_fees').insert({
    tenant_id: tenantId,
    quote_id: input.quoteId,
    fee_type_id: feeType.id,
    kind,
    fee_name: feeType.name,
    quantity,
    unit_id: feeType.unit_id,
    unit_shortform: unitShortform,
    unit_price_net: unitPriceNet,
    tax_rate_percent: taxPercent,
    vat_amount: vatAmount,
    gross_price: lineGross,
    comment
  })

  if (insertError) {
    console.error('addQuoteFee', insertError.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a díjat.' }
  }

  const recalc = await recalculateQuoteFeeTotals(
    ctx.supabase,
    tenantId,
    input.quoteId
  )
  if (!recalc.ok) return { ok: false, message: recalc.message }

  revalidateQuote(input.quoteId)
  return { ok: true }
}

export async function softDeleteQuoteFee(input: {
  quoteId: string
  feeId: string
}): Promise<QuoteFeeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('id, status')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  if (!EDITABLE_STATUSES.has(quote.status)) {
    return {
      ok: false,
      message: 'Ebben a státuszban már nem módosítható a díj.'
    }
  }

  const { data, error } = await ctx.supabase
    .from('quote_fees')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.feeId)
    .eq('quote_id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('softDeleteQuoteFee', error.message)
    return { ok: false, message: 'Nem sikerült törölni a díjat.' }
  }
  if (!data) {
    return { ok: false, message: 'A díj sor nem található.' }
  }

  const recalc = await recalculateQuoteFeeTotals(
    ctx.supabase,
    tenantId,
    input.quoteId
  )
  if (!recalc.ok) return { ok: false, message: recalc.message }

  revalidateQuote(input.quoteId)
  return { ok: true }
}
