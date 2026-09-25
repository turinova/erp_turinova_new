import type { Metadata } from 'next'

import { WebshopOverviewClient } from '@/components/webshop/webshop-overview-client'
import { listAccessories } from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import {
  getWebshopOverviewStats,
  listOpenStockNotifyRequests
} from '@/lib/webshop/queries'

export const metadata: Metadata = { title: 'Webshop' }

export default async function WebshopPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return (
      <p className="text-body text-ink-secondary">
        Dev módban nincs tenant adatbázis.
      </p>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>
    )
  }

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return (
      <div className="space-y-2">
        <h1 className="text-h1 text-ink">Webshop</h1>
        <p
          className="max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary"
          role="status"
        >
          Az Online bolt add-on nincs bekapcsolva ennél a cégnél. Platform admin
          tudja aktiválni.
        </p>
      </div>
    )
  }

  const accessories = await listAccessories(supabase, user.tenantId)
  const [stats, stockNotify] = await Promise.all([
    getWebshopOverviewStats(
      supabase,
      user.tenantId,
      accessories.map((a) => ({
        sellable_web: a.sellable_web,
        shop_ready_level: a.shop_ready_level
      }))
    ),
    listOpenStockNotifyRequests(supabase, user.tenantId)
  ])

  return <WebshopOverviewClient stats={stats} stockNotify={stockNotify} />
}
