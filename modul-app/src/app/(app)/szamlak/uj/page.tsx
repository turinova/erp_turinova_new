import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualInvoiceClient } from '@/components/invoicing/manual-invoice-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import {
  getOrCreateInvoiceSettings,
  hasAgentKey
} from '@/lib/invoicing/settings'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Új számla' }

export default async function UjSzamlaPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [customers, settings] = await Promise.all([
    listCustomersForSelect(supabase, user.tenantId),
    getOrCreateInvoiceSettings(supabase, user.tenantId)
  ])

  return (
    <ManualInvoiceClient
      customers={customers}
      hasAgentKey={hasAgentKey(settings)}
      canWrite={canWrite}
      defaultSendEmail={settings.default_send_email}
    />
  )
}
