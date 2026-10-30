'use client'

import Link from 'next/link'
import { Factory } from 'lucide-react'

import type { SchedulerKpis } from '@/lib/orders/scheduler-kpi-queries'
import { cn } from '@/lib/utils'

function formatM(n: number): string {
  return `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
}

function capacityTone(pct: number): 'ink' | 'warning' | 'danger' {
  if (pct > 100) return 'danger'
  if (pct >= 85) return 'warning'
  return 'ink'
}

/** Full-width vastag sáv — kitölti a cellát, nincs ring white-space. */
function FillBar({
  ratio,
  tone = 'ink'
}: {
  ratio: number
  tone?: 'ink' | 'warning' | 'danger'
}) {
  const widthPct = Math.min(100, Math.max(0, ratio) * 100)
  return (
    <div
      className="mt-2 h-3 w-full overflow-hidden rounded-sm bg-subtle"
      aria-hidden
    >
      <div
        className={cn(
          'h-full rounded-sm transition-[width]',
          tone === 'danger' && 'bg-danger',
          tone === 'warning' && 'bg-warning',
          tone === 'ink' && 'bg-ink'
        )}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  )
}

function TodayCompact({
  pct,
  cuttingM,
  limitM,
  orderCount,
  href,
  active
}: {
  pct: number
  cuttingM: number
  limitM: number
  orderCount: number
  href: string
  active: boolean
}) {
  const tone = capacityTone(pct)
  const overloaded = pct > 100
  const hint = [
    limitM > 0
      ? `${formatM(cuttingM)} / ${formatM(limitM)}`
      : formatM(cuttingM),
    orderCount === 0 ? 'nincs rendelés' : `${orderCount} rendelés`,
    overloaded ? 'túlterhelt' : null
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      href={href}
      className={cn(
        'block min-w-0 px-3 py-2.5 no-underline transition-colors hover:bg-subtle',
        active && 'bg-subtle'
      )}
      aria-label={`Mai szabás kapacitás ${Math.round(pct)} százalék`}
    >
      <p className="text-hint text-ink-secondary">Mai terhelés</p>
      <p
        className={cn(
          'mt-0.5 text-[1.375rem] font-semibold tabular-nums leading-none tracking-tight',
          tone === 'danger' && 'text-danger-ink',
          tone === 'warning' && 'text-warning-ink',
          tone === 'ink' && (cuttingM > 0 ? 'text-ink' : 'text-ink-muted')
        )}
      >
        {pct > 999 ? '999+%' : `${Math.round(pct)}%`}
      </p>
      <p className="mt-1 truncate text-hint text-ink-muted">{hint}</p>
      <FillBar ratio={pct / 100} tone={tone} />
    </Link>
  )
}

function MachineBars({
  machines,
  activeMachineId
}: {
  machines: SchedulerKpis['today']['byMachine']
  activeMachineId: string
}) {
  if (machines.length === 0) {
    return (
      <div className="flex h-full min-w-0 flex-col justify-center px-3 py-2.5">
        <p className="text-hint text-ink-secondary">Gépek ma</p>
        <p className="mt-1 text-hint text-ink-muted">
          Nincs aktív gép.{' '}
          <Link
            href="/torzsadatok/rendszer/gyartogepek"
            className="text-ink underline"
          >
            Törzsadat →
          </Link>
        </p>
      </div>
    )
  }

  const shown = machines.slice(0, 3)
  const extra = machines.length - shown.length

  return (
    <div className="flex min-w-0 flex-col justify-center px-3 py-2.5">
      <p className="text-hint text-ink-secondary">Gépek ma</p>
      <ul className="mt-1.5 space-y-1.5" role="list">
        {shown.map((m) => {
          const fillPct =
            m.limitM > 0
              ? Math.min(100, (m.cuttingM / m.limitM) * 100)
              : m.cuttingM > 0
                ? 100
                : 0
          const over = m.limitM > 0 && m.cuttingM > m.limitM
          return (
            <li key={m.id}>
              <Link
                href={`/megrendelesek?today=1&machine=${m.id}`}
                className={cn(
                  'block no-underline',
                  activeMachineId &&
                    activeMachineId !== m.id &&
                    'opacity-40'
                )}
              >
                <div className="mb-0.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-hint font-semibold text-ink">
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums text-[11px]',
                      over ? 'font-semibold text-danger-ink' : 'text-ink-muted'
                    )}
                  >
                    {formatM(m.cuttingM)}
                    {m.limitM > 0 ? ` / ${formatM(m.limitM)}` : ''}
                  </span>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-sm bg-subtle"
                  aria-hidden
                >
                  <div
                    className={cn(
                      'h-full rounded-sm transition-[width]',
                      over ? 'bg-danger' : 'bg-ink'
                    )}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      {extra > 0 ? (
        <Link
          href="/megrendelesek?today=1"
          className="mt-1 text-[11px] text-ink-muted no-underline hover:underline"
        >
          +{extra} további gép
        </Link>
      ) : null}
    </div>
  )
}

function CompactMetric({
  label,
  value,
  hint,
  href,
  emphasize,
  active,
  barRatio
}: {
  label: string
  value: string
  hint: string
  href: string
  emphasize?: 'danger' | 'warning' | null
  active: boolean
  /** null = ne rajzolj sávot (0 db). */
  barRatio: number | null
}) {
  const tone =
    emphasize === 'danger'
      ? 'danger'
      : emphasize === 'warning'
        ? 'warning'
        : 'ink'

  return (
    <Link
      href={href}
      className={cn(
        'block min-w-0 px-3 py-2.5 no-underline transition-colors hover:bg-subtle',
        active && 'bg-subtle'
      )}
    >
      <p className="text-hint text-ink-secondary">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[1.375rem] font-semibold tabular-nums leading-none tracking-tight',
          emphasize === 'danger' && 'text-danger-ink',
          emphasize === 'warning' && 'text-warning-ink',
          !emphasize && 'text-ink'
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-hint text-ink-muted">{hint}</p>
      {barRatio != null && barRatio > 0 ? (
        <FillBar ratio={barRatio} tone={tone} />
      ) : null}
    </Link>
  )
}

export function SchedulerKpiStrip({
  data,
  activeToday,
  activeOverdue,
  activeUnscheduled,
  activeMachineId
}: {
  data: SchedulerKpis
  activeToday: boolean
  activeOverdue: boolean
  activeUnscheduled: boolean
  activeMachineId: string
}) {
  const openPool =
    data.overdue.count + data.today.orderCount + data.unscheduled.count
  const overdueRatio =
    openPool > 0 && data.overdue.count > 0
      ? data.overdue.count / openPool
      : null
  const unscheduledRatio =
    openPool > 0 && data.unscheduled.count > 0
      ? data.unscheduled.count / openPool
      : null

  return (
    <section className="mb-3 space-y-1.5" aria-label="Gyártás ütemezés">
      <div className="flex items-center gap-1.5 px-0.5">
        <Factory className="size-3.5 text-ink-muted" aria-hidden />
        <h2 className="text-body font-semibold text-ink">Gyártás ütemezés</h2>
        <Link
          href="/megrendelesek?status=in_production"
          className="ml-auto text-hint text-ink-secondary no-underline hover:underline"
        >
          Gyártásban →
        </Link>
      </div>

      <div className="rounded-md border border-border bg-surface">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <TodayCompact
            pct={data.today.pct}
            cuttingM={data.today.cuttingM}
            limitM={data.today.limitM}
            orderCount={data.today.orderCount}
            href="/megrendelesek?today=1"
            active={activeToday && !activeMachineId}
          />
          <div className={cn(activeMachineId && 'bg-subtle')}>
            <MachineBars
              machines={data.today.byMachine}
              activeMachineId={activeMachineId}
            />
          </div>
          <CompactMetric
            label="Elmaradás"
            value={String(data.overdue.count)}
            hint={
              data.overdue.count === 0
                ? 'Nincs lejárat'
                : `${formatM(data.overdue.cuttingM)} szabás`
            }
            href="/megrendelesek?overdue=1"
            emphasize={data.overdue.count > 0 ? 'danger' : null}
            active={activeOverdue}
            barRatio={overdueRatio}
          />
          <CompactMetric
            label="Nincs ütemezve"
            value={String(data.unscheduled.count)}
            hint={
              data.unscheduled.count === 0
                ? 'Minden ki van osztva'
                : `${formatM(data.unscheduled.cuttingM)} szabás`
            }
            href="/megrendelesek?unscheduled=1"
            emphasize={data.unscheduled.count > 0 ? 'warning' : null}
            active={activeUnscheduled}
            barRatio={unscheduledRatio}
          />
        </div>
      </div>
    </section>
  )
}
