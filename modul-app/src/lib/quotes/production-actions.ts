'use server'

import { revalidatePath } from 'next/cache'

import { quoteRemainingGross } from '@/lib/quotes/payment-labels'
import { normalizeBarcode } from '@/lib/quotes/production-utils'
import { sendQuoteReadySms } from '@/lib/sms/send-ready'
import type { QuoteReadySmsResult } from '@/lib/sms/send-ready'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const LIST_PATH = '/ajanlatok'
const ORDERS_PATH = '/megrendelesek'
const HOME_PATH = '/home'

function revalidateOrderPaths(quoteId: string) {
  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${quoteId}`)
  revalidatePath(ORDERS_PATH)
  revalidatePath(HOME_PATH)
}

export type ProductionActionResult =
  | { ok: true }
  | { ok: false; message: string }

export async function assignQuoteProduction(input: {
  quoteId: string
  productionMachineId: string
  productionDate: string
  barcode: string
}): Promise<ProductionActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const barcode = normalizeBarcode(input.barcode)
  const productionDate = input.productionDate.trim()
  const machineId = input.productionMachineId.trim()

  if (!machineId) {
    return { ok: false, message: 'Válassz gyártógépet.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) {
    return { ok: false, message: 'Érvénytelen gyártás dátum.' }
  }
  if (!barcode) {
    return { ok: false, message: 'A vonalkód kötelező.' }
  }
  if (barcode.length > 64) {
    return { ok: false, message: 'A vonalkód túl hosszú.' }
  }

  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('id, status, order_number, in_production_at')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'A megrendelés nem található.' }
  }

  if (!quote.order_number) {
    return { ok: false, message: 'Nincs megrendelésszám — előbb alakítsd megrendeléssé.' }
  }

  if (quote.status !== 'ordered' && quote.status !== 'in_production') {
    return {
      ok: false,
      message: 'Csak megrendelt vagy gyártásban lévő tétel adható gyártásba.'
    }
  }

  const { data: machine, error: machineError } = await ctx.supabase
    .from('production_machines')
    .select('id, name')
    .eq('id', machineId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (machineError || !machine) {
    return {
      ok: false,
      message: 'A választott gyártógép nem elérhető. Ellenőrizd a törzsadatot.'
    }
  }

  const patch: Record<string, unknown> = {
    production_machine_id: machine.id,
    production_date: productionDate,
    barcode,
    status: 'in_production',
    updated_at: new Date().toISOString()
  }
  if (!quote.in_production_at) {
    patch.in_production_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('quotes')
    .update(patch)
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .in('status', ['ordered', 'in_production'])
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('assignQuoteProduction', updateError.message)
    if (
      updateError.message.includes('quotes_tenant_barcode_alive') ||
      (updateError.message.includes('duplicate') &&
        updateError.message.includes('barcode'))
    ) {
      return { ok: false, message: 'Ez a vonalkód már használatban van.' }
    }
    return { ok: false, message: 'Nem sikerült gyártásba adni.' }
  }

  if (!updated) {
    return {
      ok: false,
      message: 'A státusz közben megváltozott — frissítsd az oldalt.'
    }
  }

  revalidateOrderPaths(input.quoteId)
  return { ok: true }
}

export async function clearQuoteProduction(
  quoteId: string
): Promise<ProductionActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: updated, error } = await ctx.supabase
    .from('quotes')
    .update({
      production_machine_id: null,
      production_date: null,
      barcode: null,
      status: 'ordered',
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .eq('status', 'in_production')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('clearQuoteProduction', error.message)
    return { ok: false, message: 'Nem sikerült törölni a gyártás hozzárendelést.' }
  }

  if (!updated) {
    return {
      ok: false,
      message: 'Csak gyártásban lévő tételről vehető le a gyártás.'
    }
  }

  revalidateOrderPaths(quoteId)
  return { ok: true }
}

export type MarkQuoteReadyResult =
  | { ok: true; sms: QuoteReadySmsResult | null }
  | { ok: false; message: string }

/** Gyártásban → Kész. SMS opcionális; fail nem rollbackeli a ready státuszt. */
export async function markQuoteReady(
  quoteId: string,
  options?: { sendSms?: boolean }
): Promise<MarkQuoteReadyResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: updated, error } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'ready',
      ready_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .eq('status', 'in_production')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('markQuoteReady', error.message)
    return { ok: false, message: 'Nem sikerült készre állítani.' }
  }

  if (!updated) {
    return {
      ok: false,
      message: 'Csak gyártásban lévő megrendelés állítható készre.'
    }
  }

  let sms: QuoteReadySmsResult | null = null
  if (options && typeof options.sendSms === 'boolean') {
    try {
      sms = await sendQuoteReadySms({
        supabase: ctx.supabase,
        tenantId,
        tenantName: ctx.user.companyName || 'Optinova',
        quoteId,
        userId: ctx.user.id,
        sendSms: options.sendSms
      })
    } catch (err) {
      console.error('markQuoteReady sms', err)
      sms = {
        status: 'failed',
        error: err instanceof Error ? err.message : 'SMS hiba'
      }
    }
  }

  revalidateOrderPaths(quoteId)
  return { ok: true, sms }
}

export type FinishQuoteHandoverResult =
  | { ok: true; paymentCreated: boolean }
  | { ok: false; message: string }

/** Kész → Lezárva (átadás), opcionális hátralék rögzítéssel. */
export async function finishQuoteHandover(input: {
  quoteId: string
  settleRemaining: boolean
  paymentMethodId?: string
}): Promise<FinishQuoteHandoverResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const userId = ctx.user.id
  if (!userId) {
    return { ok: false, message: 'Nincs bejelentkezett felhasználó.' }
  }

  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('id, status, order_number, total_gross, final_total_gross, payment_status')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'A megrendelés nem található.' }
  }

  if (!quote.order_number) {
    return { ok: false, message: 'Nincs megrendelésszám.' }
  }

  if (quote.status !== 'ready') {
    return {
      ok: false,
      message: 'Csak kész státuszú megrendelés adható át.'
    }
  }

  const { data: payments } = await ctx.supabase
    .from('quote_payments')
    .select('amount')
    .eq('quote_id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const totalPaid = (payments ?? []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  )
  const totalGross =
    Number(quote.final_total_gross ?? quote.total_gross) || 0
  const remaining = quoteRemainingGross(totalGross, totalPaid)
  let paymentCreated = false

  if (input.settleRemaining && remaining > 0) {
    const methodId = input.paymentMethodId?.trim() ?? ''
    if (!methodId) {
      return { ok: false, message: 'Válassz fizetési módot a hátralékhoz.' }
    }

    const { data: method, error: methodError } = await ctx.supabase
      .from('payment_methods')
      .select('id, name')
      .eq('id', methodId)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (methodError || !method) {
      return {
        ok: false,
        message: 'A választott fizetési mód nem elérhető.'
      }
    }

    const { error: insertError } = await ctx.supabase
      .from('quote_payments')
      .insert({
        tenant_id: tenantId,
        quote_id: input.quoteId,
        amount: remaining,
        payment_method_id: method.id,
        payment_method_name: method.name,
        comment: 'Átadáskori hátralék',
        payment_date: new Date().toISOString(),
        created_by: userId
      })

    if (insertError) {
      console.error('finishQuoteHandover payment', insertError.message)
      return {
        ok: false,
        message: 'Nem sikerült rögzíteni a hátralékot — átadás megszakítva.'
      }
    }
    paymentCreated = true
  }

  const { data: updated, error: updateError } = await ctx.supabase
    .from('quotes')
    .update({
      status: 'finished',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .eq('status', 'ready')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('finishQuoteHandover', updateError.message)
    return { ok: false, message: 'Nem sikerült lezárni az átadást.' }
  }

  if (!updated) {
    return {
      ok: false,
      message: 'A státusz közben megváltozott — frissítsd az oldalt.'
    }
  }

  revalidateOrderPaths(input.quoteId)
  return { ok: true, paymentCreated }
}
