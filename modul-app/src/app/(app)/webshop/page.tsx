import type { Metadata } from 'next'

import { type LaunchItem, WebshopOverviewClient } from '@/components/webshop/webshop-overview-client'
import { getSessionUser } from '@/lib/auth/session'
import { emailConfigured } from '@/lib/email/send'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { loadAdminLegal, openWithdrawalCount } from '@/lib/webshop/legal/admin'
import { listShopReadyLevels } from '@/lib/webshop/product-queries'
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

  const levels = await listShopReadyLevels(supabase, user.tenantId)
  const [stats, stockNotify, legal, openWithdrawals] = await Promise.all([
    getWebshopOverviewStats(supabase, user.tenantId, levels),
    listOpenStockNotifyRequests(supabase, user.tenantId),
    loadAdminLegal(supabase, user.tenantId),
    openWithdrawalCount(supabase, user.tenantId)
  ])

  const missingOn = (prefix: string) => legal.missing.filter((m) => m.href.startsWith(prefix))
  const launch: LaunchItem[] = [
    {
      label: 'Eladó adatai (cégnév, székhely, adószám, elérhetőség)',
      missing: missingOn('/webshop/jogi').map((m) => m.label),
      href: '/webshop/jogi#elado'
    },
    {
      label: 'Szállítási mód és díj',
      missing: missingOn('/webshop/beallitasok#szallitas').map((m) => m.label),
      href: '/webshop/beallitasok#szallitas'
    },
    {
      label: 'Fizetési mód',
      missing: missingOn('/webshop/beallitasok#fizetes').map((m) => m.label),
      href: '/webshop/beallitasok#fizetes'
    },
    {
      label: 'Legalább egy termék a boltban',
      missing: stats.sellableWeb > 0 ? [] : ['Nincs még termék a boltban'],
      href: '/webshop/katalogus'
    },
    {
      label: 'Elállás-visszaigazoló e-mail',
      missing: emailConfigured() ? [] : ['A platform e-mail küldése még nincs bekapcsolva — addig a vásárló a képernyőn kapja meg a visszaigazolást.'],
      href: null
    }
  ]

  return (
    <WebshopOverviewClient
      stats={stats}
      stockNotify={stockNotify}
      launch={launch}
      openWithdrawals={openWithdrawals}
    />
  )
}
