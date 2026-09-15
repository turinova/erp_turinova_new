'use server'

import { revalidatePath } from 'next/cache'

import { netFromGross } from '@/lib/accessories/parse'
import { recalculateQuoteDocumentTotals } from '@/lib/quotes/fee-totals'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type QuoteAccessoryActionResult =
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

export async function addQuoteAccessory(input: {
  quoteId: string
  accessoryId: string
  quantity: number
  unitPriceGross: number
  comment?: string
}): Promise<QuoteAccessoryActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
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
  if (!input.accessoryId) {
    return {
      ok: false,
      message: 'Válassz terméket.',
      fieldErrors: { accessoryId: 'Válassz terméket.' }
    }
  }

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
      message: 'Ebben a státuszban már nem módosítható a termék.'
    }
  }

  const { data: accessory, error: accessoryError } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      unit_id,
      active,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('id', input.accessoryId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (accessoryError || !accessory) {
    return {
      ok: false,
      message: 'A választott termék nem elérhető.',
      fieldErrors: { accessoryId: 'A választott termék nem elérhető.' }
    }
  }

  const tax = Array.isArray(accessory.tax_rates)
    ? accessory.tax_rates[0]
    : accessory.tax_rates
  const unit = Array.isArray(accessory.units)
    ? accessory.units[0]
    : accessory.units
  const taxPercent = Number(tax?.rate_percent ?? 0)
  const unitShortform = (unit?.shortform || 'db').trim() || 'db'
  const unitPriceNet = netFromGross(unitPriceGrossAbs, taxPercent)
  const lineNet = round2(unitPriceNet * quantity)
  const lineGross = round2(unitPriceGrossAbs * quantity)
  const vatAmount = round2(lineGross - lineNet)

  const comment = (input.comment ?? '').trim() || null

  const { error: insertError } = await ctx.supabase
    .from('quote_accessories')
    .insert({
      tenant_id: tenantId,
      quote_id: input.quoteId,
      accessory_id: accessory.id,
      accessory_name: accessory.name,
      sku: accessory.sku,
      barcode: accessory.barcode,
      barcode_internal: accessory.barcode_internal,
      quantity,
      unit_id: accessory.unit_id,
      unit_shortform: unitShortform,
      unit_price_net: unitPriceNet,
      tax_rate_percent: taxPercent,
      vat_amount: vatAmount,
      gross_price: lineGross,
      comment
    })

  if (insertError) {
    console.error('addQuoteAccessory', insertError.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a terméket.' }
  }

  const recalc = await recalculateQuoteDocumentTotals(
    ctx.supabase,
    tenantId,
    input.quoteId
  )
  if (!recalc.ok) return { ok: false, message: recalc.message }

  revalidateQuote(input.quoteId)
  return { ok: true }
}

export async function softDeleteQuoteAccessory(input: {
  quoteId: string
  accessoryLineId: string
}): Promise<QuoteAccessoryActionResult> {
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
      message: 'Ebben a státuszban már nem módosítható a termék.'
    }
  }

  const { data, error } = await ctx.supabase
    .from('quote_accessories')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.accessoryLineId)
    .eq('quote_id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('softDeleteQuoteAccessory', error.message)
    return { ok: false, message: 'Nem sikerült törölni a terméket.' }
  }
  if (!data) {
    return { ok: false, message: 'A termék sor nem található.' }
  }

  const recalc = await recalculateQuoteDocumentTotals(
    ctx.supabase,
    tenantId,
    input.quoteId
  )
  if (!recalc.ok) return { ok: false, message: recalc.message }

  revalidateQuote(input.quoteId)
  return { ok: true }
}
