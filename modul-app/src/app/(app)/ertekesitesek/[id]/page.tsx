import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { SaleDetailClient } from '@/components/sales/sale-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { getSale } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) return { title: 'Értékesítés' }
  const supabase = await createClient()
  if (!supabase) return { title: 'Értékesítés' }
  const detail = await getSale(supabase, user.tenantId, id)
  return { title: detail?.sale_number ?? 'Értékesítés' }
}

export default async function ErtekesitesDetailPage({
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
    getSale(supabase, user.tenantId, id),
    listActivePaymentMethods(supabase, user.tenantId)
  ])
  if (!detail) notFound()

  return (
    <Suspense fallback={null}>
      <SaleDetailClient
        detail={detail}
        paymentMethods={paymentMethods}
        canWrite={canWrite}
      />
    </Suspense>
  )
}
