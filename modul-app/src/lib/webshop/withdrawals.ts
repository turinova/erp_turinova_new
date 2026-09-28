import type { SupabaseClient } from '@supabase/supabase-js'

export const WITHDRAWALS_PAGE_SIZE = 25

export type WithdrawalFilter = 'open' | 'handled' | 'all'

export type AdminWithdrawalRow = {
  id: string
  reference: string
  customerName: string
  customerEmail: string
  orderReference: string
  items: string | null
  comment: string | null
  refundAccount: string | null
  submittedAt: string
  receiptSentAt: string | null
  receiptError: string | null
  handledAt: string | null
}

const COLUMNS =
  'id, reference, customer_name, customer_email, order_reference, items, comment, refund_account, submitted_at, receipt_sent_at, receipt_error, handled_at'

export async function listAdminWithdrawals(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { filter: WithdrawalFilter; page: number }
): Promise<{ rows: AdminWithdrawalRow[]; total: number; openCount: number }> {
  const from = (opts.page - 1) * WITHDRAWALS_PAGE_SIZE
  let q = supabase
    .from('webshop_withdrawals')
    .select(COLUMNS, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('submitted_at', { ascending: false })
    .range(from, from + WITHDRAWALS_PAGE_SIZE - 1)
  if (opts.filter === 'open') q = q.is('handled_at', null)
  if (opts.filter === 'handled') q = q.not('handled_at', 'is', null)

  const [list, open] = await Promise.all([
    q,
    supabase
      .from('webshop_withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('handled_at', null)
  ])
  if (list.error) {
    if (list.error.code !== '42P01' && list.error.code !== 'PGRST205') {
      console.error('listAdminWithdrawals', list.error.message)
    }
    return { rows: [], total: 0, openCount: 0 }
  }
  const rows = (list.data ?? []).map((r) => ({
    id: String(r.id),
    reference: String(r.reference),
    customerName: String(r.customer_name),
    customerEmail: String(r.customer_email),
    orderReference: String(r.order_reference),
    items: (r.items as string | null) ?? null,
    comment: (r.comment as string | null) ?? null,
    refundAccount: (r.refund_account as string | null) ?? null,
    submittedAt: String(r.submitted_at),
    receiptSentAt: (r.receipt_sent_at as string | null) ?? null,
    receiptError: (r.receipt_error as string | null) ?? null,
    handledAt: (r.handled_at as string | null) ?? null
  }))
  return { rows, total: list.count ?? rows.length, openCount: open.count ?? 0 }
}
