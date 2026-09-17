import type { Metadata } from 'next'

import {
  BelepokMonthKpis,
  BelepokTodayStrip
} from '@/components/footcounter/belepok-hero'
import { BelepokLiveIndicator } from '@/components/footcounter/belepok-live-indicator'
import { BelepokMonthChart } from '@/components/footcounter/belepok-month-chart'
import { BelepokMonthStepper } from '@/components/footcounter/belepok-month-stepper'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasFootcounter } from '@/lib/footcounter/entitlement'
import {
  getFootcounterLiveStatus,
  getFootcounterMonthIns,
  getFootcounterTodayGlance
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
  const [monthRes, prevRes, today, live] = await Promise.all([
    getFootcounterMonthIns(supabase, user.tenantId, year, month),
    prev.year >= 2026
      ? getFootcounterMonthIns(supabase, user.tenantId, prev.year, prev.month)
      : Promise.resolve(null),
    getFootcounterTodayGlance(supabase, user.tenantId),
    getFootcounterLiveStatus(supabase, user.tenantId)
  ])

  const glance = buildMonthGlance(
    monthRes.days,
    prevRes?.totalIn ?? null,
    monthRes.peakHour,
    monthRes.peakHourIn
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-h1 text-ink">Belépők</h1>
        <BelepokLiveIndicator
          status={live.status}
          lastSeenAt={live.lastSeenAt}
        />
      </div>

      <BelepokTodayStrip today={today} />

      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3">
          <BelepokMonthStepper year={year} month={month} />
        </div>
        <BelepokMonthKpis glance={glance} />
        <BelepokMonthChart
          year={year}
          month={month}
          days={monthRes.days}
        />
      </section>
    </div>
  )
}
