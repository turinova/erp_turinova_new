'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  Clock,
  CreditCard,
  KeyRound,
  LogIn,
  LogOut,
  Moon,
  PencilLine,
  Plane
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { minutesToHoursLabel } from '@/lib/jelenlet/hours'
import type { AttendanceTimeSource, CalendarMonthData } from '@/lib/jelenlet/queries'
import type { TodayScanEvent } from '@/lib/jelenlet/today-queries'
import {
  classifyToday,
  minutesSoFar,
  TODAY_FLAG_LABEL,
  TODAY_STATUS_LABEL,
  TODAY_STATUS_ORDER,
  type TodayFlag,
  type TodayStatus
} from '@/lib/jelenlet/today-status'
import { ABSENCE_TYPE_LABEL } from '@/lib/jelenlet/types'
import { cn } from '@/lib/utils'

type Props = {
  data: CalendarMonthData
  today: string
  events: TodayScanEvent[]
  isExpected: (employeeId: string) => boolean
  search: string
  canWrite: boolean
  onEdit: (employeeId: string) => void
}

const STATUS_STYLE: Record<TodayStatus, { icon: typeof LogIn; className: string }> = {
  in: { icon: LogIn, className: 'border-success/30 bg-success-soft text-success-ink' },
  left: { icon: LogOut, className: 'border-border bg-subtle text-ink-secondary' },
  late: { icon: AlertTriangle, className: 'border-warning/40 bg-warning-soft text-warning-ink' },
  not_yet: { icon: CircleDashed, className: 'border-border bg-surface text-ink-secondary' },
  away: { icon: Plane, className: 'border-info/30 bg-info-soft text-info-ink' },
  off: { icon: Moon, className: 'border-border bg-surface text-ink-muted' }
}

const SOURCE_LABEL: Record<AttendanceTimeSource, string> = {
  rfid: 'kártya',
  pin: 'PIN',
  manual: 'kézi',
  import: 'import'
}

function budapestNowHm(): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
}

function TimeCell({ time, source }: { time: string | null; source: AttendanceTimeSource | null }) {
  if (!time) return <span className="text-ink-muted">—</span>
  const Icon = source === 'rfid' ? CreditCard : source === 'pin' ? KeyRound : source ? PencilLine : null
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-ink">
      {time.slice(0, 5)}
      {source ? (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-muted">
          {Icon ? <Icon className="size-3" aria-hidden /> : null}
          {SOURCE_LABEL[source]}
        </span>
      ) : null}
    </span>
  )
}

export function JelenletTodayPanel({ data, today, events, isExpected, search, canWrite, onEdit }: Props) {
  const [nowHm, setNowHm] = useState(budapestNowHm)
  const [filter, setFilter] = useState<TodayStatus | 'flagged' | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNowHm(budapestNowHm()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const rows = useMemo(() => {
    const byEmp = new Map<string, TodayScanEvent[]>()
    for (const e of events) {
      const list = byEmp.get(e.employeeId) ?? []
      list.push(e)
      byEmp.set(e.employeeId, list)
    }
    return data.employees.map((emp) => {
      const cell = data.cells[`${emp.id}|${today}`]
      const absent = cell?.kind === 'vacation' || cell?.kind === 'sick' || cell?.kind === 'other_absence'
      const evs = (byEmp.get(emp.id) ?? []).sort((a, b) => a.hm.localeCompare(b.hm))
      const { status, flags } = classifyToday({
        arrival: cell?.arrival ?? null,
        departure: cell?.departure ?? null,
        absent,
        expected: cell?.kind !== 'rest' && isExpected(emp.id),
        shiftStart: emp.shiftStart,
        nowHm,
        events: evs
      })
      return {
        emp,
        cell,
        status,
        flags,
        events: evs,
        absenceLabel:
          cell?.kind === 'vacation'
            ? ABSENCE_TYPE_LABEL.vacation
            : cell?.kind === 'sick'
              ? ABSENCE_TYPE_LABEL.sick
              : cell?.kind === 'other_absence'
                ? 'Távollét'
                : null,
        minutes: minutesSoFar(cell?.arrival ?? null, cell?.departure ?? null, nowHm)
      }
    })
  }, [data, today, events, isExpected, nowHm])

  const counts = useMemo(() => {
    const c: Record<TodayStatus | 'flagged', number> = {
      in: 0,
      left: 0,
      late: 0,
      not_yet: 0,
      away: 0,
      off: 0,
      flagged: 0
    }
    for (const r of rows) {
      c[r.status] += 1
      if (r.flags.length) c.flagged += 1
    }
    return c
  }, [rows])

  const q = search.trim().toLowerCase()
  const visible = rows
    .filter((r) => !q || r.emp.name.toLowerCase().includes(q))
    .filter((r) => !filter || (filter === 'flagged' ? r.flags.length > 0 : r.status === filter))
    .sort(
      (a, b) =>
        Number(b.flags.length > 0) - Number(a.flags.length > 0) ||
        TODAY_STATUS_ORDER.indexOf(a.status) - TODAY_STATUS_ORDER.indexOf(b.status) ||
        a.emp.name.localeCompare(b.emp.name, 'hu')
    )

  const chips: Array<{ id: TodayStatus | 'flagged'; label: string; icon: typeof LogIn }> = [
    { id: 'in', label: TODAY_STATUS_LABEL.in, icon: LogIn },
    { id: 'late', label: TODAY_STATUS_LABEL.late, icon: AlertTriangle },
    { id: 'not_yet', label: TODAY_STATUS_LABEL.not_yet, icon: CircleDashed },
    { id: 'left', label: TODAY_STATUS_LABEL.left, icon: LogOut },
    { id: 'away', label: TODAY_STATUS_LABEL.away, icon: Plane },
    { id: 'flagged', label: 'Eltérés', icon: AlertTriangle }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5" role="group" aria-label="Szűrés állapot szerint">
        {chips.map((chip) => {
          const active = filter === chip.id
          const n = counts[chip.id]
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? null : chip.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
                active ? 'border-ink bg-ink text-white' : 'border-border bg-surface text-ink hover:bg-subtle',
                !active && chip.id === 'flagged' && n > 0 && 'border-warning/50 text-warning-ink'
              )}
            >
              <chip.icon className="size-3.5" aria-hidden />
              {chip.label}
              <span className="tabular-nums font-semibold">{n}</span>
            </button>
          )
        })}
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-ink-muted">
          <Clock className="size-3.5" aria-hidden />
          {nowHm}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-secondary">
              {['Dolgozó', 'Állapot', 'Érkezés', 'Távozás', 'Eddig', 'Mai scanek', ''].map((h, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 border-b border-border bg-subtle px-3 py-2 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-secondary">
                  Nincs a szűrésnek megfelelő dolgozó.
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const style = STATUS_STYLE[r.status]
                return (
                  <tr key={r.emp.id} className="hover:bg-subtle/60">
                    <td className="border-b border-border px-3 py-2">
                      <Link href={`/dolgozok/${r.emp.id}`} className="font-medium text-ink hover:underline">
                        {r.emp.name}
                      </Link>
                    </td>
                    <td className="border-b border-border px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={cn(
                            'inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[12px] font-medium',
                            style.className
                          )}
                        >
                          <style.icon className="size-3.5" aria-hidden />
                          {r.absenceLabel ?? TODAY_STATUS_LABEL[r.status]}
                        </span>
                        {r.flags.map((f: TodayFlag) => (
                          <span
                            key={f}
                            className="inline-flex h-6 items-center gap-1 rounded border border-warning/40 bg-warning-soft px-1.5 text-[12px] font-medium text-warning-ink"
                          >
                            <AlertTriangle className="size-3.5" aria-hidden />
                            {TODAY_FLAG_LABEL[f]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-border px-3 py-2">
                      <TimeCell time={r.cell?.arrival ?? null} source={r.cell?.arrivalSource ?? null} />
                    </td>
                    <td className="border-b border-border px-3 py-2">
                      <TimeCell time={r.cell?.departure ?? null} source={r.cell?.departureSource ?? null} />
                    </td>
                    <td className="border-b border-border px-3 py-2 tabular-nums text-ink">
                      {r.minutes > 0 ? `${minutesToHoursLabel(r.minutes)} ó` : <span className="text-ink-muted">—</span>}
                    </td>
                    <td className="border-b border-border px-3 py-2">
                      {r.events.length ? (
                        <span className="flex flex-wrap gap-1">
                          {r.events.map((e, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-0.5 rounded bg-subtle px-1 text-[11px] tabular-nums text-ink-secondary"
                            >
                              {e.type === 'arrival' ? (
                                <LogIn className="size-3" aria-label="érkezés" />
                              ) : (
                                <LogOut className="size-3" aria-label="távozás" />
                              )}
                              {e.hm}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="border-b border-border px-3 py-1.5 text-right">
                      {canWrite && r.cell?.kind !== 'rest' ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(r.emp.id)}>
                          {r.status === 'left' || r.status === 'in' ? 'Idő javítása' : 'Rögzítés'}
                        </Button>
                      ) : r.status === 'left' && !r.flags.length ? (
                        <CircleCheck className="ml-auto size-4 text-success" aria-label="rendben" />
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
