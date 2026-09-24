import { CloudRain, Wind } from 'lucide-react'

import { SeasonChart as SharedSeasonChart } from '@/components/footcounter/charts/season-chart'
import { TodayHourlyChart as SharedTodayHourlyChart } from '@/components/footcounter/charts/today-hourly-chart'
import { WeekdayProfileChart as SharedWeekdayProfileChart } from '@/components/footcounter/charts/weekday-profile-chart'
import { WeekHourHeatmap as SharedWeekHourHeatmap } from '@/components/footcounter/charts/week-hour-heatmap'
import {
  DEMO_DAYS,
  DEMO_MONTH,
  formatCount,
  formatSignedPct,
  HEATMAP_PEAK,
  HEATMAP_ROWS,
  HOUR_LABELS,
  MONTH_AVG_IN,
  MONTH_MAX_IN,
  MONTH_TOTAL_IN,
  MOM_CHANGE_PCT,
  MOM_PER_DAY_CHANGE_PCT,
  OPEN_DAYS,
  PEAK_DAY,
  PREV_MONTH,
  SEASON_BEST,
  SEASON_MONTHS,
  SEASON_WORST,
  TODAY_PEAK_HOUR,
  TODAY_WEEKDAY_AVG,
  WEATHER_BUCKETS,
  WEEKDAY_PROFILE,
  type TodayHour
} from '@/lib/marketing/beleposzamlalo-demo-data'
import { cn } from '@/lib/utils'

/**
 * Belépőszámláló marketing chartok — shared footcounter chart primitives +
 * demo adat. A szezon / hét / heatmap / mai órás chart a termék `/belepok`
 * oldallal közös komponenst használ (vizuális 1:1).
 */
const CHART = {
  /** Charcoal skála — `docs/02` semleges + primary tokenek. */
  strong: '#18181b',
  mid: '#52525b',
  soft: '#a1a1aa',
  track: '#eeeff2',
  closed: '#d4d4d8',
  rain: '#93a4c4',
  wind: '#b6bcc6'
} as const

/* ------------------------------------------------------------------ keret */

export function AppFrame({
  path,
  children,
  className,
  badge = 'Mintaadat'
}: {
  path: string
  children: React.ReactNode
  className?: string
  badge?: string | null
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-elev1',
        className
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-subtle px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
          <span className="size-2 rounded-full bg-border-strong" />
        </span>
        <span className="truncate rounded bg-surface px-2 py-0.5 text-[11px] text-ink-muted">
          {path}
        </span>
        {badge ? (
          <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  )
}

function CardTitle({
  title,
  sub,
  right
}: {
  title: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        {sub ? (
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{sub}</p>
        ) : null}
      </div>
      {right}
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  strong
}: {
  label: string
  value: string
  sub?: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        strong ? 'border-border-strong bg-subtle' : 'border-border bg-surface'
      )}
    >
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-[22px] font-semibold leading-none tabular-nums text-ink">
        {value}
      </p>
      {sub ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink-secondary">
          {sub}
        </p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------- ma, órás */

/**
 * Mai órás oszlopdiagram. A futó óra csíkozott, a még hátralévő óra
 * szaggatott helyőrző — ez adja az „éppen most számol" érzetet.
 */
export function TodayHourlyChart({
  hourly,
  className
}: {
  hourly: TodayHour[]
  className?: string
}) {
  return (
    <SharedTodayHourlyChart
      hourly={hourly}
      peakHour={TODAY_PEAK_HOUR.hour}
      hourLabels={HOUR_LABELS}
      className={className}
    />
  )
}

/* ------------------------------------------------------- havi napi chart */

const WEATHER_ICON = {
  rain: CloudRain,
  wind: Wind
} as const

export function FootcounterMonthChart({
  className
}: {
  className?: string
}) {
  const avgPct = (MONTH_AVG_IN / MONTH_MAX_IN) * 100

  return (
    <div className={cn('min-w-0', className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="Belépések összesen"
          value={formatCount(MONTH_TOTAL_IN)}
          sub={`${OPEN_DAYS.length} nyitvatartási nap`}
          strong
        />
        <Kpi
          label="Napi átlag"
          value={formatCount(MONTH_AVG_IN)}
          sub={`${PREV_MONTH.label}: ${formatCount(
            Math.round(PREV_MONTH.totalIn / PREV_MONTH.openDays)
          )}`}
        />
        <Kpi
          label="Csúcsnap"
          value={`${PEAK_DAY.day}.`}
          sub={`${formatCount(PEAK_DAY.inCount)} belépés`}
        />
        <Kpi
          label="Előző hónaphoz"
          value={formatSignedPct(MOM_CHANGE_PCT)}
          sub={`Napi átlagban ${formatSignedPct(MOM_PER_DAY_CHANGE_PCT)}`}
        />
      </div>

      <div
        className="mt-4 overflow-x-auto"
        role="img"
        aria-label={`${DEMO_MONTH.label} napi belépésszáma. Összesen ${MONTH_TOTAL_IN} belépés ${OPEN_DAYS.length} nyitvatartási napon, napi átlag ${MONTH_AVG_IN}. A legerősebb nap a hónap ${PEAK_DAY.day}-e volt ${PEAK_DAY.inCount} belépéssel. A vasárnapok zárva.`}
      >
        <div className="min-w-[520px]">
          <div className="relative flex h-[188px] items-end gap-[3px]">
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
              style={{ bottom: `${avgPct}%` }}
            >
              <span className="absolute -top-[15px] right-0 rounded bg-surface px-1 text-[10px] font-medium tabular-nums text-ink-secondary">
                átlag {MONTH_AVG_IN}
              </span>
            </div>

            {DEMO_DAYS.map((d) => {
              const pct = (d.inCount / MONTH_MAX_IN) * 100
              if (d.closed) {
                return (
                  <div
                    key={d.day}
                    className="flex h-full min-w-0 flex-1 items-end justify-center"
                  >
                    <div className="h-[3px] w-full rounded-sm bg-border" />
                  </div>
                )
              }
              return (
                <div
                  key={d.day}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                >
                  {d.campaign ? (
                    <span className="mb-1 text-center text-[10px] font-semibold tabular-nums text-ink">
                      {d.inCount}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'w-full rounded-t-sm',
                      d.campaign && 'ring-2 ring-border-strong'
                    )}
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      backgroundColor: d.campaign
                        ? CHART.strong
                        : d.weather === 'rain'
                          ? CHART.rain
                          : d.weather === 'wind'
                            ? CHART.wind
                            : CHART.mid
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-1 flex gap-[3px]">
            {DEMO_DAYS.map((d) => {
              const Icon =
                d.weather === 'rain' || d.weather === 'wind'
                  ? WEATHER_ICON[d.weather]
                  : null
              return (
                <div
                  key={d.day}
                  className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                >
                  <span className="flex h-3 items-center justify-center">
                    {Icon ? (
                      <Icon
                        className="size-3 text-ink-muted"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'text-[9.5px] tabular-nums',
                      d.day % 5 === 0 || d.day === 1
                        ? 'text-ink-muted'
                        : 'text-transparent'
                    )}
                  >
                    {d.day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ink" aria-hidden />
          Akciós nap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CloudRain className="size-3 text-ink-muted" aria-hidden />
          Esős nap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wind className="size-3 text-ink-muted" aria-hidden />
          Szeles nap
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-3 rounded-sm bg-border" aria-hidden />
          Zárva
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- hét × óra mátrix */

export function WeekHourHeatmap({ className }: { className?: string }) {
  return (
    <SharedWeekHourHeatmap
      rows={HEATMAP_ROWS}
      hourLabels={HOUR_LABELS}
      className={className}
    />
  )
}

/* ----------------------------------------------------------- hét napja */

export function WeekdayProfileChart({ className }: { className?: string }) {
  return (
    <SharedWeekdayProfileChart
      rows={WEEKDAY_PROFILE}
      caption={`Átlagos belépésszám naponta · ${DEMO_MONTH.label} · a zárva tartó napok nem számítanak bele az átlagba.`}
      className={className}
    />
  )
}

/* -------------------------------------------------------------- szezon */

export function SeasonChart({ className }: { className?: string }) {
  return (
    <SharedSeasonChart
      months={SEASON_MONTHS}
      caption={`Belépésszám hónaponként · a kiemelt hónap a fenti nézetek alapja. Legerősebb: ${SEASON_BEST.label} ${formatCount(SEASON_BEST.totalIn)} · leggyengébb: ${SEASON_WORST.label} ${formatCount(SEASON_WORST.totalIn)}`}
      className={className}
    />
  )
}

/* ----------------------------------------------------------- időjárás */

export function WeatherImpactMockup({ className }: { className?: string }) {
  return (
    <AppFrame path="optinova.hu / belépők / időjárás" className={className}>
      <CardTitle
        title="Látogatottság időjárás szerint"
        sub={`${DEMO_MONTH.label} · csak a nyitvatartási időben`}
      />
      <div className="space-y-2">
        {WEATHER_BUCKETS.map((b) => {
          const negative = b.deltaPct < 0
          const width = Math.min(Math.abs(b.deltaPct) * 3.2, 50)
          return (
            <div
              key={b.key}
              className="rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[12.5px] font-semibold text-ink">
                  {b.label}
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10.5px] font-normal tabular-nums text-ink-muted">
                    {b.days} nap
                  </span>
                </p>
                <p className="text-[12.5px] tabular-nums text-ink-secondary">
                  <span className="font-semibold text-ink">{b.avgIn}</span> /
                  nap
                </p>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative h-2.5 min-w-0 flex-1 rounded-sm bg-subtle">
                  <span
                    className="absolute inset-y-[-3px] left-1/2 w-px bg-border-strong"
                    aria-hidden
                  />
                  <div
                    className="absolute top-0 h-full rounded-sm"
                    style={{
                      ...(negative
                        ? { right: '50%' }
                        : { left: '50%' }),
                      width: `${width}%`,
                      backgroundColor: negative ? CHART.rain : CHART.strong
                    }}
                  />
                </div>
                <span
                  className={cn(
                    'w-[52px] shrink-0 text-right text-[12px] font-semibold tabular-nums',
                    negative ? 'text-ink-secondary' : 'text-ink'
                  )}
                >
                  {formatSignedPct(b.deltaPct)}
                </span>
              </div>

              <p className="mt-1.5 text-[11px] text-ink-muted">{b.hint}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11.5px] text-ink-muted">
        Eltérés a havi napi átlagtól ({MONTH_AVG_IN} belépés).
      </p>
    </AppFrame>
  )
}

/* ------------------------------------------------------ vezetői összegzés */

export function MonthInsightCard({ className }: { className?: string }) {
  const bullets = [
    `${DEMO_MONTH.label}: ${formatCount(MONTH_TOTAL_IN)} belépés ${
      OPEN_DAYS.length
    } nyitvatartási napon, napi átlag ${MONTH_AVG_IN}.`,
    `Az előző hónaphoz mérve ${formatSignedPct(
      MOM_CHANGE_PCT
    )}, napi átlagban ${formatSignedPct(
      MOM_PER_DAY_CHANGE_PCT
    )}. Az összesített és a napi változás közötti eltérést a nyitvatartási napok száma okozza.`,
    `A legerősebb nap a hónap ${PEAK_DAY.day}-e volt ${PEAK_DAY.inCount} belépéssel. A legmagasabb óránkénti érték: ${HEATMAP_PEAK.label.toLocaleLowerCase('hu-HU')}, ${HEATMAP_PEAK.hour}:00 (${HEATMAP_PEAK.value} belépés).`,
    `Csütörtökön átlagosan ${TODAY_WEEKDAY_AVG}, szombaton ${
      WEEKDAY_PROFILE[5]?.avgIn ?? 0
    } belépést rögzített a rendszer.`
  ]

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-subtle p-4 sm:p-5',
        className
      )}
    >
      <p className="text-[13px] font-semibold text-ink">
        Havi összegzés
      </p>
      <ul className="mt-3 space-y-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex gap-2.5 text-[13px] leading-relaxed text-ink-secondary"
          >
            <span
              className="mt-[7px] size-1.5 shrink-0 rounded-full bg-border-strong"
              aria-hidden
            />
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}
