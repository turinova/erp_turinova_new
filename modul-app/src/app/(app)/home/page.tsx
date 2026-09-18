import type { Metadata } from 'next'

import { HomeChartsDashboard } from '@/components/home/home-charts-dashboard'
import { HomeKpiStrip } from '@/components/home/home-kpi-strip'
import { PageHeader } from '@/components/patterns/page-header'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import { getFootcounterHomeSlim } from '@/lib/footcounter/queries'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'
import { getHomePageData } from '@/lib/home/chart-queries'
import { getHomeKpiBundle, type HomeKpiBundle } from '@/lib/home/kpi-queries'
import { tenantHasJelenlet } from '@/lib/jelenlet/entitlement'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { findNavLinkByPath } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kezdőlap'
}

export default async function HomePage() {
  const user = await getSessionUser()
  const nav = findNavLinkByPath('/home')

  const dateLabel = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'full'
  }).format(new Date())

  let data: Awaited<ReturnType<typeof getHomePageData>> | null = null
  let kpis: HomeKpiBundle | null = null
  let footcounter: FootcounterHomeSlim | null = null
  let showLapszabaszatCharts = false
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [hasFootcounter, hasLapszabaszat, hasJelenlet] =
          await Promise.all([
            tenantHasFootcounter(supabase, user.tenantId),
            tenantHasLapszabaszat(supabase, user.tenantId),
            tenantHasJelenlet(supabase, user.tenantId)
          ])
        showLapszabaszatCharts = hasLapszabaszat

        kpis = await getHomeKpiBundle(supabase, user.tenantId, {
          includeJelenlet: hasJelenlet
        })

        try {
          data = await getHomePageData(supabase, user.tenantId, 0)
        } catch (chartErr) {
          console.error('home charts', chartErr)
        }

        if (hasFootcounter) {
          footcounter = await getFootcounterHomeSlim(supabase, user.tenantId)
        }
      } catch (e) {
        loadError =
          e instanceof Error ? e.message : 'Nem sikerült betölteni az adatokat.'
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Kezdőlap"
        icon={nav?.icon}
        accent={nav?.accent}
        description={`${user?.companyName ?? 'Cég'} · ${dateLabel}`}
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

      {data ? (
        <HomeChartsDashboard
          backlog={data.backlog}
          initialCutting={data.weeklyCutting}
          initialEdge={data.weeklyEdge}
          yearlyAvg={data.yearlyAvg}
          orders={data.orders}
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
