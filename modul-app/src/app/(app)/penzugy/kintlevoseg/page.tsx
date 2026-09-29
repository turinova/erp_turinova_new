import type { Metadata } from 'next'

import { ArListClient } from '@/components/finance/ar-list-client'
import { getSessionUser } from '@/lib/auth/session'
import { listAccountsReceivable } from '@/lib/finance/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kintlévőség'
}

export default async function KintlevosegPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kintlévőség</h1>
        <p className="text-body text-ink-secondary">Nincs aktív munkamenet.</p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Kintlévőség</h1>
        <p className="text-body text-danger-ink">Nincs adatbázis kapcsolat.</p>
      </div>
    )
  }

  const rows = await listAccountsReceivable(supabase, user.tenantId)
  const canWrite = Boolean(user.role && user.role !== 'viewer')

  return <ArListClient rows={rows} canWrite={canWrite} />
}
