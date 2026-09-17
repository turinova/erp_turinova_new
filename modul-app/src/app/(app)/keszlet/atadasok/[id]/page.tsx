import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StockTransferDetailClient } from '@/components/stock-transfers/stock-transfer-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getStockTransfer } from '@/lib/stock-transfers/queries'
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
    return { title: 'Áttárolás' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Áttárolás' }
  const detail = await getStockTransfer(supabase, user.tenantId, id)
  return { title: detail?.transfer_number ?? 'Áttárolás' }
}

export default async function AtadasDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const supabase = await createClient()
  if (!supabase) notFound()

  const detail = await getStockTransfer(supabase, user.tenantId, id)
  if (!detail) notFound()

  return <StockTransferDetailClient detail={detail} />
}
