import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualOrderDetailClient } from '@/components/manual-orders/manual-order-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getManualOrder } from '@/lib/manual-orders/queries'
import { getOrderShareLinkInfo } from '@/lib/order-status/links'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Kézi rendelés' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function KeziRendelesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()
  const supabase = await createClient()
  if (!supabase) notFound()

  const [order, suppliers, statusLink] = await Promise.all([
    getManualOrder(supabase, user.tenantId, id),
    listActiveSuppliersForSelect(supabase, user.tenantId),
    getOrderShareLinkInfo({ supabase, tenantId: user.tenantId, kind: 'manual', refId: id })
  ])
  if (!order) notFound()

  return (
    <ManualOrderDetailClient
      order={order}
      statusLink={statusLink}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
    />
  )
}
