import { createAdminClient } from '@/lib/supabase-server'

type CustomerFacingPdfEvent = {
  portalCustomerId: string
  source: 'opti' | 'nettfront'
  quoteId: string
  quoteNumber: string
  quoteStatus?: string | null
  generatedFrom?: 'saved' | 'orders' | 'unknown'
  markupPercent?: number | null
  manualLinesCount?: number
}

/**
 * Best-effort analytics insert. Logging failures must not block PDF download.
 */
export async function logCustomerFacingPdfGenerated(
  event: CustomerFacingPdfEvent
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('portal_customer_facing_pdf_events').insert({
    portal_customer_id: event.portalCustomerId,
    source: event.source,
    quote_id: event.quoteId,
    quote_number: event.quoteNumber,
    quote_status: event.quoteStatus ?? null,
    generated_from: event.generatedFrom ?? 'unknown',
    markup_percent: event.markupPercent ?? null,
    manual_lines_count: Math.max(0, Number(event.manualLinesCount) || 0)
  })

  if (error) {
    throw error
  }
}
