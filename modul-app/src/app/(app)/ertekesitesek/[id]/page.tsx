import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SaleDetailClient } from '@/components/sales/sale-detail-client'
import { getSessionUser } from '@/lib/auth/session'
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

  const supabase = await createClient()
  if (!supabase) notFound()

  const detail = await getSale(supabase, user.tenantId, id)
  if (!detail) notFound()

  return <SaleDetailClient detail={detail} />
}
