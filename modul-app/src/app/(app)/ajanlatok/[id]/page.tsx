import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { QuoteDetailClient } from '@/components/quotes/quote-detail-client'
import { QuoteDetailSkeleton } from '@/components/quotes/quote-detail-skeleton'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import { listActiveFeeTypeOptions } from '@/lib/fee-types/queries'
import { listActiveAccessoryOptions } from '@/lib/accessories/queries'
import { listInvoicesForQuote } from '@/lib/invoicing/queries'
import { getInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import { getQuoteDetail } from '@/lib/quotes/queries'
import { quoteTabTitle } from '@/lib/seo/tab-titles'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Árajánlat' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Árajánlat' }
  const label = await quoteTabTitle(supabase, user.tenantId, id)
  return { title: label ?? 'Árajánlat' }
}

export default function AjanlatDetailPage({
  params
}: {
  params: Params
}) {
  return (
    <Suspense fallback={<QuoteDetailSkeleton />}>
      <QuoteDetailLoader params={params} />
    </Suspense>
  )
}

async function QuoteDetailLoader({ params }: { params: Params }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [
    quote,
    company,
    feeTypes,
    accessoryOptions,
    hasSmsAddon,
    invoices,
    settings
  ] = await Promise.all([
    getQuoteDetail(supabase, user.tenantId, id).catch(() => null),
    getTenantCompany(supabase, user.tenantId).catch(() => null),
    listActiveFeeTypeOptions(supabase, user.tenantId).catch(() => []),
    listActiveAccessoryOptions(supabase, user.tenantId).catch(() => []),
    tenantHasQuoteReadySms(supabase, user.tenantId).catch(() => false),
    listInvoicesForQuote(supabase, user.tenantId, id).catch(() => []),
    getInvoiceSettings(supabase, user.tenantId).catch(() => null)
  ])

  if (!quote) notFound()

  return (
    <QuoteDetailClient
      quote={quote}
      company={company}
      canWrite={canWrite}
      feeTypes={feeTypes}
      accessoryOptions={accessoryOptions}
      hasSmsAddon={hasSmsAddon}
      invoices={invoices}
      hasAgentKey={hasAgentKey(settings)}
    />
  )
}
