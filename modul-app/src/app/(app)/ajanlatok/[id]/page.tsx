import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { QuoteDetailClient } from '@/components/quotes/quote-detail-client'
import { QuoteDetailSkeleton } from '@/components/quotes/quote-detail-skeleton'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
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

  // Lean critical path: quote + company only.
  // Export / payment methods / machines → dialógus nyitáskor.
  const [quote, company] = await Promise.all([
    getQuoteDetail(supabase, user.tenantId, id).catch(() => null),
    getTenantCompany(supabase, user.tenantId).catch(() => null)
  ])

  if (!quote) notFound()

  return (
    <QuoteDetailClient
      quote={quote}
      company={company}
      canWrite={canWrite}
    />
  )
}
