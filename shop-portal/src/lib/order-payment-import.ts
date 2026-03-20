import type { SupabaseClient } from '@supabase/supabase-js'

/** Synthetic payment row for buffer import when payment_methods.import_payment_policy = paid_on_import */
export const ORDER_PAYMENT_IMPORT_REFERENCE = 'import_auto_paid'

export type ImportPaymentPolicy = 'pending' | 'paid_on_import'

/**
 * If the ERP payment method is configured for paid-on-import, inserts one order_payments row
 * so update_order_payment_status() sets orders.payment_status. Idempotent per order.
 */
export async function maybeInsertImportAutoPaidPayment(
  supabase: SupabaseClient,
  args: {
    orderId: string
    paymentMethodId: string | null
    createdByUserId: string
  }
): Promise<void> {
  const { orderId, paymentMethodId, createdByUserId } = args

  if (!paymentMethodId) return

  const { data: pm, error: pmErr } = await supabase
    .from('payment_methods')
    .select('id, name, import_payment_policy')
    .eq('id', paymentMethodId)
    .is('deleted_at', null)
    .maybeSingle()

  if (pmErr || !pm) return

  const policy = (pm as { import_payment_policy?: string }).import_payment_policy

  if (policy !== 'paid_on_import') return

  const { data: order } = await supabase
    .from('orders')
    .select('total_gross')
    .eq('id', orderId)
    .single()

  const total = parseFloat(String((order as { total_gross?: unknown } | null)?.total_gross ?? 0)) || 0

  if (total <= 0) return

  const { data: existing } = await supabase
    .from('order_payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('reference_number', ORDER_PAYMENT_IMPORT_REFERENCE)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) return

  const { error: insErr } = await supabase.from('order_payments').insert({
    order_id: orderId,
    amount: total,
    payment_method_id: paymentMethodId,
    payment_method_name: (pm as { name?: string }).name ?? null,
    reference_number: ORDER_PAYMENT_IMPORT_REFERENCE,
    notes: 'Automatikus import: fizetettnek jelölve a fizetési mód import szabálya szerint.',
    created_by: createdByUserId
  })

  if (insErr) {
    console.error('[BUFFER PROCESS] import_auto_paid payment insert failed:', insErr)
    throw new Error(insErr.message || 'Failed to record import payment')
  }
}
