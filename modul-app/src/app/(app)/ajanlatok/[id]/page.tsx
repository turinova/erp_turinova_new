import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { QuoteDetailClient } from '@/components/quotes/quote-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { listActiveProductionMachines } from '@/lib/production-machines/queries'
import { loadQuoteExportData } from '@/lib/quotes/export/load-panels'
import { getQuoteDetail } from '@/lib/quotes/queries'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Árajánlat · ${id.slice(0, 8)}` }
}

export default async function AjanlatDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [quote, company, exportLoaded, paymentMethods, productionMachines] =
    await Promise.all([
      getQuoteDetail(supabase, user.tenantId, id).catch(() => null),
      getTenantCompany(supabase, user.tenantId).catch(() => null),
      loadQuoteExportData(supabase, user.tenantId, id).catch(() => null),
      listActivePaymentMethods(supabase, user.tenantId).catch(() => []),
      listActiveProductionMachines(supabase, user.tenantId).catch(() => [])
    ])

  if (!quote) notFound()

  return (
    <QuoteDetailClient
      quote={quote}
      company={company}
      canWrite={canWrite}
      exportTargets={exportLoaded?.targets ?? []}
      paymentMethods={paymentMethods}
      productionMachines={productionMachines}
    />
  )
}
