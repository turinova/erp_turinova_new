import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PartnerTeyaCheckout } from '@/components/partner/partner-teya-checkout'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_LOGIN_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH
} from '@/lib/auth/surface'
import { resolvePartnerCompanyLabel } from '@/lib/partner/company-label'
import {
  getPartnerQuoteDetail,
  isPartnerQuoteDraft
} from '@/lib/partner/quote-detail'
import {
  quoteRemainingGross,
  roundQuoteMoney
} from '@/lib/quotes/payment-labels'
import { partnerQuoteTabTitle } from '@/lib/seo/tab-titles'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

function formatBillingLine(input: {
  postal: string | null | undefined
  city: string | null | undefined
  street: string | null | undefined
}): string | null {
  const parts = [
    [input.postal, input.city].filter(Boolean).join(' '),
    input.street?.trim() || null
  ].filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(', ') : null
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) return { title: 'Fizetés' }
  const supabase = await createClient()
  if (!supabase) return { title: 'Fizetés' }
  const label = await partnerQuoteTabTitle(supabase, session.id, id, 'order')
  return { title: label ? `Fizetés · ${label}` : 'Fizetés' }
}

export default async function PartnerTeyaPayPage({
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

  if (isPartnerQuoteDraft(loaded.quote)) {
    redirect(await partnerServerHref(`${PARTNER_QUOTES_PATH}/${id}`))
  }

  if (loaded.quote.payment_status === 'paid') {
    redirect(await partnerServerHref(`${PARTNER_ORDERS_PATH}/${id}`))
  }

  const amountHint = quoteRemainingGross(
    roundQuoteMoney(loaded.quote.final_total_gross || loaded.quote.total_gross),
    roundQuoteMoney(loaded.quote.total_paid)
  )

  const companyLabel =
    (await resolvePartnerCompanyLabel(session.selectedTenantId)) ||
    'a kapcsolt cég'

  const customer = loaded.quote.customer
  const billingName =
    customer.billing_name?.trim() ||
    session.profile.billing_name?.trim() ||
    customer.name?.trim() ||
    session.name

  const billingLine =
    formatBillingLine({
      postal: customer.billing_postal_code ?? session.profile.billing_postal_code,
      city: customer.billing_city ?? session.profile.billing_city,
      street: customer.billing_street ?? session.profile.billing_street
    }) || null

  return (
    <PartnerTeyaCheckout
      quoteId={loaded.quote.id}
      quoteNumber={loaded.quote.quote_number}
      orderNumber={loaded.quote.order_number}
      projectName={loaded.quote.project_name}
      amountHintHuf={amountHint}
      companyLabel={companyLabel}
      paymentMethodName={loaded.quote.preferred_payment_method_name}
      billingName={billingName}
      billingLine={billingLine}
      partnerName={session.name}
    />
  )
}
