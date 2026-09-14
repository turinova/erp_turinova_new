import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getQuoteDetail,
  type QuoteDetail
} from '@/lib/quotes/queries'

export type PartnerQuoteDetailResult = {
  quote: QuoteDetail
  tenantId: string
}

/**
 * Partner saját portal quote detail.
 * Beküldött ajánlatnál betölti a befizetéseket (RLS: quote_payments_select_own_partner).
 */
export async function getPartnerQuoteDetail(
  supabase: SupabaseClient,
  partnerId: string,
  quoteId: string
): Promise<PartnerQuoteDetailResult | null> {
  const { data: meta, error: metaError } = await supabase
    .from('quotes')
    .select('id, tenant_id, source, partner_profile_id, portal_submitted_at')
    .eq('id', quoteId)
    .eq('partner_profile_id', partnerId)
    .eq('source', 'portal')
    .is('deleted_at', null)
    .maybeSingle()

  if (metaError) {
    console.error('getPartnerQuoteDetail meta', metaError.message)
    throw new Error('Nem sikerült betölteni az ajánlatot.')
  }
  if (!meta) return null

  const submitted = meta.portal_submitted_at != null

  const quote = await getQuoteDetail(supabase, meta.tenant_id, quoteId, {
    allowUnsubmittedPortal: true,
    skipPayments: !submitted
  })

  if (!quote) return null

  return { quote, tenantId: meta.tenant_id }
}

export function isPartnerQuoteDraft(quote: QuoteDetail): boolean {
  return quote.source === 'portal' && quote.portal_submitted_at == null
}
