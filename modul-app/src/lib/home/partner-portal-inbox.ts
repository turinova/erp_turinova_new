import type { SupabaseClient } from '@supabase/supabase-js'

export type HomePartnerPortalInboxRow = {
  id: string
  quoteNumber: string
  partnerName: string
  paymentMethodName: string | null
  paymentMethodComment: string | null
  totalGross: number
  currency: string
  submittedAt: string
}

/** Online partner rendelés entitlement. */
export async function tenantHasPartnerOrders(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', 'partner_orders')
    .maybeSingle()

  if (error) {
    console.error('tenantHasPartnerOrders', error.message)
    return false
  }
  return Boolean(data)
}

/**
 * Partner portálról beküldött, még staff által fel nem vett (draft) ajánlatok.
 * Main-app „Ügyfél árajánlatok” inbox párja.
 */
export async function getHomePartnerPortalInbox(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 10
): Promise<HomePartnerPortalInboxRow[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      total_gross,
      final_total_gross,
      currency,
      portal_submitted_at,
      preferred_payment_method_name,
      preferred_payment_method_comment,
      customers ( name ),
      partner_profiles ( name )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('source', 'portal')
    .eq('status', 'draft')
    .not('portal_submitted_at', 'is', null)
    .is('deleted_at', null)
    .order('portal_submitted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getHomePartnerPortalInbox', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const customers = row.customers as
      | { name: string }
      | { name: string }[]
      | null
    const customer = Array.isArray(customers) ? customers[0] : customers
    const partners = row.partner_profiles as
      | { name: string }
      | { name: string }[]
      | null
    const partner = Array.isArray(partners) ? partners[0] : partners

    const gross =
      Number(row.final_total_gross) || Number(row.total_gross) || 0

    return {
      id: row.id as string,
      quoteNumber: (row.quote_number as string) || '—',
      partnerName:
        partner?.name?.trim() || customer?.name?.trim() || 'Partner',
      paymentMethodName:
        (row.preferred_payment_method_name as string | null)?.trim() || null,
      paymentMethodComment:
        (row.preferred_payment_method_comment as string | null)?.trim() ||
        null,
      totalGross: gross,
      currency: (row.currency as string) || 'HUF',
      submittedAt: row.portal_submitted_at as string
    }
  })
}
