'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Users
} from 'lucide-react'
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

/** Fix nap-oszlop — idő + rövid státuszszöveg. */
const DAY_COL = 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]'
const NAME_COL = 'w-44 min-w-44 max-w-44'
/** Compact default — 13″ laptopon több sor fér. */
const ROW_H = 'h-10'

const DEFAULT_ARRIVAL = '08:00'
const DEFAULT_DEPARTURE = '16:00'

type DayMode = 'work' | 'vacation' | 'sick' | 'clear'
type MainView = 'calendar' | 'todos'

type HoverTipState = {
  x: number
  y: number
  lines: string[]
}

type TodoItem = {
  employeeId: string
  name: string
  ymd: string
  kind: 'empty' | 'incomplete'
  detail: string
}

type TodayAwayItem = {
  name: string
  label: string
}

function formatYmdHu(ymd: string): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  const day = Number(ymd.slice(8, 10))
  const d = new Date(y, m - 1, day)
  return `${y}. ${MONTH_NAMES[m - 1]} ${day}. · ${WEEKDAY_SHORT_HU[d.getDay()]}`
}

function formatDayShort(ymd: string): string {
  const m = Number(ymd.slice(5, 7))
  const day = Number(ymd.slice(8, 10))
  return `${MONTH_NAMES[m - 1].slice(0, 3)}. ${day}.`
}

function dowOf(ymd: string): number {
  return new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10))
  ).getDay()
}

function timeHm(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  return value.slice(0, 5)
}

/** Oszlop-háttér: vasárnap erősebb, szombat gyengébb, ma = GCal-szerű erős tint. */
function columnTintClass(opts: {
  dow: number
  isToday: boolean
  isHoliday?: boolean
}): string {
  const { dow, isToday, isHoliday } = opts
  if (isToday) return 'bg-primary/[0.12]'
  if (isHoliday) return 'bg-subtle'
  if (dow === 0) return 'bg-zinc-100'
  if (dow === 6) return 'bg-zinc-50'
  return 'bg-surface'
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
    isRelocatedWork: Boolean(cell?.kind === 'empty' && cell.calendarName),
    onlyPast: opts?.onlyPast ?? false,
    todayYmd: opts?.todayYmd
  })
}

function sourceLabel(cell: CalendarCell | undefined): string | null {
  if (!cell) return null
  if (
    cell.kind === 'vacation' ||
    cell.kind === 'sick' ||
    cell.kind === 'other_absence'
  ) {
    return null
  }
  if (cell.kind === 'empty' || cell.kind === 'rest') return null
  if (cell.manuallyEdited || cell.source === 'manual') return 'Kézi bevitel'
  if (cell.source === 'terminal') return 'Eszköz (RFID / PIN)'
  if (cell.source === 'import') return 'Import'
  return null
}

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

  const src = sourceLabel(cell)
  if (src) lines.push(src)

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
    const dow = dowOf(ymd)
    if (dow === 0 || dow === 6) {
      lines.push(dow === 0 ? 'Vasárnap — pihenő' : 'Szombat')
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
      className: 'text-ink-muted hover:bg-black/[0.03]'
    }
  }
  switch (cell.kind) {
    case 'complete':
      return {
        text:
          cell.arrival && cell.departure
            ? `${cell.arrival.slice(0, 5)}–${cell.departure.slice(0, 5)}`
            : 'Kész',
        className:
          'bg-success-soft text-success-ink hover:bg-success-soft/80 text-[11px] font-semibold leading-tight'
      }
    case 'incomplete':
      return {
        text: cell.arrival
          ? `${cell.arrival.slice(0, 5)} · ?`
          : cell.departure
            ? `? · ${cell.departure.slice(0, 5)}`
            : 'Hiányos',
        className:
          'bg-warning-soft text-warning-ink ring-1 ring-inset ring-warning/45 text-[11px] font-semibold'
      }
    case 'vacation':
      return {
        text: 'Szab.',
        className:
          'bg-success text-white text-[12px] font-semibold hover:bg-success/90'
      }
    case 'sick':
      return {
        text: 'Beteg',
        className:
          'bg-danger text-white text-[12px] font-semibold hover:bg-danger/90'
      }
    case 'other_absence':
      return {
        text: 'Táv.',
        className:
          'bg-info-soft text-info-ink text-[12px] font-semibold hover:bg-info-soft/80'
      }
    case 'rest':
      return {
        text: '',
        className: 'text-ink-muted cursor-default'
      }
    default:
      return { text: '', className: '' }
  }
}

function computeGlance(data: CalendarMonthData) {
  let empty = 0
  let incomplete = 0
  let vacation = 0
  let sick = 0
  const todayAway: TodayAwayItem[] = []
  const todos: TodoItem[] = []

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
        if (ymd === today) {
          todayAway.push({ name: emp.name, label: 'Szabadság' })
        }
      } else if (cell.kind === 'sick') {
        sick += 1
        if (ymd === today) {
          todayAway.push({ name: emp.name, label: 'Beteg' })
        }
      } else if (cell.kind === 'other_absence') {
        if (ymd === today) {
          todayAway.push({ name: emp.name, label: 'Távollét' })
        }
      }

      const expected = isExpectedWorkDay(ymd, emp.worksOnSaturday, cell, {
        onlyPast: true,
        todayYmd: today
      })
      if (!expected) continue
      if (cell.kind === 'empty') {
        empty += 1
        rowAttention[emp.id]!.empty += 1
        todos.push({
          employeeId: emp.id,
          name: emp.name,
          ymd,
          kind: 'empty',
          detail: 'Nincs rögzítve'
        })
      } else if (cell.kind === 'incomplete') {
        incomplete += 1
        rowAttention[emp.id]!.incomplete += 1
        const missing: string[] = []
        if (!cell.arrival) missing.push('érkezés')
        if (!cell.departure) missing.push('távozás')
        todos.push({
          employeeId: emp.id,
          name: emp.name,
          ymd,
          kind: 'incomplete',
          detail: missing.length
            ? `Hiányzik: ${missing.join(', ')}`
            : 'Hiányos rögzítés'
        })
      }
    }
  }

  todos.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.name.localeCompare(b.name))

  return {
    empty,
    incomplete,
    vacation,
    sick,
    todayAway,
    today,
    rowAttention,
    todos,
    todoCount: empty + incomplete
  }
}

function LegendSwatch({
  className,
  label,
  children
}: {
  className: string
  label: string
  children?: ReactNode
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-ink-secondary"
      title={label}
    >
      <span
        className={cn(
          'inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] px-0.5 text-[9px] font-semibold',
          className
        )}
        aria-hidden
      >
        {children}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export function JelenletCalendarClient({ data, canWrite }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [workDate, setWorkDate] = useState('')
  const [mode, setMode] = useState<DayMode>('work')
  const [arrival, setArrival] = useState(DEFAULT_ARRIVAL)
  const [departure, setDeparture] = useState(DEFAULT_DEPARTURE)
  const [note, setNote] = useState('')
  const [hoverTip, setHoverTip] = useState<HoverTipState | null>(null)
  const [view, setView] = useState<MainView>('calendar')

  const glance = useMemo(() => computeGlance(data), [data])
  const nowYm = useMemo(() => {
    const t = budapestTodayYmd()
    return {
      year: Number(t.slice(0, 4)),
      month: Number(t.slice(5, 7))
    }
  }, [])
  const viewingCurrentMonth =
    data.year === nowYm.year && data.month === nowYm.month

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

  const openCellData = employeeId
    ? data.cells[`${employeeId}|${workDate}`]
    : undefined
  const openSource = sourceLabel(openCellData)
  const openEmployee = data.employees.find((e) => e.id === employeeId)
  const empName = openEmployee?.name ?? 'Dolgozó'
  const defaultShiftArrival = timeHm(
    openEmployee?.shiftStart,
    DEFAULT_ARRIVAL
  )
  const defaultShiftDeparture = timeHm(
    openEmployee?.shiftEnd,
    DEFAULT_DEPARTURE
  )

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

  function goToMonth(year: number, month: number) {
    router.push(`/jelenlet?year=${year}&month=${month}`)
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
    goToMonth(y, m)
  }

  function openCell(eid: string, ymd: string) {
    if (!canWrite) return
    const cell = data.cells[`${eid}|${ymd}`]
    const emp = data.employees.find((e) => e.id === eid)
    const shiftArr = timeHm(emp?.shiftStart, DEFAULT_ARRIVAL)
    const shiftDep = timeHm(emp?.shiftEnd, DEFAULT_DEPARTURE)
    setEmployeeId(eid)
    setWorkDate(ymd)
    if (cell?.kind === 'vacation') setMode('vacation')
    else if (cell?.kind === 'sick') setMode('sick')
    else setMode('work')
    setArrival(cell?.arrival ?? shiftArr)
    setDeparture(cell?.departure ?? shiftDep)
    setNote('')
    setOpen(true)
  }

  function openFirstTodo() {
    const first = glance.todos[0]
    if (!first) return
    openCell(first.employeeId, first.ymd)
  }

  function applyFullDayShift() {
    setArrival(defaultShiftArrival)
    setDeparture(defaultShiftDeparture)
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

  const todayAwayTitle = glance.todayAway
    .map((a) => `${a.name} (${a.label})`)
    .join(', ')
  const todayAwayNames = glance.todayAway.map((a) => a.name).join(', ')
  const monthTitle = `${data.year}. ${MONTH_NAMES[data.month - 1]}`

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col gap-2 print:h-auto">
      <PageHeader
        title="Jelenlét"
        description={
          glance.todoCount > 0
            ? `${glance.todoCount} múltbeli napot még pótolni.`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && glance.todoCount > 0 ? (
              <Button
                type="button"
                onClick={() => {
                  setView('todos')
                  openFirstTodo()
                }}
              >
                Pótold ({glance.todoCount})
              </Button>
            ) : null}
            <Link
              href="/dolgozok"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              <Users className="size-3.5" aria-hidden />
              Dolgozók
            </Link>
            <Link
              href="/jelenlet/naptar"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-secondary hover:bg-subtle hover:text-ink"
            >
              Munkarend
            </Link>
          </div>
        }
      />

      {data.employees.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 print:hidden">
          <div
            className="flex items-center gap-0.5"
            role="group"
            aria-label="Hónap váltása"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => shiftMonth(-1)}
              aria-label="Előző hónap"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="min-w-[9.5rem] px-1 text-center text-[14px] font-semibold tabular-nums text-ink">
              {monthTitle}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => shiftMonth(1)}
              aria-label="Következő hónap"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-1"
              disabled={viewingCurrentMonth}
              onClick={() => goToMonth(nowYm.year, nowYm.month)}
            >
              Ma
            </Button>
          </div>

          <div
            role="tablist"
            aria-label="Nézet"
            className="inline-flex gap-0.5 rounded-md border border-border bg-subtle p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'calendar'}
              onClick={() => setView('calendar')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
                view === 'calendar'
                  ? 'bg-ink text-white'
                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              Naptár
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'todos'}
              onClick={() => setView('todos')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
                view === 'todos'
                  ? 'bg-ink text-white'
                  : 'text-ink-secondary hover:bg-surface hover:text-ink'
              )}
            >
              <ClipboardList className="size-3.5" aria-hidden />
              Teendők
              {glance.todoCount > 0 ? (
                <span className="tabular-nums opacity-90">
                  ({glance.todoCount})
                </span>
              ) : null}
            </button>
          </div>

          {viewingCurrentMonth && glance.todayAway.length > 0 ? (
            <span
              className="min-w-0 max-w-[16rem] truncate text-[12px] text-ink-secondary"
              title={todayAwayTitle}
            >
              Ma szabadság / beteg:{' '}
              <span className="font-medium text-ink">{todayAwayNames}</span>
            </span>
          ) : null}

          {view === 'calendar' ? (
            <div className="ml-auto flex flex-wrap items-center gap-x-2 gap-y-1">
              <LegendSwatch
                className="bg-success-soft text-success-ink"
                label="Kész"
              >
                8–16
              </LegendSwatch>
              <LegendSwatch
                className="bg-warning-soft text-warning-ink ring-1 ring-warning/40"
                label="Hiányos"
              >
                ?
              </LegendSwatch>
              <LegendSwatch
                className="border border-dashed border-warning/50 bg-warning-soft/50 text-warning-ink"
                label="Pótolni"
              >
                —
              </LegendSwatch>
              <LegendSwatch className="bg-success text-white" label="Szabadság">
                Szab.
              </LegendSwatch>
              <LegendSwatch className="bg-danger text-white" label="Beteg">
                B
              </LegendSwatch>
              <LegendSwatch className="bg-info-soft text-info-ink" label="Távollét">
                T
              </LegendSwatch>
            </div>
          ) : null}
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
      ) : view === 'todos' ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface print:border-0">
          {glance.todoCount === 0 ? (
            <div className="p-6">
              <p className="rounded-md border border-success/25 bg-success-soft/60 px-3 py-2.5 text-[14px] text-success-ink">
                Nincs pótolnivaló múltbeli nap. A naptárban minden rendben.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => setView('calendar')}
              >
                Vissza a naptárhoz
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {glance.todos.map((todo) => (
                <li key={`${todo.employeeId}|${todo.ymd}`}>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => openCell(todo.employeeId, todo.ymd)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-warning-soft/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {todo.name}
                        </span>
                        <span className="block text-[12px] text-ink-secondary">
                          {formatDayShort(todo.ymd)} · {todo.detail}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-warning-soft px-2 py-1 text-[12px] font-semibold text-warning-ink">
                        {todo.kind === 'empty' ? 'Pótolni' : 'Hiányos'}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {todo.name}
                        </span>
                        <span className="block text-[12px] text-ink-secondary">
                          {formatDayShort(todo.ymd)} · {todo.detail}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-warning-soft px-2 py-1 text-[12px] font-semibold text-warning-ink">
                        {todo.kind === 'empty' ? 'Pótolni' : 'Hiányos'}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface print:max-h-none print:overflow-visible print:border-0">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th
                  className={cn(
                    NAME_COL,
                    'sticky left-0 top-0 z-30 border-b border-r border-border bg-subtle px-2 py-1.5 text-left text-[13px] font-medium text-ink shadow-[2px_0_0_0_var(--border)]'
                  )}
                >
                  Dolgozó
                </th>
                {data.dates.map((ymd) => {
                  const day = Number(ymd.slice(8, 10))
                  const dow = dowOf(ymd)
                  const isToday = ymd === glance.today
                  const isHoliday = holidayByDate.has(ymd)
                  const holidayName = holidayByDate.get(ymd) ?? null
                  const weekend = dow === 0 || dow === 6
                  const holidayShort =
                    holidayName && holidayName.length > 10
                      ? `${holidayName.slice(0, 9)}…`
                      : holidayName
                  return (
                    <th
                      key={ymd}
                      data-weekend={
                        dow === 0 ? 'sun' : dow === 6 ? 'sat' : undefined
                      }
                      data-today={isToday ? 'true' : undefined}
                      aria-current={isToday ? 'date' : undefined}
                      className={cn(
                        DAY_COL,
                        'sticky top-0 z-20 border-b border-r border-border/70 px-0 py-1 text-center font-medium',
                        columnTintClass({ dow, isToday, isHoliday }),
                        isToday &&
                          'border-l-[3px] border-l-primary border-r-[3px] border-r-primary',
                        weekend ? 'text-ink-muted' : 'text-ink-secondary',
                        isHoliday && 'text-ink-muted'
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
                        className={cn(
                          'mx-auto flex size-6 items-center justify-center text-[13px] leading-none',
                          isToday &&
                            'rounded-full bg-primary font-semibold text-white'
                        )}
                      >
                        {day}
                      </div>
                      <div
                        className={cn(
                          'mt-0.5 text-[10px] font-normal leading-tight',
                          weekend && 'opacity-80',
                          isToday && 'font-semibold text-primary'
                        )}
                      >
                        {isToday
                          ? 'Ma'
                          : isHoliday && holidayShort
                            ? holidayShort
                            : WEEKDAY_SHORT_HU[dow]}
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
                  <tr key={emp.id} className="group">
                    <td
                      className={cn(
                        NAME_COL,
                        'sticky left-0 z-10 border-b border-r border-border bg-surface px-2 py-0 shadow-[2px_0_0_0_var(--border)] group-hover:bg-subtle'
                      )}
                    >
                      <div className={cn('flex items-center gap-1.5', ROW_H)}>
                        <Link
                          href={`/dolgozok/${emp.id}`}
                          className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:underline"
                          title={emp.name}
                        >
                          {emp.name}
                        </Link>
                        {miss > 0 ? (
                          <span
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-warning-soft text-[11px] font-semibold text-warning-ink"
                            title={[
                              att!.empty > 0 ? `${att!.empty} pótolni` : null,
                              att!.incomplete > 0
                                ? `${att!.incomplete} hiányos`
                                : null
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          >
                            {miss}
                          </span>
                        ) : (
                          <span className="size-5 shrink-0" aria-hidden />
                        )}
                      </div>
                    </td>
                    {data.dates.map((ymd) => {
                      const cell = data.cells[`${emp.id}|${ymd}`]
                      const isToday = ymd === glance.today
                      const dow = dowOf(ymd)
                      const isHoliday = holidayByDate.has(ymd)
                      const disp = cellDisplay(cell)
                      const isPast = ymd < glance.today
                      const scheduleExpected = isExpectedWorkDay(
                        ymd,
                        emp.worksOnSaturday,
                        cell,
                        { onlyPast: false, todayYmd: glance.today }
                      )
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
                      const statusFill =
                        cell?.kind === 'vacation' ||
                        cell?.kind === 'sick' ||
                        cell?.kind === 'other_absence' ||
                        cell?.kind === 'incomplete' ||
                        cell?.kind === 'complete'

                      return (
                        <td
                          key={ymd}
                          data-weekend={
                            dow === 0 ? 'sun' : dow === 6 ? 'sat' : undefined
                          }
                          data-today={isToday ? 'true' : undefined}
                          className={cn(
                            DAY_COL,
                            'border-b border-r border-border/70 p-0',
                            !statusFill &&
                              columnTintClass({ dow, isToday, isHoliday }),
                            statusFill &&
                              (isToday ? 'bg-primary/[0.06]' : 'bg-surface'),
                            isToday &&
                              'border-l-[3px] border-l-primary border-r-[3px] border-r-primary'
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
                              'flex w-full items-center justify-center px-0.5 tabular-nums',
                              ROW_H,
                              disp.className,
                              emptyWork &&
                                !disp.text &&
                                'bg-warning-soft/50 ring-1 ring-inset ring-dashed ring-warning/50',
                              canWrite &&
                                cell?.kind !== 'rest' &&
                                'cursor-pointer'
                            )}
                          >
                            {emptyWork && !disp.text ? (
                              <span className="text-[12px] font-semibold text-warning-ink">
                                —
                              </span>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {empName}
              <span className="mt-0.5 block text-[13px] font-normal text-ink-secondary">
                {workDate ? formatYmdHu(workDate) : workDate}
              </span>
            </DialogTitle>
          </DialogHeader>

          {openSource ? (
            <StatusBadge
              tone={openSource.startsWith('Eszköz') ? 'info' : 'neutral'}
              variant="outline"
            >
              {openSource}
              {openCellData?.manuallyEdited &&
              openCellData.source === 'terminal'
                ? ' · kézzel módosítva'
                : null}
            </StatusBadge>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'work' as const,
                  label: 'Bent voltam',
                  hint: 'Érkezés és távozás',
                  active: 'border-ink bg-ink text-white',
                  idle: 'border-border bg-subtle text-ink hover:bg-border/40'
                },
                {
                  id: 'vacation' as const,
                  label: 'Szabadság',
                  hint: 'Egész nap távol',
                  active: 'border-success bg-success text-white',
                  idle: 'border-success/35 bg-success-soft text-success-ink hover:bg-success-soft/80'
                },
                {
                  id: 'sick' as const,
                  label: 'Beteg voltam',
                  hint: 'Betegszabadság',
                  active: 'border-danger bg-danger text-white',
                  idle: 'border-danger/35 bg-danger-soft text-danger-ink hover:bg-danger-soft/80'
                },
                {
                  id: 'clear' as const,
                  label: 'Törlés',
                  hint: 'Nap ürítése',
                  active: 'border-ink bg-ink text-white',
                  idle: 'border-border bg-surface text-ink-secondary hover:bg-subtle'
                }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  'rounded-md border px-3 py-2.5 text-left transition-colors',
                  mode === m.id ? m.active : m.idle
                )}
                onClick={() => setMode(m.id)}
              >
                <span className="block text-[14px] font-semibold leading-tight">
                  {m.label}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block text-[12px] leading-tight',
                    mode === m.id ? 'opacity-80' : 'opacity-70'
                  )}
                >
                  {m.hint}
                </span>
              </button>
            ))}
          </div>

          {mode === 'work' ? (
            <div className="space-y-3">
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
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={applyFullDayShift}
              >
                Egész nap {defaultShiftArrival}–{defaultShiftDeparture}
              </Button>
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
            <p className="rounded-md border border-danger/25 bg-danger-soft px-3 py-2 text-body text-danger-ink">
              Törli a nap jelenlétét és az egynapos távollétet. A művelet
              visszavonható újabb mentéssel.
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
            <Button
              type="button"
              variant={mode === 'clear' ? 'danger' : 'primary'}
              loading={pending}
              onClick={save}
            >
              {mode === 'clear' ? 'Nap törlése' : 'Nap mentése'}
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
