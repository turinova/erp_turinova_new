import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PosClient } from '@/components/pos/pos-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActiveFeeTypeOptions } from '@/lib/fee-types/queries'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { getOrCreatePosSettings } from '@/lib/pos/settings'
import { toPublicPosConfig } from '@/lib/pos/settings-types'
import { listPosRegisters } from '@/lib/pos/shifts'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = { title: 'POS' }

export default async function PosPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [warehouses, customers, paymentMethods, feeTypes, registers, settings] =
    await Promise.all([
      listActiveWarehouses(supabase, user.tenantId),
      listCustomersForSelect(supabase, user.tenantId),
      listActivePaymentMethods(supabase, user.tenantId),
      listActiveFeeTypeOptions(supabase, user.tenantId),
      listPosRegisters(supabase, user.tenantId),
      getOrCreatePosSettings(supabase, user.tenantId).catch(() => null)
    ])

  return (
    <PosClient
      warehouses={warehouses}
      registers={registers}
      customers={customers}
      paymentMethods={paymentMethods}
      feeTypes={feeTypes}
      canWrite={canWrite}
      posConfig={toPublicPosConfig(settings)}
    />
  )
}
