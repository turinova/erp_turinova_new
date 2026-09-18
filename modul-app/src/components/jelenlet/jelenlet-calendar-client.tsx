'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { saveAttendanceDayAction } from '@/lib/jelenlet/actions'
import {
  budapestTodayYmd,
  isExpectedAttendanceDay,
  minutesToHoursLabel,
  WEEKDAY_SHORT_HU
} from '@/lib/jelenlet/hours'
import type {
  CalendarCell,
  CalendarMonthData
} from '@/lib/jelenlet/queries'
import { ABSENCE_TYPE_LABEL } from '@/lib/jelenlet/types'
import { cn } from '@/lib/utils'

type Props = {
  data: CalendarMonthData
  canWrite: boolean
}

const MONTH_NAMES = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
]

type DayMode = 'work' | 'vacation' | 'sick' | 'clear'

type HoverTipState = {
  x: number
  y: number
  lines: string[]
}

function formatYmdHu(ymd: string): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const day = Number(ymd.slice(8, 10))
  const d = new Date(y, m - 1, day)
  return `${y}. ${MONTH_NAMES[m - 1]} ${day}. · ${WEEKDAY_SHORT_HU[d.getDay()]}`
}

function isExpectedWorkDay(
  ymd: string,
  worksOnSaturday: boolean,
  cell: CalendarCell | undefined,
  opts?: { onlyPast?: boolean; todayYmd?: string }
): boolean {
  return isExpectedAttendanceDay({
    ymd,
    worksOnSaturday,
    isCalendarRest: cell?.kind === 'rest',
    isRelocatedWork: Boolean(
      cell?.kind === 'empty' && cell.calendarName
    ),
    onlyPast: opts?.onlyPast ?? false,
    todayYmd: opts?.todayYmd
  })
}

/** Hover szöveg: státusz + dátum + dolgozó — native title helyett látható tip. */
function cellHoverLines(
  empName: string,
  ymd: string,
  cell: CalendarCell | undefined,
  expected: boolean,
  canWrite: boolean,
  isPast: boolean
): string[] {
  const lines = [empName, formatYmdHu(ymd)]

  if (!cell || cell.kind === 'empty') {
    if (cell?.calendarName) {
      lines.push(`Áthelyezett munkanap: ${cell.calendarName}`)
    }
    if (expected) {
      if (isPast) {
        lines.push('Hiányzó nap — nincs jelenlét rögzítve')
        if (canWrite) lines.push('Kattints a kitöltéshez')
      } else {
        lines.push('Munkanap — még nincs rögzítve')
        if (canWrite) lines.push('Kattints a kitöltéshez')
      }
    } else {
      lines.push('Nem munkanap (hétvége / szabad)')
    }
    return lines
  }

  switch (cell.kind) {
    case 'complete':
      lines.push(
        `Jelenlét: ${cell.arrival?.slice(0, 5) ?? '—'}–${cell.departure?.slice(0, 5) ?? '—'}`
      )
      lines.push(`Fizetett: ${minutesToHoursLabel(cell.paidMinutes)} ó`)
      break
    case 'incomplete': {
      const missing: string[] = []
      if (!cell.arrival) missing.push('érkezés')
      if (!cell.departure) missing.push('távozás')
      lines.push(
        `Hiányos rögzítés${missing.length ? ` — hiányzik: ${missing.join(', ')}` : ''}`
      )
      if (cell.arrival) lines.push(`Érkezés: ${cell.arrival.slice(0, 5)}`)
      if (cell.departure) lines.push(`Távozás: ${cell.departure.slice(0, 5)}`)
      if (canWrite) lines.push('Kattints a kiegészítéshez')
      break
    }
    case 'vacation':
      lines.push(ABSENCE_TYPE_LABEL.vacation)
      if (canWrite) lines.push('Kattints a módosításhoz')
      break
    case 'sick':
      lines.push(ABSENCE_TYPE_LABEL.sick)
      if (canWrite) lines.push('Kattints a módosításhoz')
      break
    case 'other_absence':
      lines.push('Távollét (fizetés nélküli / egyéb)')
      if (canWrite) lines.push('Kattints a módosításhoz')
      break
    case 'rest':
      lines.push(
        cell.calendarName
          ? `Ünnep / pihenőnap: ${cell.calendarName}`
          : 'Ünnep / pihenőnap'
      )
      lines.push('Nincs jelenlét rögzítés')
      break
    default:
      break
  }

  return lines
}

function headerHoverLines(
  ymd: string,
  holidayName: string | null | undefined,
  isHoliday: boolean
): string[] {
  const lines = [formatYmdHu(ymd)]
  if (isHoliday) {
    lines.push(
      holidayName
        ? `Ünnep / pihenőnap: ${holidayName}`
        : 'Ünnep / pihenőnap'
    )
  } else {
    const d = new Date(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(5, 7)) - 1,
      Number(ymd.slice(8, 10))
    )
    const dow = d.getDay()
    if (dow === 0 || dow === 6) {
      lines.push(dow === 0 ? 'Vasárnap' : 'Szombat')
    } else {
      lines.push('Munkanap')
    }
  }
  return lines
}

function cellDisplay(cell: CalendarCell | undefined): {
  text: string
  className: string
} {
  if (!cell || cell.kind === 'empty') {
    return {
      text: '',
      className:
        'bg-surface text-ink-muted hover:bg-subtle border border-transparent hover:border-warning/40'
    }
  }
  switch (cell.kind) {
    case 'complete':
      return {
        text:
          cell.arrival && cell.departure
            ? `${cell.arrival.slice(0, 5)}–${cell.departure.slice(0, 5)}`
            : '✓',
        className: 'bg-surface text-ink hover:bg-subtle'
      }
    case 'incomplete':
      return {
        text: cell.arrival || cell.departure || '!',
        className:
          'bg-surface text-warning-ink ring-1 ring-inset ring-warning/50'
      }
    case 'vacation':
      return {
        text: 'Sz',
        className: 'bg-surface text-info-ink ring-1 ring-inset ring-info/35'
      }
    case 'sick':
      return {
        text: 'B',
        className:
          'bg-warning-soft/40 text-warning-ink ring-1 ring-inset ring-warning/40'
      }
    case 'other_absence':
      return {
        text: 'T',
        className: 'bg-subtle text-ink-secondary'
      }
    case 'rest':
      return {
        text: '·',
        className: 'bg-subtle/70 text-ink-muted cursor-default'
      }
    default:
      return { text: '', className: 'bg-surface' }
  }
}

function computeGlance(data: CalendarMonthData) {
  let empty = 0
  let incomplete = 0
  let vacation = 0
  let sick = 0
  const todayAway: string[] = []

  const today = budapestTodayYmd()

  const rowAttention: Record<string, { empty: number; incomplete: number }> =
    {}

  for (const emp of data.employees) {
    rowAttention[emp.id] = { empty: 0, incomplete: 0 }
    for (const ymd of data.dates) {
      const cell = data.cells[`${emp.id}|${ymd}`]
      if (!cell) continue
      if (cell.kind === 'vacation') {
        vacation += 1
        if (ymd === today) todayAway.push(emp.name)
      } else if (cell.kind === 'sick') {
        sick += 1
        if (ymd === today) todayAway.push(emp.name)
      } else if (cell.kind === 'other_absence') {
        if (ymd === today) todayAway.push(emp.name)
      }

      // Hiányzó/hiányos: csak eltelt nap; V soha; Szo csak ha dolgozik
      const expected = isExpectedWorkDay(ymd, emp.worksOnSaturday, cell, {
        onlyPast: true,
        todayYmd: today
      })
      if (!expected) continue
      if (cell.kind === 'empty') {
        empty += 1
        rowAttention[emp.id]!.empty += 1
      } else if (cell.kind === 'incomplete') {
        incomplete += 1
        rowAttention[emp.id]!.incomplete += 1
      }
    }
  }

  return { empty, incomplete, vacation, sick, todayAway, today, rowAttention }
}

export function JelenletCalendarClient({ data, canWrite }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [workDate, setWorkDate] = useState('')
  const [mode, setMode] = useState<DayMode>('work')
  const [arrival, setArrival] = useState('08:00')
  const [departure, setDeparture] = useState('16:00')
  const [note, setNote] = useState('')
  const [hoverTip, setHoverTip] = useState<HoverTipState | null>(null)

  const glance = useMemo(() => computeGlance(data), [data])

  const holidayByDate = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const cell of Object.values(data.cells)) {
      if (cell.kind !== 'rest') continue
      const prev = map.get(cell.workDate)
      if (prev == null || (!prev && cell.calendarName)) {
        map.set(cell.workDate, cell.calendarName)
      }
    }
    return map
  }, [data.cells])

  const empName =
    data.employees.find((e) => e.id === employeeId)?.name ?? 'Dolgozó'

  function showHoverTip(
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    lines: string[]
  ) {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverTip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      lines
    })
  }

  function hideHoverTip() {
    setHoverTip(null)
  }

  function shiftMonth(delta: number) {
    let y = data.year
    let m = data.month + delta
    if (m < 1) {
      m = 12
      y -= 1
    }
    if (m > 12) {
      m = 1
      y += 1
    }
    router.push(`/jelenlet?year=${y}&month=${m}`)
  }

  function openCell(eid: string, ymd: string) {
    if (!canWrite) return
    const cell = data.cells[`${eid}|${ymd}`]
    setEmployeeId(eid)
    setWorkDate(ymd)
    if (cell?.kind === 'vacation') setMode('vacation')
    else if (cell?.kind === 'sick') setMode('sick')
    else setMode('work')
    setArrival(cell?.arrival ?? '08:00')
    setDeparture(cell?.departure ?? '16:00')
    setNote('')
    setOpen(true)
  }

  function save() {
    if (!employeeId) return
    startTransition(async () => {
      const result = await saveAttendanceDayAction({
        employeeId,
        workDate,
        mode,
        arrivalTime: mode === 'work' ? arrival : null,
        departureTime: mode === 'work' ? departure : null,
        lunchStart: null,
        lunchEnd: null,
        note: note || null
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Nap mentve.')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Jelenlét"
        description={`${MONTH_NAMES[data.month - 1]} ${data.year} — mi hiányzik, ki van távol.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dolgozok"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
            >
              <Users className="size-3.5" aria-hidden />
              Dolgozók
            </Link>
            <Link
              href="/jelenlet/naptar"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-ink hover:bg-subtle"
            >
              Munkarend
            </Link>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => shiftMonth(-1)}
                aria-label="Előző hónap"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => shiftMonth(1)}
                aria-label="Következő hónap"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        }
      />

      {data.employees.length > 0 ? (
        <div className="flex flex-col gap-2 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              tone={glance.empty > 0 ? 'warning' : 'neutral'}
              variant="soft"
            >
              Hiányzó nap: {glance.empty}
            </StatusBadge>
            <StatusBadge
              tone={glance.incomplete > 0 ? 'warning' : 'neutral'}
              variant="soft"
            >
              Hiányos: {glance.incomplete}
            </StatusBadge>
            <StatusBadge tone="info" variant="soft">
              Szabadság: {glance.vacation}
            </StatusBadge>
            <StatusBadge
              tone={glance.sick > 0 ? 'warning' : 'neutral'}
              variant="soft"
            >
              Beteg: {glance.sick}
            </StatusBadge>
          </div>
          {glance.todayAway.length > 0 ? (
            <p className="text-hint text-ink-secondary">
              Ma távol:{' '}
              <span className="font-medium text-ink">
                {glance.todayAway.join(', ')}
              </span>
            </p>
          ) : (
            <p className="text-hint text-ink-muted">Ma senki nincs távolléten.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-ink-muted">Jelkulcs:</span>
            <StatusBadge tone="neutral" variant="outline">
              08:00–16:00 kész
            </StatusBadge>
            <StatusBadge tone="warning" variant="outline">
              ! hiányos
            </StatusBadge>
            <StatusBadge tone="neutral" variant="outline">
              üres = nincs rögzítve
            </StatusBadge>
            <StatusBadge tone="info" variant="outline">
              Sz szabadság
            </StatusBadge>
            <StatusBadge tone="warning" variant="outline">
              B beteg
            </StatusBadge>
            <StatusBadge tone="neutral" variant="outline">
              · ünnep / pihenő
            </StatusBadge>
          </div>
        </div>
      ) : null}

      {data.employees.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-subtle p-6">
          <p className="text-body font-medium text-ink">Nincs aktív dolgozó.</p>
          <p className="mt-0.5 text-hint text-ink-secondary">
            Először vegyél fel dolgozót.
          </p>
          {canWrite ? (
            <Link
              href="/dolgozok/uj"
              className="mt-3 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover"
            >
              Új dolgozó
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface print:border-0">
          <table className="w-full min-w-[720px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-subtle">
                <th className="sticky left-0 z-10 min-w-[9rem] border-b border-r border-border bg-subtle px-2 py-1.5 text-left font-medium text-ink">
                  Dolgozó
                </th>
                {data.dates.map((ymd) => {
                  const day = Number(ymd.slice(8, 10))
                  const d = new Date(
                    Number(ymd.slice(0, 4)),
                    Number(ymd.slice(5, 7)) - 1,
                    day
                  )
                  const dow = d.getDay()
                  const isToday = ymd === glance.today
                  const isHoliday = holidayByDate.has(ymd)
                  const holidayName = holidayByDate.get(ymd) ?? null
                  return (
                    <th
                      key={ymd}
                      className={cn(
                        'border-b border-border px-0.5 py-1 text-center font-medium text-ink-secondary',
                        (dow === 0 || dow === 6) && 'bg-subtle/90',
                        isToday && 'border-l-2 border-l-primary bg-subtle',
                        isHoliday && 'text-info-ink'
                      )}
                      onMouseEnter={(e) =>
                        showHoverTip(
                          e,
                          headerHoverLines(ymd, holidayName, isHoliday)
                        )
                      }
                      onMouseLeave={hideHoverTip}
                    >
                      <div
                        className={cn(isToday && 'font-semibold text-ink')}
                      >
                        {day}
                      </div>
                      <div className="text-[10px] font-normal">
                        {WEEKDAY_SHORT_HU[dow]}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => {
                const att = glance.rowAttention[emp.id]
                const miss = (att?.empty ?? 0) + (att?.incomplete ?? 0)
                return (
                  <tr key={emp.id} className="hover:bg-subtle/40">
                    <td className="sticky left-0 z-10 border-b border-r border-border bg-surface px-2 py-1">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/dolgozok/${emp.id}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {emp.name}
                        </Link>
                        {miss > 0 ? (
                          <StatusBadge tone="warning" variant="soft">
                            {[
                              att!.empty > 0 ? `${att!.empty} üres` : null,
                              att!.incomplete > 0
                                ? `${att!.incomplete} hiányos`
                                : null
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </StatusBadge>
                        ) : (
                          <span className="text-[10px] text-ink-muted">
                            Rendben
                          </span>
                        )}
                      </div>
                    </td>
                    {data.dates.map((ymd) => {
                      const cell = data.cells[`${emp.id}|${ymd}`]
                      const isToday = ymd === glance.today
                      const dow = new Date(
                        Number(ymd.slice(0, 4)),
                        Number(ymd.slice(5, 7)) - 1,
                        Number(ymd.slice(8, 10))
                      ).getDay()
                      const weekend = dow === 0 || dow === 6
                      const disp = cellDisplay(cell)
                      const isPast = ymd < glance.today
                      const scheduleExpected = isExpectedWorkDay(
                        ymd,
                        emp.worksOnSaturday,
                        cell,
                        { onlyPast: false, todayYmd: glance.today }
                      )
                      // Figyelmeztető üres: csak eltelt elvárt munkanap
                      const emptyWork =
                        isPast &&
                        scheduleExpected &&
                        (!cell || cell.kind === 'empty')
                      const tipLines = cellHoverLines(
                        emp.name,
                        ymd,
                        cell,
                        scheduleExpected,
                        canWrite,
                        isPast
                      )

                      return (
                        <td
                          key={ymd}
                          className={cn(
                            'border-b border-border p-0',
                            isToday && 'border-l-2 border-l-primary'
                          )}
                        >
                          <button
                            type="button"
                            disabled={!canWrite || cell?.kind === 'rest'}
                            aria-label={tipLines.join('. ')}
                            onMouseEnter={(e) => showHoverTip(e, tipLines)}
                            onMouseLeave={hideHoverTip}
                            onFocus={(e) => showHoverTip(e, tipLines)}
                            onBlur={hideHoverTip}
                            onClick={() => {
                              hideHoverTip()
                              openCell(emp.id, ymd)
                            }}
                            className={cn(
                              'flex h-10 w-full min-w-[2.5rem] items-center justify-center px-0.5 tabular-nums leading-tight',
                              disp.className,
                              weekend &&
                                cell?.kind !== 'complete' &&
                                cell?.kind !== 'vacation' &&
                                cell?.kind !== 'sick' &&
                                'bg-subtle/50',
                              emptyWork &&
                                'border border-dashed border-warning/35',
                              canWrite &&
                                cell?.kind !== 'rest' &&
                                'cursor-pointer'
                            )}
                          >
                            {emptyWork && !disp.text ? (
                              <span className="text-warning-ink/70">·</span>
                            ) : (
                              disp.text
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {empName} · {workDate}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'work' as const, label: 'Munka' },
                { id: 'vacation' as const, label: 'Szabadság' },
                { id: 'sick' as const, label: 'Betegszabadság' },
                { id: 'clear' as const, label: 'Törlés nap' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[13px]',
                  mode === m.id
                    ? 'bg-ink text-white'
                    : 'bg-subtle text-ink-secondary hover:bg-border/60'
                )}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'work' ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Érkezés" htmlFor="arr" required>
                <Input
                  id="arr"
                  type="time"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                />
              </FormField>
              <FormField label="Távozás" htmlFor="dep" required>
                <Input
                  id="dep"
                  type="time"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                />
              </FormField>
            </div>
          ) : null}

          {mode !== 'clear' ? (
            <FormField label="Megjegyzés" htmlFor="day-note" optionalLabel>
              <Input
                id="day-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
          ) : (
            <p className="text-body text-ink-secondary">
              Törli a nap jelenlétét és az egynapos távollétet.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={save}>
              Nap mentése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hoverTip ? (
        <div
          role="tooltip"
          className={cn(
            'pointer-events-none fixed z-[80] max-w-[16rem] -translate-x-1/2 rounded-md border border-border bg-ink px-2.5 py-1.5 text-left shadow-md',
            hoverTip.y < 72
              ? 'translate-y-2'
              : '-translate-y-[calc(100%+6px)]'
          )}
          style={{ left: hoverTip.x, top: hoverTip.y }}
        >
          {hoverTip.lines.map((line, i) => (
            <p
              key={`${i}-${line}`}
              className={cn(
                'text-[12px] leading-snug text-white',
                i === 0 && 'font-medium',
                i === 1 && 'text-white/75',
                i > 1 && 'mt-0.5 text-white/90'
              )}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
