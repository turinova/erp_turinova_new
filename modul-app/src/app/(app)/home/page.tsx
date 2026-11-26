import type { Metadata } from 'next'

import { HomeChartsDashboard } from '@/components/home/home-charts-dashboard'
import { HomeKpiStrip } from '@/components/home/home-kpi-strip'
import { KioskInboxCard } from '@/components/home/kiosk-inbox-card'
import { PartnerPortalInboxCard } from '@/components/home/partner-portal-inbox-card'
import { HOME_QUICK_LINKS, HomeQuickLinks } from '@/components/home/home-quick-links'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import { getFootcounterHomeSlim } from '@/lib/footcounter/queries'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'
import { getHomePageData } from '@/lib/home/chart-queries'
import { getHomeKpiBundle, type HomeKpiBundle } from '@/lib/home/kpi-queries'
import {
  getHomeKioskInbox,
  type HomeKioskInboxRow
} from '@/lib/home/kiosk-inbox'
import {
  getHomePartnerPortalInbox,
  tenantHasPartnerOrders,
  type HomePartnerPortalInboxRow
} from '@/lib/home/partner-portal-inbox'
import { tenantHasJelenlet } from '@/lib/jelenlet/entitlement'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { pathIsAllowed } from '@/lib/permissions/pages'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function HomePage() {
  const user = await getSessionUser()

  let data: Awaited<ReturnType<typeof getHomePageData>> | null = null
  let kpis: HomeKpiBundle | null = null
  let footcounter: FootcounterHomeSlim | null = null
  let partnerInbox: HomePartnerPortalInboxRow[] = []
  let kioskInbox: { rows: HomeKioskInboxRow[]; total: number } = {
    rows: [],
    total: 0
  }
  let showLapszabaszatCharts = false
  let hasLapszab = false
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [hasFootcounter, hasLapszabaszat, hasJelenlet, hasPartnerOrders] =
          await Promise.all([
            tenantHasFootcounter(supabase, user.tenantId),
            tenantHasLapszabaszat(supabase, user.tenantId),
            tenantHasJelenlet(supabase, user.tenantId),
            tenantHasPartnerOrders(supabase, user.tenantId)
          ])
        showLapszabaszatCharts = hasLapszabaszat
        hasLapszab = hasLapszabaszat

        kpis = await getHomeKpiBundle(supabase, user.tenantId, {
          includeJelenlet: hasJelenlet,
          includeLapszabaszat: hasLapszabaszat
        })

        try {
          data = await getHomePageData(supabase, user.tenantId, 0)
        } catch (chartErr) {
          console.error('home charts', chartErr)
        }

        if (hasFootcounter) {
          footcounter = await getFootcounterHomeSlim(supabase, user.tenantId)
        }

        const [partnerRows, kioskRows] = await Promise.all([
          hasPartnerOrders
            ? getHomePartnerPortalInbox(supabase, user.tenantId, 10)
            : Promise.resolve([] as HomePartnerPortalInboxRow[]),
          hasLapszabaszat
            ? getHomeKioskInbox(supabase, user.tenantId, 10)
            : Promise.resolve(kioskInbox)
        ])
        partnerInbox = partnerRows
        kioskInbox = kioskRows
      } catch (e) {
        loadError =
          e instanceof Error ? e.message : 'Nem sikerült betölteni az adatokat.'
      }
    }
  }

  return (
    <div>
      <h1 className="sr-only">Kezdőlap</h1>
      <HomeQuickLinks
        links={HOME_QUICK_LINKS.filter(
          (l) =>
            Boolean(user && pathIsAllowed(l.navPath, user.allowedPages)) &&
            (l.navPath !== '/opti' || hasLapszab || Boolean(user?.isDevSession))
        )}
      />

      {user?.isDevSession ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-3 py-4 text-body text-ink-secondary">
          Dev bypass — nincs tenant adat a chartokhoz.
        </p>
      ) : null}

      {loadError ? (
        <p className="text-body text-danger-ink" role="alert">
          {loadError}
        </p>
      ) : null}

      {kpis ? <HomeKpiStrip data={kpis} /> : null}

      <KioskInboxCard rows={kioskInbox.rows} total={kioskInbox.total} />

      <PartnerPortalInboxCard rows={partnerInbox} />

      {data ? (
        <HomeChartsDashboard
          backlog={data.backlog}
          initialCutting={data.weeklyCutting}
          initialEdge={data.weeklyEdge}
          yearlyAvg={data.yearlyAvg}
          footcounter={footcounter}
          showLapszabaszatCharts={showLapszabaszatCharts}
        />
      ) : null}

      {!data && !kpis && !loadError && !user?.isDevSession ? (
        <p className="text-body text-ink-secondary">Nincs betölthető adat.</p>
      ) : null}
    </div>
  )
}
