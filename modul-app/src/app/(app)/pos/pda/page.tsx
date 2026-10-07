import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'

import { PdaPosClient } from '@/components/pos/pda/pda-pos-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { PDA_POS_PAGE } from '@/lib/pos/pda-types'
import { tenantHasPdaPos } from '@/lib/pos/pda-entitlement'
import { tenantHasPos } from '@/lib/pos/entitlement'
import { getOrCreatePosSettings } from '@/lib/pos/settings'
import { toPublicPosConfig } from '@/lib/pos/settings-types'
import { listPosRegisters } from '@/lib/pos/shifts'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = {
  title: 'PDA POS',
  manifest: '/pda.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'PDA POS',
    statusBarStyle: 'default'
  },
  other: {
    'mobile-web-app-capable': 'yes'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#18181B'
}

export default async function PdaPosPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()
  if (!user.allowedPages.includes(PDA_POS_PAGE)) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [
    hasPda,
    hasPos,
    warehouses,
    paymentMethods,
    registers,
    settings,
    customers
  ] = await Promise.all([
    tenantHasPdaPos(supabase, user.tenantId),
    tenantHasPos(supabase, user.tenantId),
    listActiveWarehouses(supabase, user.tenantId),
    listActivePaymentMethods(supabase, user.tenantId),
    listPosRegisters(supabase, user.tenantId),
    getOrCreatePosSettings(supabase, user.tenantId).catch(() => null),
    listCustomersForSelect(supabase, user.tenantId).catch(() => [])
  ])

  if (!hasPda || !hasPos) notFound()

  return (
    <PdaPosClient
      warehouses={warehouses}
      registers={registers}
      paymentMethods={paymentMethods}
      customers={customers}
      canWrite={canWrite}
      posConfig={toPublicPosConfig(settings)}
    />
  )
}
