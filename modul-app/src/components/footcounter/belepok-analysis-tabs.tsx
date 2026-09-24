'use client'

import { useState } from 'react'

import { MonthDailyChart } from '@/components/footcounter/charts/month-daily-chart'
import { SeasonChart } from '@/components/footcounter/charts/season-chart'
import { WeekdayProfileChart } from '@/components/footcounter/charts/weekday-profile-chart'
import { BelepokMonthKpis } from '@/components/footcounter/belepok-hero'
import { BelepokMonthStepper } from '@/components/footcounter/belepok-month-stepper'
import type {
  FootcounterMonthDayBar,
  FootcounterSeasonBar,
  FootcounterWeekdayBar
} from '@/lib/footcounter/chart-types'
import type { FootcounterMonthGlance } from '@/lib/footcounter/summary'
import { cn } from '@/lib/utils'

type TabKey = 'month' | 'weekday' | 'season'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'month', label: 'Hónap' },
  { key: 'weekday', label: 'Hét napja' },
  { key: 'season', label: 'Szezon' }
]

export function BelepokAnalysisTabs({
  year,
  month,
  monthLabel,
  glance,
  monthDays,
  weekdayProfile,
  season
}: {
  year: number
  month: number
  monthLabel: string
  glance: FootcounterMonthGlance
  monthDays: FootcounterMonthDayBar[]
  weekdayProfile: FootcounterWeekdayBar[]
  season: FootcounterSeasonBar[]
}) {
  const [active, setActive] = useState<TabKey>('month')

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div
        role="tablist"
        aria-label="Belépő nézetek"
        className="mb-3 inline-flex gap-1 rounded-lg border border-border bg-subtle p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active === tab.key
                ? 'bg-ink text-white'
                : 'text-ink-secondary hover:bg-surface hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'month' ? (
        <div>
          <div className="mb-3">
            <BelepokMonthStepper year={year} month={month} />
          </div>
          <BelepokMonthKpis glance={glance} />
          <MonthDailyChart
            days={monthDays}
            avgIn={glance.avgPerActiveDay}
            ariaLabel={`${monthLabel} napi belépésszáma`}
          />
        </div>
      ) : null}

      {active === 'weekday' ? (
        <WeekdayProfileChart
          rows={weekdayProfile}
          caption={`Átlagos belépésszám naponta · ${monthLabel} · a zárva tartó napok nem számítanak bele.`}
        />
      ) : null}

      {active === 'season' ? (
        <SeasonChart
          months={season}
          caption={`Belépésszám hónaponként · a kiemelt hónap: ${monthLabel}.`}
        />
      ) : null}
    </section>
  )
}
