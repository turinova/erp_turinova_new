import type { Metadata } from 'next'

import { WebshopWithdrawalsClient } from '@/components/webshop/webshop-withdrawals-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { listAdminWithdrawals, type WithdrawalFilter } from '@/lib/webshop/withdrawals'

export const metadata: Metadata = { title: 'Elállások' }

type PageProps = { searchParams: Promise<{ szuro?: string; page?: string }> }

const FILTERS = new Set(['open', 'handled', 'all'])

export default async function WebshopElallasokPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filter = (sp.szuro && FILTERS.has(sp.szuro) ? sp.szuro : 'open') as WithdrawalFilter
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return <p className="text-body text-ink-secondary">Dev módban nincs tenant adatbázis.</p>
  }
  const supabase = await createClient()
  if (!supabase) return <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return <p className="text-body text-ink-secondary">Az Online bolt add-on nincs bekapcsolva.</p>
  }

  const { rows, total, openCount } = await listAdminWithdrawals(supabase, user.tenantId, { filter, page })
  return (
    <WebshopWithdrawalsClient
      rows={rows}
      total={total}
      openCount={openCount}
      filter={filter}
      page={page}
      canWrite={canWrite}
    />
  )
}
