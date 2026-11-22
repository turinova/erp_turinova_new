import type { SupabaseClient } from '@supabase/supabase-js'

import { phoneLast4 } from '@/lib/kiosk/customer-match-rules'

export type HomeKioskInboxRow = {
  id: string
  quoteNumber: string
  guestName: string
  phoneLast4: string
  totalGross: number
  submittedAt: string
  needsCheck: boolean
}

/** Bolti kioskról leadott, még meg nem rendelt (draft) ajánlatok. */
export async function getHomeKioskInbox(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 10
): Promise<{ rows: HomeKioskInboxRow[]; total: number }> {
  const { data, error, count } = await supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      total_gross,
      final_total_gross,
      kiosk_submitted_at,
      kiosk_guest_name,
      kiosk_guest_phone,
      kiosk_customer_match,
      customers ( name )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .eq('source', 'kiosk')
    .eq('status', 'draft')
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('kiosk_submitted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getHomeKioskInbox', error.message)
    return { rows: [], total: 0 }
  }

  const rows = (data ?? []).map((row) => {
    const customers = row.customers as
      | { name: string }
      | { name: string }[]
      | null
    const customer = Array.isArray(customers) ? customers[0] : customers
    return {
      id: row.id as string,
      quoteNumber: (row.quote_number as string) || '',
      guestName:
        (row.kiosk_guest_name as string | null)?.trim() ||
        customer?.name?.trim() ||
        'Vevő',
      phoneLast4: phoneLast4(row.kiosk_guest_phone as string | null),
      totalGross:
        Number(row.final_total_gross) || Number(row.total_gross) || 0,
      submittedAt: row.kiosk_submitted_at as string,
      needsCheck:
        row.kiosk_customer_match === 'phone_multiple' ||
        row.kiosk_customer_match === 'created_renamed'
    }
  })

  return { rows, total: count ?? rows.length }
}
