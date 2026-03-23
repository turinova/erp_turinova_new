import type { SupabaseClient } from '@supabase/supabase-js'
import { createShopInvoiceInternal } from '@/lib/shop-create-invoice-internal'

const PROVIDER = 'szamlazz_hu'
const RELATED_ORDER_TYPE = 'order'

/** ISO date yyyy-mm-dd + whole calendar days (UTC components, same as previous „today” usage). */
function addCalendarDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

export type BufferAutoProformaResult =
  | { status: 'skipped'; reason: string }
  | { status: 'created'; invoiceNumber: string }
  | { status: 'error'; message: string; details?: string }

/**
 * After buffer→order import: if Számlázz master switch + payment method flag, create díjbekérő.
 * Does not throw (order import must succeed). Returns structured result for API/UI.
 */
export async function maybeCreateBufferAutoProformaInvoice(
  supabase: SupabaseClient,
  args: {
    orderId: string
    paymentMethodId: string | null
    createdByUserId?: string
  }
): Promise<BufferAutoProformaResult> {
  const { orderId, paymentMethodId } = args

  if (!paymentMethodId) {
    return { status: 'skipped', reason: 'no_payment_method_on_order' }
  }

  const { data: pm, error: pmErr } = await supabase
    .from('payment_methods')
    .select('id, name, auto_proforma_on_import')
    .eq('id', paymentMethodId)
    .is('deleted_at', null)
    .maybeSingle()

  if (pmErr) {
    console.error('[BUFFER AUTO PROFORMA] payment_methods query:', pmErr.message)
    return {
      status: 'error',
      message: 'Fizetési mód lekérdezési hiba (ellenőrizze a migrációt: auto_proforma_on_import)',
      details: pmErr.message
    }
  }

  if (!pm) {
    return { status: 'skipped', reason: 'payment_method_not_found' }
  }

  const autoProforma = Boolean((pm as { auto_proforma_on_import?: boolean }).auto_proforma_on_import)
  if (!autoProforma) {
    return { status: 'skipped', reason: 'payment_method_auto_proforma_disabled' }
  }

  const { data: szConn, error: cErr } = await supabase
    .from('webshop_connections')
    .select('id, buffer_auto_proforma_due_days')
    .eq('connection_type', 'szamlazz')
    .eq('is_active', true)
    .eq('buffer_auto_proforma_enabled', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cErr) {
    console.error('[BUFFER AUTO PROFORMA] webshop_connections query:', cErr.message)
    return {
      status: 'error',
      message: 'Számlázz kapcsolat lekérdezési hiba (buffer_auto_proforma_enabled oszlop létezik?)',
      details: cErr.message
    }
  }

  if (!szConn?.id) {
    return { status: 'skipped', reason: 'no_active_szamlazz_with_buffer_auto_proforma' }
  }

  const { data: existingDij } = await supabase
    .from('invoices')
    .select('id')
    .eq('related_order_type', RELATED_ORDER_TYPE)
    .eq('related_order_id', orderId)
    .eq('invoice_type', 'dijbekero')
    .eq('provider', PROVIDER)
    .limit(1)
    .maybeSingle()

  if (existingDij) {
    return { status: 'skipped', reason: 'dijbekero_already_exists' }
  }

  const { data: ord } = await supabase
    .from('orders')
    .select('billing_city, billing_postcode, billing_address1')
    .eq('id', orderId)
    .single()

  const o = ord as { billing_city?: string | null; billing_postcode?: string | null; billing_address1?: string | null } | null
  if (!o?.billing_city?.trim() || !o?.billing_postcode?.trim() || !o?.billing_address1?.trim()) {
    console.warn('[BUFFER AUTO PROFORMA] Skip: incomplete billing address for order', orderId)
    return { status: 'skipped', reason: 'incomplete_billing_address' }
  }

  const today = new Date().toISOString().split('T')[0]
  const rawDays = (szConn as { buffer_auto_proforma_due_days?: number }).buffer_auto_proforma_due_days
  const dueDays =
    typeof rawDays === 'number' && Number.isFinite(rawDays)
      ? Math.min(365, Math.max(0, Math.round(rawDays)))
      : 8
  const dueDate = addCalendarDaysToIsoDate(today, dueDays)
  const result = await createShopInvoiceInternal(
    supabase,
    orderId,
    {
      invoiceType: 'proforma',
      dueDate,
      fulfillmentDate: today,
      comment: 'Automatikus díjbekérő (buffer import)',
      language: 'hu',
      sendEmail: false
    },
    { forcedSzamlazzConnectionId: szConn.id }
  )

  if (!result.ok) {
    console.error('[BUFFER AUTO PROFORMA] Számlázz failed:', result.error, result.details ?? '')
    return {
      status: 'error',
      message: result.error,
      details: result.details
    }
  }

  console.log('[BUFFER AUTO PROFORMA] Created díjbekérő', result.invoiceNumber, 'order', orderId)
  return { status: 'created', invoiceNumber: result.invoiceNumber }
}
