'use client'

import { useState } from 'react'

import {
  AppFrame,
  FootcounterMonthChart,
  SeasonChart,
  WeekdayProfileChart
} from '@/components/marketing/beleposzamlalo-mockups'
import { BELEPOSZAMLALO_DEMO } from '@/lib/marketing/beleposzamlalo'
import { DEMO_MONTH } from '@/lib/marketing/beleposzamlalo-demo-data'
import { cn } from '@/lib/utils'

type TabKey = 'month' | 'weekday' | 'season'

const TABS: Array<{ key: TabKey; label: string; path: string }> = [
  {
    key: 'month',
    label: BELEPOSZAMLALO_DEMO.tabs.month.label,
    path: `optinova.hu / belépők / ${DEMO_MONTH.label}`
  },
  {
    key: 'weekday',
    label: BELEPOSZAMLALO_DEMO.tabs.weekday.label,
    path: 'optinova.hu / belépők / hét napja'
  },
  {
    key: 'season',
    label: BELEPOSZAMLALO_DEMO.tabs.season.label,
    path: 'optinova.hu / belépők / szezon'
  }
]

export function FootcounterDemoTabs({ className }: { className?: string }) {
  const [active, setActive] = useState<TabKey>('month')
  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0]!

  return (
    <div className={cn('min-w-0', className)}>
      <div
        role="tablist"
        aria-label="Belépő nézetek"
        className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1"
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
                : 'text-ink-secondary hover:bg-subtle hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AppFrame path={activeTab.path} className="mt-3">
        {active === 'month' ? <FootcounterMonthChart /> : null}
        {active === 'weekday' ? <WeekdayProfileChart /> : null}
        {active === 'season' ? <SeasonChart /> : null}
      </AppFrame>

      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
        {BELEPOSZAMLALO_DEMO.tabs[active].caption}
      </p>
    </div>
  )
}
