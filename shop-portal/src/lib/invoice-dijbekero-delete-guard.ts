/**
 * Block díjbekérő deletion when an active számla or előlegszámla already exists on the same order
 * (Számlázz links végszámla via dijbekeroSzamlaszam; előleg may follow partial díjbekérő).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type InvoiceRowForDijbekeroGuard = {
  id: string
  invoice_type: string
  is_storno_of_invoice_id?: string | null
}

/** Sync: same order’s invoices (e.g. OrderDetailForm list). */
export function isDijbekeroDeletionBlockedForOrderInvoices(
  invoices: InvoiceRowForDijbekeroGuard[]
): boolean {
  if (!invoices?.length) return false
  const stornoTargets = new Set(
    invoices
      .filter((i) => i.invoice_type === 'sztorno' && i.is_storno_of_invoice_id)
      .map((i) => String(i.is_storno_of_invoice_id))
  )
  return invoices.some(
    (i) =>
      (i.invoice_type === 'szamla' || i.invoice_type === 'elolegszamla') && !stornoTargets.has(String(i.id))
  )
}

/** Server: load invoices for order and apply the same rule. */
export async function isDijbekeroDeletionBlockedForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('related_order_id', orderId)
    .eq('related_order_type', 'order')
    .is('deleted_at', null)

  if (error || !invoices?.length) return false
  return isDijbekeroDeletionBlockedForOrderInvoices(invoices as InvoiceRowForDijbekeroGuard[])
}

/** Batch for outgoing-invoices list: which order IDs block díjbekérő delete. */
export async function computeDijbekeroDeletionBlockedByOrderId(
  supabase: SupabaseClient,
  orderIds: string[]
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  if (!orderIds.length) return out

  const { data: rows, error } = await supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id, related_order_id')
    .eq('related_order_type', 'order')
    .in('related_order_id', orderIds)
    .is('deleted_at', null)

  if (error || !rows?.length) {
    for (const id of orderIds) out[id] = false
    return out
  }

  const byOrder = new Map<string, InvoiceRowForDijbekeroGuard[]>()
  for (const r of rows) {
    const oid = String(r.related_order_id)
    if (!byOrder.has(oid)) byOrder.set(oid, [])
    byOrder.get(oid)!.push({
      id: String(r.id),
      invoice_type: String(r.invoice_type),
      is_storno_of_invoice_id: r.is_storno_of_invoice_id as string | null | undefined
    })
  }

  for (const id of orderIds) {
    out[id] = isDijbekeroDeletionBlockedForOrderInvoices(byOrder.get(id) ?? [])
  }
  return out
}

export const DIJBEKERO_DELETE_BLOCKED_MESSAGE =
  'A díjbekérő nem törölhető: ehhez a rendeléshez már létezik aktív számla vagy előlegszámla. A sztornózott bizonylatok nem blokkolják a törlést.'
