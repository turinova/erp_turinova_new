import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { SalesQuoteEditClient } from '@/components/sales-quotes/sales-quote-edit-client'
import { getSessionUser } from '@/lib/auth/session'
import { listActiveFeeTypeOptions } from '@/lib/fee-types/queries'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { getSalesQuote } from '@/lib/sales-quotes/queries'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Ajánlat szerkesztése · ${id.slice(0, 8)}` }
}

export default async function ArajnlatSzerkesztPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  if (!canWrite) {
    redirect(`/ertekesitesek/arajanlatok/${id}`)
  }

  const supabase = await createClient()
  if (!supabase) notFound()

  const [detail, feeTypes, hasLapszabaszat] = await Promise.all([
    getSalesQuote(supabase, user.tenantId, id),
    listActiveFeeTypeOptions(supabase, user.tenantId),
    tenantHasLapszabaszat(supabase, user.tenantId)
  ])
  if (!detail) notFound()
  if (detail.status !== 'draft') {
    redirect(`/ertekesitesek/arajanlatok/${id}`)
  }

  return (
    <SalesQuoteEditClient
      detail={detail}
      feeTypes={feeTypes}
      canWrite={canWrite}
      hasLapszabaszat={hasLapszabaszat}
    />
  )
}
