import type { Metadata } from 'next'

import { BelepokAnalysisTabs } from '@/components/footcounter/belepok-analysis-tabs'
import { BelepokLiveIndicator } from '@/components/footcounter/belepok-live-indicator'
import { BelepokTodayPanel } from '@/components/footcounter/belepok-today-panel'
import { WeekHourHeatmap } from '@/components/footcounter/charts/week-hour-heatmap'
import { getSessionUser } from '@/lib/auth/session'
import { MONTH_SHORT_HU } from '@/lib/footcounter/chart-tokens'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import {
  getFootcounterDashboard,
  getFootcounterLiveStatus,
  getFootcounterMonthIns
} from '@/lib/footcounter/queries'
import { buildMonthGlance } from '@/lib/footcounter/summary'
import { FOOTCOUNTER_PAGE } from '@/lib/footcounter/types'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Belépők'
}

type SearchParams = Promise<{ year?: string; month?: string }>

function budapestNowParts() {
  const now = new Date()
  const year = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric'
    }).format(now)
  )
  const month = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      month: 'numeric'
    }).format(now)
  )
  return { year, month }
}

function parseMonthParams(
  rawYear: string | undefined,
  rawMonth: string | undefined
): { year: number; month: number } {
  const current = budapestNowParts()
  let year = Number(rawYear)
  let month = Number(rawMonth)

  if (!Number.isInteger(year) || year < 2026 || year > current.year + 1) {
    year = current.year
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    month = current.month
  }

  if (year < 2026 || (year === 2026 && month < 1)) {
    return { year: 2026, month: 1 }
  }
  if (
    year > current.year ||
    (year === current.year && month > current.month)
  ) {
    return current
  }

  return { year, month }
}

function prevYearMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export default async function BelepokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const { year, month } = parseMonthParams(params.year, params.month)
  const user = await getSessionUser()

  if (!user?.tenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <p className="text-body text-ink-secondary">Nincs aktív céged.</p>
      </div>
    )
  }

  if (!user.allowedPages.includes(FOOTCOUNTER_PAGE)) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <p className="text-body text-danger-ink" role="alert">
          Nincs jogosultságod ehhez az oldalhoz.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <p className="text-body text-danger-ink" role="alert">
          Az adatbázis kapcsolat nem elérhető.
        </p>
      </div>
    )
  }

  const entitled = await tenantHasFootcounter(supabase, user.tenantId)
  if (!entitled && !user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <p className="max-w-xl text-body text-ink-secondary">
          A Belépők add-on nincs bekapcsolva ennél a cégnél. Platform admin
          tudja aktiválni.
        </p>
      </div>
    )
  }

  const prev = prevYearMonth(year, month)
  const [dashboard, prevRes, live] = await Promise.all([
    getFootcounterDashboard(supabase, user.tenantId, year, month),
    prev.year >= 2026
      ? getFootcounterMonthIns(supabase, user.tenantId, prev.year, prev.month)
      : Promise.resolve(null),
    getFootcounterLiveStatus(supabase, user.tenantId)
  ])

  const glance = buildMonthGlance(
    dashboard.monthDays.map((d) => ({ day: d.day, count: d.inCount })),
    prevRes?.totalIn ?? null,
    dashboard.monthPeakHour,
    dashboard.monthPeakHourIn
  )

  const monthLabel = `${year}. ${MONTH_SHORT_HU[month - 1]}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <BelepokLiveIndicator
          status={live.status}
          lastSeenAt={live.lastSeenAt}
        />
      </div>

      <BelepokTodayPanel data={dashboard.today} />

      <BelepokAnalysisTabs
        year={year}
        month={month}
        monthLabel={monthLabel}
        glance={glance}
        monthDays={dashboard.monthDays}
        weekdayProfile={dashboard.weekdayProfile}
        season={dashboard.season}
      />

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3">
          <h2 className="text-body font-semibold text-ink">
            Hét napja × óra
          </h2>
          <p className="text-hint text-ink-secondary">
            Átlagos belépésszám óránként · {monthLabel}
          </p>
        </div>
        <WeekHourHeatmap rows={dashboard.heatmap} />
      </section>
    </div>
  )
}
