import type { SupabaseClient } from '@supabase/supabase-js'

export type PoListRow = Record<string, unknown> & {
  supplier_id?: string | null
  supplier_has_email_channel?: boolean
}

/**
 * Adds supplier_has_email_channel for each PO row (beszállítónak van-e e-mail rendelési csatornája).
 */
export async function enrichPurchaseOrdersWithSupplierEmailChannel(
  supabase: SupabaseClient,
  rows: PoListRow[]
): Promise<PoListRow[]> {
  if (!rows?.length) return rows
  const supplierIds = [...new Set(rows.map((r) => r.supplier_id).filter(Boolean) as string[])]
  if (supplierIds.length === 0) {
    return rows.map((r) => ({ ...r, supplier_has_email_channel: false }))
  }
  const { data: channels } = await supabase
    .from('supplier_order_channels')
    .select('supplier_id')
    .in('supplier_id', supplierIds)
    .eq('channel_type', 'email')
    .is('deleted_at', null)

  const withEmail = new Set((channels || []).map((c: { supplier_id: string }) => c.supplier_id))
  return rows.map((r) => ({
    ...r,
    supplier_has_email_channel: r.supplier_id ? withEmail.has(r.supplier_id as string) : false
  }))
}
