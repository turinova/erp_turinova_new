import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SalesQuoteDetailClient } from '@/components/sales-quotes/sales-quote-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { getSalesQuote } from '@/lib/sales-quotes/queries'
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

export default async function ArajnlatDetailPage({
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

  const [detail, paymentMethods] = await Promise.all([
    getSalesQuote(supabase, user.tenantId, id),
    listActivePaymentMethods(supabase, user.tenantId)
  ])
  if (!detail) notFound()

  return (
    <SalesQuoteDetailClient
      detail={detail}
      paymentMethods={paymentMethods}
      canWrite={canWrite}
    />
  )
}
