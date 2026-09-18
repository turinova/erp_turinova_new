import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PosShiftDetailClient } from '@/components/pos/pos-shift-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getPosShift } from '@/lib/pos/shifts'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Műszak · ${id.slice(0, 8)}` }
}

export default async function MuszakDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const supabase = await createClient()
  if (!supabase) notFound()

  const detail = await getPosShift(supabase, user.tenantId, id)
  if (!detail) notFound()

  return <PosShiftDetailClient detail={detail} />
}
