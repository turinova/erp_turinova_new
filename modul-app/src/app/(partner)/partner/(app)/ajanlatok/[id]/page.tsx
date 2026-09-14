import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { QuoteDetailClient } from '@/components/quotes/quote-detail-client'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_LOGIN_PATH,
  PARTNER_ORDERS_PATH
} from '@/lib/auth/surface'
import { getTenantCompany } from '@/lib/company/queries'
import {
  getPartnerQuoteDetail,
  isPartnerQuoteDraft
} from '@/lib/partner/quote-detail'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Ajánlatom · ${id.slice(0, 8)}` }
}

export default async function PartnerAjanlatDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) redirect(await partnerServerHref(PARTNER_LOGIN_PATH))

  const supabase = await createClient()
  if (!supabase) notFound()

  const loaded = await getPartnerQuoteDetail(supabase, session.id, id).catch(
    () => null
  )
  if (!loaded) notFound()

  if (!isPartnerQuoteDraft(loaded.quote)) {
    redirect(await partnerServerHref(`${PARTNER_ORDERS_PATH}/${id}`))
  }

  const company = await getTenantCompany(supabase, loaded.tenantId).catch(
    () => null
  )

  return (
    <QuoteDetailClient
      surface="partner"
      quote={loaded.quote}
      company={company}
      canWrite
    />
  )
}
