import type { ReactNode } from 'react'
import { Home, ShoppingCart, Users } from 'lucide-react'

import { BelepokLiveIndicator } from '@/components/footcounter/belepok-live-indicator'
import { MarketingAppChrome } from '@/components/marketing/marketing-app-chrome'
import { MarketingSalesSpark } from '@/components/marketing/marketing-home-static-charts'
import { formatHoursLabel } from '@/lib/footcounter/open-hours'
import { HOME_DASHBOARD_FIXTURE } from '@/lib/marketing/home-dashboard-fixture'
import { getNavAccentClasses } from '@/lib/nav-accent'
import { formatMoneyFt } from '@/lib/sales/parse'
import { cn } from '@/lib/utils'

/**
 * Landing hero home mock — chrome + KPI-k a Belépők napi eloszlásig.
 * Nincs scroll; alatta a parent fade vág. Nincs DB / week-fetch.
 */

function FakeLink({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('text-hint text-ink-secondary', className)}>
      {children}
    </span>
  )
}

function MetricCell({
  label,
  value,
  hint,
  emphasize
}: {
  label: string
  value: string
  hint?: string
  emphasize?: 'danger' | 'warning' | 'success' | null
}) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="truncate text-hint text-ink-secondary">{label}</p>
      <p
        className={cn(
          'mt-1 text-[1.5rem] font-semibold tabular-nums leading-none tracking-tight',
          emphasize === 'danger' && 'text-danger-ink',
          emphasize === 'warning' && 'text-warning-ink',
          emphasize === 'success' && 'text-success-ink',
          !emphasize && 'text-ink'
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-hint text-ink-muted">{hint}</p>
      ) : (
        <p className="mt-1 text-hint text-transparent select-none" aria-hidden>
          .
        </p>
      )}
    </div>
  )
}

function heatOpacity(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0.06
  const t = Math.min(1, value / max)
  return 0.12 + t * 0.78
}

export function HomeDashboardMockup({ className }: { className?: string }) {
  const f = HOME_DASHBOARD_FIXTURE
  const sales = f.kpis.sales
  const jelenlet = f.kpis.jelenlet!
  const tones = getNavAccentClasses('slate')
  const dateLabel = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'full'
  }).format(new Date())

  const hourStart = f.footcounter.openHours.weekdayOpen
  const hourEnd = f.footcounter.openHours.weekdayClose
  const hoursLabel = formatHoursLabel(hourStart, hourEnd)
  const hourlySlice = f.footcounter.hourlyIn.slice(hourStart, hourEnd + 1)
  const hourlyMax = Math.max(1, ...hourlySlice)
  const peakIdx = hourlySlice.reduce(
    (best, v, i) => (v > hourlySlice[best]! ? i : best),
    0
  )
  const peakHour = hourStart + peakIdx
  const peakCount = hourlySlice[peakIdx] ?? 0
  const netInside = Math.max(0, f.footcounter.todayIn - f.footcounter.todayOut)
  const sparkDays = sales.last7Days.map((d) => ({ ...d }))

  return (
    <MarketingAppChrome
      className={className}
      companyName={f.companyName}
      roleLabel="Tulajdonos"
      userName="Kovács Anna"
      initials="KA"
    >
      <div className="pointer-events-none select-none" aria-hidden>
        <div className="mb-4 space-y-0.5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md',
                tones.soft,
                tones.icon
              )}
            >
              <Home className="size-4" />
            </span>
            <h2 className="text-h1 text-ink">Kezdőlap</h2>
          </div>
          <p className="max-w-2xl pl-[42px] text-body text-ink-secondary">
            {f.companyName} · {dateLabel}
          </p>
          <div
            className={cn('ml-[42px] mt-2 h-0.5 w-12 rounded-full', tones.bar)}
            aria-hidden
          />
        </div>

        <div className="mb-5 space-y-4">
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 px-0.5">
              <ShoppingCart className="size-3.5 text-ink-muted" />
              <h3 className="text-body font-semibold text-ink">Értékesítés</h3>
              <FakeLink className="ml-auto">Összes →</FakeLink>
            </div>
            <div className="rounded-md border border-border bg-surface">
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                <div className="col-span-2 px-3 py-3 sm:col-span-3 lg:col-span-2">
                  <p className="text-hint text-ink-secondary">Mai forgalom</p>
                  <p className="mt-1 text-[1.5rem] font-semibold tabular-nums leading-none tracking-tight text-ink">
                    {formatMoneyFt(sales.todayGross)} Ft
                  </p>
                  <p className="mt-1 text-hint text-ink-muted">
                    {sales.todaySaleCount} eladás · 7 nap
                  </p>
                  <div className="mt-2 pointer-events-auto">
                    <MarketingSalesSpark data={sparkDays} />
                  </div>
                </div>
                <MetricCell
                  label="Nyitott ajánlat"
                  value={String(sales.openQuoteCount)}
                  emphasize="warning"
                />
                <MetricCell
                  label="Lejáró ajánlat"
                  value={String(sales.expiringQuoteCount)}
                  hint="Ma / lejárt"
                  emphasize="danger"
                />
                <MetricCell
                  label="Beszerzés"
                  value={String(sales.openPurchaseOrderCount)}
                  hint={`${sales.overduePurchaseOrderCount} késik`}
                  emphasize="danger"
                />
              </div>
            </div>
          </section>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-0.5">
              <Users className="size-3.5 text-ink-muted" />
              <span className="text-hint text-ink-secondary">
                Ma · {jelenlet.present}/{jelenlet.expectedToday} bent
              </span>
            </div>
            <section className="rounded-md border border-border bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <h3 className="text-body font-semibold text-ink">Jelenlét</h3>
                <FakeLink>Naptár →</FakeLink>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                <MetricCell
                  label="Bent"
                  value={`${jelenlet.present}/${jelenlet.expectedToday}`}
                  hint="Ma a cégnél"
                  emphasize="success"
                />
                <MetricCell
                  label="Nincs itt"
                  value={String(jelenlet.late)}
                  hint="Elvárt, nincs érkezés"
                  emphasize="danger"
                />
                <MetricCell
                  label="Szabadság"
                  value={String(jelenlet.vacation)}
                  hint={jelenlet.awayNames.join(', ')}
                />
                <MetricCell
                  label="Beteg"
                  value={String(jelenlet.sick)}
                  emphasize="danger"
                />
                <MetricCell
                  label="Hiányzó nap"
                  value={String(jelenlet.missingDayCount)}
                  emphasize="warning"
                />
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-2">
          <section className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <h3 className="text-body font-semibold text-ink">Belépők</h3>
              <FakeLink>Részletek →</FakeLink>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
              <MetricCell
                label="Mai belépő"
                value={f.footcounter.todayIn.toLocaleString('hu-HU')}
                emphasize="success"
              />
              <MetricCell
                label="Mai kilépő"
                value={f.footcounter.todayOut.toLocaleString('hu-HU')}
              />
              <MetricCell
                label="Csúcs óra"
                value={`${String(peakHour).padStart(2, '0')}:00`}
                hint={`${peakCount} belépő`}
              />
              <MetricCell
                label="Nettó bent"
                value={String(netInside)}
                hint="Élő eszköz"
                emphasize="success"
              />
            </div>
          </section>
          <div className="rounded-md border border-border bg-surface px-3 py-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-hint text-ink-secondary">
                Napi eloszlás ({hoursLabel})
              </p>
              <BelepokLiveIndicator
                status={f.footcounter.liveStatus}
                lastSeenAt={f.footcounter.deviceLastSeen}
              />
            </div>
            <div className="flex gap-0.5 overflow-hidden rounded-sm">
              {hourlySlice.map((v, i) => {
                const hour = hourStart + i
                return (
                  <div
                    key={hour}
                    className={cn(
                      'h-[22px] flex-1 rounded-[3px]',
                      hour === peakHour && 'ring-1 ring-ink/40'
                    )}
                    style={{
                      backgroundColor: `rgba(24, 24, 27, ${heatOpacity(v, hourlyMax)})`
                    }}
                  />
                )
              })}
            </div>
            <div className="mt-0.5 flex gap-0.5">
              {hourlySlice.map((_, i) => {
                const hour = hourStart + i
                const show =
                  hour === hourStart || hour === 12 || hour === hourEnd
                return (
                  <div key={hour} className="flex-1 text-center">
                    {show ? (
                      <span className="text-[10px] tabular-nums text-ink-muted">
                        {hour}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-right">
              <FakeLink>Teljes napló →</FakeLink>
            </p>
          </div>
        </div>
      </div>
    </MarketingAppChrome>
  )
}
