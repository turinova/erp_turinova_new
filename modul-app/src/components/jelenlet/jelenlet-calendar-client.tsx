'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Crosshair,
  Radio,
  Search,
  Sun,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileUp,
  KeyRound,
  Maximize2,
  Minimize2,
  PencilLine
} from 'lucide-react'
import { toast } from 'sonner'

import { JelenletTodayPanel } from '@/components/jelenlet/jelenlet-today-panel'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { saveAttendanceDayAction } from '@/lib/jelenlet/actions'
import { groupEmployeesByType } from '@/lib/jelenlet/employee-type-groups'
import {
  budapestTodayYmd,
  isExpectedAttendanceDay,
  minutesToHoursLabel,
  WEEKDAY_SHORT_HU
} from '@/lib/jelenlet/hours'
import type {
  AttendanceTimeSource,
  CalendarCell,
  CalendarMonthData
} from '@/lib/jelenlet/queries'
import {
  classifyShiftDeviation,
  computeDaySplit,
  type ShiftDeviation
} from '@/lib/jelenlet/day-split'
import type { SheetEmployee } from '@/lib/jelenlet/sheet-engine'
import type { JelenletTodayData, TerminalStatus } from '@/lib/jelenlet/today-queries'
import { ABSENCE_TYPE_LABEL } from '@/lib/jelenlet/types'
import { cn } from '@/lib/utils'

const NO_OVERTIME: SheetEmployee['overtime'] = {
  enabled: false,
  graceMinutes: 0,
  roundingMinutes: 15,
  roundingMode: 'floor',
  dailyCapMinutes: 0
}
const NO_EARLY_OVERTIME: SheetEmployee['earlyOvertime'] = {
  ...NO_OVERTIME,
  triggerTime: null,
  payUntilTime: null,
  maxMinutes: 0
}

type Props = {
  data: CalendarMonthData
  canWrite: boolean
  /** Csak az aktuális hónapnál — mai scanek + terminál státusz. */
  today?: JelenletTodayData | null
  /** Cégszintű türelmi idő + dolgozónkénti túlóra szabályok az összesítőhöz. */
  totalsRules: { graceMinutes: number; employees: Record<string, SheetEmployee> }
}

type MonthTotal = {
  normal: number
  overtime: number
  weekendDays: number
  weekendMinutes: number
  days: number
}

const TOTAL_KEYS = ['normal', 'overtime', 'weekend'] as const
type TotalKey = (typeof TOTAL_KEYS)[number]

const TOTAL_HEAD: Record<TotalKey, string> = {
  normal: 'Rendes ó',
  overtime: 'Túlóra ó',
  weekend: 'Hétvége'
}

function hoursDecimal(mins: number): string {
  return (mins / 60).toLocaleString('hu-HU', { maximumFractionDigits: 2 })
}

function hoursExact(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} ó ${m} p` : `${h} ó`
}

function totalTipLines(name: string, t: MonthTotal, graceMinutes: number): string[] {
  return [
    name,
    `Rendes: ${hoursDecimal(t.normal)} ó (${hoursExact(t.normal)}) · ${t.days} hétköznap`,
    `Túlóra: ${hoursDecimal(t.overtime)} ó — 8 óra feletti műszakon belüli idő + bekapcsolt műszakon kívüli túlóra`,
    `Hétvége: ${t.weekendDays} nap · ${hoursDecimal(t.weekendMinutes)} ó (külön fizetendő)`,
    `Csak a műszakon belüli idő számít, ±${graceMinutes} perc türelmi idővel`
  ]
}

function formatContact(iso: string | null): string {
  if (!iso) return 'még nem jelentkezett'
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso))
}

function TerminalBadge({ terminals }: { terminals: TerminalStatus[] }) {
  if (terminals.length === 0) return null
  const allOnline = terminals.every((t) => t.online)
  const pending = terminals.reduce((s, t) => s + (t.pendingCount ?? 0), 0)
  const tone = !allOnline
    ? 'border-danger/30 bg-danger-soft text-danger-ink'
    : pending > 0
      ? 'border-warning/30 bg-warning-soft text-warning-ink'
      : 'border-success/30 bg-success-soft text-success-ink'
  const title = terminals
    .map(
      (t) =>
        `${t.name}: ${t.online ? 'online' : 'offline'} · utolsó kapcsolat ${formatContact(t.lastContactAt)}${t.appVersion ? ` · v${t.appVersion}` : ''}${t.pendingCount ? ` · ${t.pendingCount} várakozó` : ''}`
    )
    .join('\n')
  return (
    <span
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium', tone)}
      title={title}
    >
      <Radio className="size-3.5" aria-hidden />
      {terminals.length === 1 ? 'Terminál' : `${terminals.length} terminál`}{' '}
      {allOnline ? 'online' : 'offline'}
      {!allOnline ? (
        <span className="font-normal">· {formatContact(terminals.find((t) => !t.online)?.lastContactAt ?? null)}</span>
      ) : null}
      {pending > 0 ? <span className="font-normal">· {pending} scan feltöltésre vár</span> : null}
    </span>
  )
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
type CellSize = 'sm' | 'md' | 'lg'

const HOVER_TIP_DELAY_MS = 600

/** Sor + oszlop halvány kiemelése a kurzor alatt, JS újrarenderelés nélkül (:has). */
function gridHighlightCss(columns: number): string {
  const tint = 'box-shadow: inset 0 0 0 999px rgb(0 0 0 / 0.045);'
  const cols = Array.from({ length: columns }, (_, i) => [
    `.jl-grid:has(td[data-col="${i}"]:hover) td[data-col="${i}"] > button`,
    `.jl-grid:has(td[data-col="${i}"]:hover) th[data-col="${i}"]`
  ]).flat()
  return `.jl-grid tr:hover > td[data-col] > button, ${cols.join(', ')} { ${tint} }
.jl-grid td[data-col] > button:hover { box-shadow: inset 0 0 0 2px var(--color-ink, #18181b); }`
}

function deviationShortLine(dev: ShiftDeviation): string {
  const parts: string[] = []
  if (dev.lateMin) parts.push(`késés ${dev.lateMin} p`)
  if (dev.earlyLeaveMin) parts.push(`korábban ment ${dev.earlyLeaveMin} p`)
  if (dev.earlyArriveMin) parts.push(`korábban jött ${dev.earlyArriveMin} p`)
  if (dev.stayLateMin) parts.push(`tovább maradt ${dev.stayLateMin} p`)
  return parts.join(' · ')
}

const TOTAL_COL_PX: Record<CellSize, number> = { sm: 64, md: 76, lg: 92 }

const CELL_SIZES: Record<CellSize, { label: string; col: string; row: string; text: string; icon: string }> = {
  sm: { label: 'Kicsi', col: 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem]', row: 'h-11', text: 'text-[12px]', icon: 'size-3' },
  md: { label: 'Normál', col: 'w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem]', row: 'h-12', text: 'text-[14px]', icon: 'size-3.5' },
  lg: { label: 'Nagy', col: 'w-[6.5rem] min-w-[6.5rem] max-w-[6.5rem]', row: 'h-14', text: 'text-[16px]', icon: 'size-4' }
}

const CELL_SIZE_KEY = 'jelenlet.cellSize'
const NAME_COL = 'w-44 min-w-44 max-w-44'
/** Compact default — 13″ laptopon több sor fér. */

const DEFAULT_ARRIVAL = '08:00'
const DEFAULT_DEPARTURE = '16:00'

type DayMode = 'work' | 'vacation' | 'sick' | 'clear'
type MainView = 'today' | 'calendar' | 'todos'

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

const TIME_SOURCE_LABEL: Record<AttendanceTimeSource, string> = {
  rfid: 'kártya',
  pin: 'PIN',
  manual: 'kézi',
  import: 'import'
}

/** Kézi idő jelölése: alak (szaggatott aláhúzás), nem csak szín. */
const MANUAL_TIME_CLASS =
  'underline decoration-dashed decoration-1 underline-offset-[3px]'

function timeWithSource(
  time: string | null,
  source: AttendanceTimeSource | null
): string {
  if (!time) return '—'
  return source ? `${time.slice(0, 5)} · ${TIME_SOURCE_LABEL[source]}` : time.slice(0, 5)
}

function cellHasManualTime(cell: CalendarCell | undefined): boolean {
  if (!cell || (cell.kind !== 'complete' && cell.kind !== 'incomplete')) return false
  return cell.arrivalSource === 'manual' || cell.departureSource === 'manual'
}

function TimePart({
  time,
  source
}: {
  time: string
  source: AttendanceTimeSource | null
}) {
  return (
    <span className={source === 'manual' ? MANUAL_TIME_CLASS : undefined}>
      {time.slice(0, 5)}
    </span>
  )
}

function cellTimeContent(cell: CalendarCell | undefined): ReactNode | null {
  if (!cell) return null
  if (cell.kind === 'complete' && cell.arrival && cell.departure) {
    return (
      <span className="flex flex-col items-center leading-[1.15]">
        <TimePart time={cell.arrival} source={cell.arrivalSource} />
        <TimePart time={cell.departure} source={cell.departureSource} />
      </span>
    )
  }
  if (cell.kind === 'incomplete') {
    if (cell.arrival) {
      return (
        <span className="flex flex-col items-center leading-[1.15]">
          <TimePart time={cell.arrival} source={cell.arrivalSource} />
          <span>?</span>
        </span>
      )
    }
    if (cell.departure) {
      return (
        <span className="flex flex-col items-center leading-[1.15]">
          <span>?</span>
          <TimePart time={cell.departure} source={cell.departureSource} />
        </span>
      )
    }
  }
  return null
}

function TimeSourceTag({ source }: { source: AttendanceTimeSource | null }) {
  if (!source) return null
  const Icon =
    source === 'rfid'
      ? CreditCard
      : source === 'pin'
        ? KeyRound
        : source === 'import'
          ? FileUp
          : PencilLine
  const label =
    source === 'rfid'
      ? 'Kártya'
      : source === 'pin'
        ? 'PIN'
        : source === 'import'
          ? 'Import'
          : 'Kézi'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[11px] font-medium',
        source === 'manual'
          ? 'border-border bg-subtle text-ink'
          : 'border-info/30 bg-info-soft text-info-ink'
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  )
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

  switch (cell.kind) {
    case 'complete':
      lines.push(`Érkezés: ${timeWithSource(cell.arrival, cell.arrivalSource)}`)
      lines.push(`Távozás: ${timeWithSource(cell.departure, cell.departureSource)}`)
      lines.push(`Fizetett: ${minutesToHoursLabel(cell.paidMinutes)} ó`)
      break
    case 'incomplete': {
      const missing: string[] = []
      if (!cell.arrival) missing.push('érkezés')
      if (!cell.departure) missing.push('távozás')
      lines.push(
        `Hiányos rögzítés${missing.length ? ` — hiányzik: ${missing.join(', ')}` : ''}`
      )
      if (cell.arrival) {
        lines.push(`Érkezés: ${timeWithSource(cell.arrival, cell.arrivalSource)}`)
      }
      if (cell.departure) {
        lines.push(`Távozás: ${timeWithSource(cell.departure, cell.departureSource)}`)
      }
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
          'bg-success-soft text-ink hover:bg-success-soft/80 font-semibold'
      }
    case 'incomplete':
      return {
        text: cell.arrival
          ? `${cell.arrival.slice(0, 5)} · ?`
          : cell.departure
            ? `? · ${cell.departure.slice(0, 5)}`
            : 'Hiányos',
        className:
          'bg-warning-soft text-ink ring-1 ring-inset ring-warning/45 font-semibold'
      }
    case 'vacation':
      return {
        text: 'Szab.',
        className:
          'bg-success text-white font-semibold hover:bg-success/90'
      }
    case 'sick':
      return {
        text: 'Beteg',
        className:
          'bg-danger text-white font-semibold hover:bg-danger/90'
      }
    case 'other_absence':
      return {
        text: 'Táv.',
        className:
          'bg-info-soft text-ink font-semibold hover:bg-info-soft/80'
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
      // Üres szombat nem teendő (lehetőség); hiányos rögzítés igen.
      if (cell.kind === 'incomplete' && ymd < today) {
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
        continue
      }
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

const DEVIATION_CLASS: Record<Exclude<ShiftDeviation['kind'], 'ok'>, string> = {
  short: 'bg-danger-soft text-ink border-l-[3px] border-l-danger',
  long: 'bg-info-soft text-ink border-l-[3px] border-l-info',
  mixed: ''
}

function deviationClass(dev: ShiftDeviation): string {
  if (dev.kind === 'ok') return ''
  if (dev.kind === 'mixed') return dev.netMin < 0 ? DEVIATION_CLASS.short : DEVIATION_CLASS.long
  return DEVIATION_CLASS[dev.kind]
}

function deviationLines(
  dev: ShiftDeviation,
  shiftStart: string | null,
  shiftEnd: string | null,
  overtimeEnabled: boolean
): string[] {
  if (dev.kind === 'ok') return []
  const lines = [`Műszak: ${shiftStart?.slice(0, 5)}–${shiftEnd?.slice(0, 5)}`]
  if (dev.lateMin) lines.push(`Késés: ${dev.lateMin} perc`)
  if (dev.earlyLeaveMin) lines.push(`Korábban ment: ${dev.earlyLeaveMin} perc`)
  if (dev.earlyArriveMin) lines.push(`Korábban jött: ${dev.earlyArriveMin} perc`)
  if (dev.stayLateMin) lines.push(`Tovább maradt: ${dev.stayLateMin} perc`)
  if ((dev.earlyArriveMin || dev.stayLateMin) && !overtimeEnabled) {
    lines.push('A műszakon kívüli idő nem számít túlórának')
  }
  return lines
}

function DeviationIcons({ dev, iconClass }: { dev: ShiftDeviation; iconClass: string }) {
  const down = dev.lateMin + dev.earlyLeaveMin > 0
  const up = dev.earlyArriveMin + dev.stayLateMin > 0
  if (!down && !up) return null
  return (
    <span className="pointer-events-none flex shrink-0 flex-col" aria-hidden>
      {down ? <ArrowDown className={cn(iconClass, 'text-danger')} strokeWidth={2.75} /> : null}
      {up ? <ArrowUp className={cn(iconClass, 'text-info')} strokeWidth={2.75} /> : null}
    </span>
  )
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

export function JelenletCalendarClient({ data, canWrite, today, totalsRules }: Props) {
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
  const tipShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tipHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (tipShowTimer.current) clearTimeout(tipShowTimer.current)
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current)
  }, [])
  const [view, setView] = useState<MainView>(today ? 'today' : 'calendar')
  const [focusMode, setFocusMode] = useState(false)
  const [cellSize, setCellSize] = useState<CellSize>('md')
  useEffect(() => {
    const saved = window.localStorage.getItem(CELL_SIZE_KEY)
    if (saved === 'sm' || saved === 'md' || saved === 'lg') setCellSize(saved)
  }, [])
  const changeCellSize = (next: CellSize) => {
    setCellSize(next)
    window.localStorage.setItem(CELL_SIZE_KEY, next)
  }
  const size = CELL_SIZES[cellSize]
  const DAY_COL = size.col
  const totalPx = TOTAL_COL_PX[cellSize]
  const totalPxRef = useRef(totalPx)
  totalPxRef.current = totalPx
  const totalStyle = (k: TotalKey) => ({
    width: totalPx,
    minWidth: totalPx,
    maxWidth: totalPx,
    right: totalPx * (TOTAL_KEYS.length - 1 - TOTAL_KEYS.indexOf(k))
  })
  const totalMainText = { sm: 'text-[14px]', md: 'text-[16px]', lg: 'text-[18px]' }[cellSize]
  const totalSubText = { sm: 'text-[12px]', md: 'text-[13px]', lg: 'text-[14px]' }[cellSize]
  const ROW_H = size.row
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const glance = useMemo(() => computeGlance(data), [data])
  const employeeGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const emps = q
      ? data.employees.filter((e) => e.name.toLowerCase().includes(q))
      : data.employees
    return groupEmployeesByType(emps)
  }, [data.employees, search])

  const monthTotals = useMemo(() => {
    const out: Record<
      string,
      { normal: number; overtime: number; weekendDays: number; weekendMinutes: number; days: number }
    > = {}
    for (const emp of data.employees) {
      const t = { normal: 0, overtime: 0, weekendDays: 0, weekendMinutes: 0, days: 0 }
      const policy = totalsRules.employees[emp.id] ?? {
        shiftStart: emp.shiftStart,
        shiftEnd: emp.shiftEnd,
        overtime: NO_OVERTIME,
        earlyOvertime: NO_EARLY_OVERTIME
      }
      for (const ymd of data.dates) {
        const cell = data.cells[`${emp.id}|${ymd}`]
        if (cell?.kind !== 'complete') continue
        const dow = dowOf(ymd)
        const split = computeDaySplit({
          arrival: cell.arrival,
          departure: cell.departure,
          lunchStart: cell.lunchStart ?? emp.lunchStart,
          lunchEnd: cell.lunchEnd ?? emp.lunchEnd,
          weekend: (dow === 0 || dow === 6) && !cell.calendarName,
          graceMinutes: totalsRules.graceMinutes,
          employee: policy
        })
        t.normal += split.normal
        t.overtime += split.overtime
        if (split.weekend > 0) {
          t.weekendDays += 1
          t.weekendMinutes += split.weekend
        } else if (split.normal > 0) {
          t.days += 1
        }
      }
      out[emp.id] = t
    }
    return out
  }, [data, totalsRules])

  const isExpectedToday = useCallback(
    (employeeId: string) => {
      const emp = data.employees.find((e) => e.id === employeeId)
      return isExpectedWorkDay(
        glance.today,
        emp?.worksOnSaturday ?? false,
        data.cells[`${employeeId}|${glance.today}`],
        { onlyPast: false, todayYmd: glance.today }
      )
    },
    [data, glance.today]
  )

  const scrollToToday = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const box = scrollRef.current
    const th = box?.querySelector<HTMLElement>('th[data-today="true"]')
    if (!box || !th) return
    // A ragadós név-oszlop mögé ne csússzon; a mai nap után ~2 nap látsszon.
    const target = th.offsetLeft - box.clientWidth + th.offsetWidth * 3 + totalPxRef.current * 3
    box.scrollTo({ left: Math.max(0, target), behavior })
  }, [])

  useEffect(() => {
    if (view === 'calendar') scrollToToday('auto')
  }, [view, focusMode, scrollToToday])

  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setFocusMode(false)
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [focusMode])

  function enterFocusMode() {
    setView('calendar')
    setFocusMode(true)
  }

  function exitFocusMode() {
    setFocusMode(false)
  }
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
  const liveSource = (
    value: string,
    original: string | null | undefined,
    originalSource: AttendanceTimeSource | null | undefined
  ): AttendanceTimeSource | null => {
    if (!value) return null
    if (original && value === original.slice(0, 5)) return originalSource ?? 'manual'
    return 'manual'
  }
  const arrivalLiveSource = liveSource(
    arrival,
    openCellData?.arrival,
    openCellData?.arrivalSource
  )
  const departureLiveSource = liveSource(
    departure,
    openCellData?.departure,
    openCellData?.departureSource
  )
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

  function clearTipTimers() {
    if (tipShowTimer.current) clearTimeout(tipShowTimer.current)
    if (tipHideTimer.current) clearTimeout(tipHideTimer.current)
    tipShowTimer.current = null
    tipHideTimer.current = null
  }

  /** Egér: csak megállás után jelenik meg; ha már látszik, a szomszéd cellán azonnal vált. */
  function showHoverTip(
    e: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
    lines: string[] | null,
    immediate = false
  ) {
    clearTipTimers()
    if (!lines?.length) {
      setHoverTip(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const next = { x: rect.left + rect.width / 2, y: rect.top, lines }
    if (immediate || hoverTip) {
      setHoverTip(next)
      return
    }
    tipShowTimer.current = setTimeout(() => setHoverTip(next), HOVER_TIP_DELAY_MS)
  }

  function hideHoverTip() {
    clearTipTimers()
    tipHideTimer.current = setTimeout(() => setHoverTip(null), 120)
  }

  function hideHoverTipNow() {
    clearTipTimers()
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

  const monthTitle = `${data.year}. ${MONTH_NAMES[data.month - 1]}`

  return (
    <div
      className={cn(
        'flex flex-col gap-2 print:h-auto',
        focusMode
          ? 'fixed inset-0 z-50 bg-app p-3'
          : 'h-[calc(100dvh-6.5rem)]'
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 print:hidden">
        <h1 className="text-[16px] font-semibold text-ink">
          Jelenlét{focusMode ? <span className="ml-1.5 text-[12px] font-normal text-ink-muted">teljes nézet · Esc</span> : null}
        </h1>

        {!focusMode && data.employees.length > 0 ? (
          <div
            role="tablist"
            aria-label="Nézet"
            className="inline-flex gap-0.5 rounded-md border border-border bg-subtle p-0.5"
          >
            {today ? (
              <button
                type="button"
                role="tab"
                aria-selected={view === 'today'}
                onClick={() => setView('today')}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors',
                  view === 'today'
                    ? 'bg-ink text-white'
                    : 'text-ink-secondary hover:bg-surface hover:text-ink'
                )}
              >
                <Sun className="size-3.5" aria-hidden />
                Ma
              </button>
            ) : null}
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
                <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[11px] font-semibold tabular-nums text-white">
                  {glance.todoCount}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        {data.employees.length > 0 ? (
          <div className="flex items-center gap-0.5" role="group" aria-label="Hónap váltása">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => shiftMonth(-1)}
              aria-label="Előző hónap"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="min-w-[8.5rem] px-1 text-center text-[14px] font-semibold tabular-nums text-ink">
              {monthTitle}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => shiftMonth(1)}
              aria-label="Következő hónap"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            {!viewingCurrentMonth ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="ml-1"
                onClick={() => goToMonth(nowYm.year, nowYm.month)}
              >
                Aktuális hónap
              </Button>
            ) : view === 'calendar' || focusMode ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Ugrás a mai napra"
                title="Ugrás a mai napra"
                onClick={() => scrollToToday()}
              >
                <Crosshair className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {today ? <TerminalBadge terminals={today.terminals} /> : null}
          {data.employees.length > 0 && (view !== 'todos' || focusMode) ? (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Dolgozó keresése"
                placeholder="Dolgozó keresése"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-44 pl-7 text-[13px]"
              />
            </div>
          ) : null}
          {data.employees.length > 0 && (view === 'calendar' || focusMode) ? (
            <>
              <MenuSelect
                value={cellSize}
                options={(Object.keys(CELL_SIZES) as CellSize[]).map((k) => ({
                  value: k,
                  label: `${CELL_SIZES[k].label} betű`
                }))}
                allowEmpty={false}
                onChange={(v) => {
                  if (v === 'sm' || v === 'md' || v === 'lg') changeCellSize(v)
                }}
                className="h-7 w-[7.5rem] text-[13px]"
              />
              {focusMode ? (
                <Button type="button" variant="secondary" size="sm" onClick={exitFocusMode}>
                  <Minimize2 className="size-3.5" aria-hidden />
                  Kilépés
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Teljes nézet"
                  title="Teljes nézet"
                  onClick={enterFocusMode}
                >
                  <Maximize2 className="size-3.5" aria-hidden />
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

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
      ) : view === 'today' && today && !focusMode ? (
        <JelenletTodayPanel
          data={data}
          today={glance.today}
          events={today.events}
          isExpected={isExpectedToday}
          search={search}
          canWrite={canWrite}
          onEdit={(eid) => openCell(eid, glance.today)}
        />
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
            <>
            {canWrite ? (
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <p className="text-[13px] text-ink-secondary">
                  {glance.todoCount} nap vár pótlásra
                </p>
                <Button type="button" size="sm" onClick={openFirstTodo}>
                  Következő pótlása
                </Button>
              </div>
            ) : null}
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
            </>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={hoverTip ? hideHoverTipNow : undefined}
          className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-surface print:max-h-none print:overflow-visible print:border-0"
        >
          <style>{gridHighlightCss(data.dates.length)}</style>
          <table className="jl-grid w-max min-w-full border-separate border-spacing-0 text-xs">
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
                {data.dates.map((ymd, colIdx) => {
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
                      data-col={colIdx}
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
                {TOTAL_KEYS.map((k) => (
                  <th
                    key={k}
                    style={totalStyle(k)}
                    className={cn(
                      'sticky top-0 z-30 border-b border-border bg-subtle px-2 py-1.5 text-right text-[12px] font-semibold text-ink',
                      k === 'normal' ? 'border-l shadow-[-2px_0_0_0_var(--border)]' : 'border-l border-l-border/60'
                    )}
                  >
                    {TOTAL_HEAD[k]}
                    <span className="block text-[11px] font-normal text-ink-muted">hónap</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeGroups.map((group) => (
                <Fragment key={group.typeId}>
                  <tr>
                    <td
                      className={cn(
                        NAME_COL,
                        'sticky left-0 z-[11] border-b border-r border-border bg-subtle px-2 py-1 text-left shadow-[2px_0_0_0_var(--border)]'
                      )}
                    >
                      <span className="text-[12px] font-semibold text-ink">
                        {group.typeName}
                      </span>
                      <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                        ({group.employees.length})
                      </span>
                    </td>
                    <td
                      colSpan={data.dates.length}
                      className="border-b border-border bg-subtle p-0"
                      aria-hidden
                    />
                    {(() => {
                      const sum = group.employees.reduce(
                        (acc, e) => {
                          const t = monthTotals[e.id]
                          if (t) {
                            acc.normal += t.normal
                            acc.overtime += t.overtime
                            acc.weekend += t.weekendDays
                          }
                          return acc
                        },
                        { normal: 0, overtime: 0, weekend: 0 }
                      )
                      return TOTAL_KEYS.map((k) => (
                        <td
                          key={k}
                          style={totalStyle(k)}
                          className={cn(
                            'sticky z-[11] border-b border-border bg-subtle px-2 py-1 text-right text-[12px] font-semibold tabular-nums text-ink-secondary',
                            k === 'normal' ? 'border-l shadow-[-2px_0_0_0_var(--border)]' : 'border-l border-l-border/60'
                          )}
                        >
                          {k === 'weekend'
                            ? sum.weekend ? `${sum.weekend} nap` : '–'
                            : sum[k] ? hoursDecimal(sum[k]) : '–'}
                        </td>
                      ))
                    })()}
                  </tr>
                  {group.employees.map((emp) => {
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
                                  att!.empty > 0
                                    ? `${att!.empty} pótolni`
                                    : null,
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
                        {data.dates.map((ymd, colIdx) => {
                          const cell = data.cells[`${emp.id}|${ymd}`]
                          const isToday = ymd === glance.today
                          const dow = dowOf(ymd)
                          const isHoliday = holidayByDate.has(ymd)
                          const disp = cellDisplay(cell)
                          const timeContent = cellTimeContent(cell)
                          const manualMark = cellHasManualTime(cell)
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
                          const policy = totalsRules.employees[emp.id]
                          const shiftStart = policy?.shiftStart ?? emp.shiftStart
                          const shiftEnd = policy?.shiftEnd ?? emp.shiftEnd
                          const deviation =
                            cell?.kind === 'complete' &&
                            dow !== 0 &&
                            dow !== 6 &&
                            !cell.calendarName
                              ? classifyShiftDeviation({
                                  arrival: cell.arrival,
                                  departure: cell.departure,
                                  shiftStart,
                                  shiftEnd,
                                  graceMinutes: totalsRules.graceMinutes
                                })
                              : null
                          const tipLines = [
                            ...cellHoverLines(
                              emp.name,
                              ymd,
                              cell,
                              scheduleExpected,
                              canWrite,
                              isPast
                            ),
                            ...(deviation
                              ? deviationLines(
                                  deviation,
                                  shiftStart,
                                  shiftEnd,
                                  Boolean(policy?.overtime.enabled || policy?.earlyOvertime.enabled)
                                )
                              : [])
                          ]
                          const who = `${emp.name} · ${formatYmdHu(ymd)}`
                          const shortTip: string[] | null =
                            deviation && deviation.kind !== 'ok'
                              ? [who, deviationShortLine(deviation)]
                              : cell?.kind === 'incomplete'
                                ? [who, cell.arrival ? 'Hiányzik a távozás' : 'Hiányzik az érkezés']
                                : emptyWork
                                  ? [who, 'Hiányzó nap — nincs rögzítve']
                                  : cell?.kind === 'rest'
                                    ? [who, cell.calendarName ?? 'Ünnep / pihenőnap']
                                    : null
                          const statusFill =
                            cell?.kind === 'vacation' ||
                            cell?.kind === 'sick' ||
                            cell?.kind === 'other_absence' ||
                            cell?.kind === 'incomplete' ||
                            cell?.kind === 'complete'

                          return (
                            <td
                              key={ymd}
                      data-col={colIdx}
                              data-weekend={
                                dow === 0
                                  ? 'sun'
                                  : dow === 6
                                    ? 'sat'
                                    : undefined
                              }
                              data-today={isToday ? 'true' : undefined}
                              className={cn(
                                DAY_COL,
                                'border-b border-r border-border/70 p-0',
                                !statusFill &&
                                  columnTintClass({
                                    dow,
                                    isToday,
                                    isHoliday
                                  }),
                                statusFill &&
                                  (isToday
                                    ? 'bg-primary/[0.06]'
                                    : 'bg-surface'),
                                isToday &&
                                  'border-l-[3px] border-l-primary border-r-[3px] border-r-primary'
                              )}
                            >
                              <button
                                type="button"
                                disabled={!canWrite || cell?.kind === 'rest'}
                                aria-label={tipLines.join('. ')}
                                onMouseEnter={(e) => showHoverTip(e, shortTip)}
                                onMouseLeave={hideHoverTip}
                                onFocus={(e) => showHoverTip(e, shortTip, true)}
                                onBlur={hideHoverTipNow}
                                onClick={() => {
                                  hideHoverTipNow()
                                  openCell(emp.id, ymd)
                                }}
                                className={cn(
                                  'relative flex w-full items-center justify-center gap-0.5 px-0.5 tabular-nums',
                                  ROW_H,
                                  disp.className,
                                  size.text,
                                  deviation && deviationClass(deviation),
                                  emptyWork &&
                                    !disp.text &&
                                    'bg-warning-soft/50 ring-1 ring-inset ring-dashed ring-warning/50',
                                  canWrite &&
                                    cell?.kind !== 'rest' &&
                                    'cursor-pointer'
                                )}
                              >
                                {deviation ? <DeviationIcons dev={deviation} iconClass={size.icon} /> : null}
                                {emptyWork && !disp.text ? (
                                  <span className="text-[12px] font-semibold text-warning-ink">
                                    —
                                  </span>
                                ) : (
                                  (timeContent ?? disp.text)
                                )}
                                {manualMark ? (
                                  <PencilLine
                                    className="absolute right-0.5 top-0.5 size-2.5 opacity-60"
                                    aria-hidden
                                  />
                                ) : null}
                              </button>
                            </td>
                          )
                        })}
                        {(() => {
                          const t = monthTotals[emp.id]
                          const tip = t ? totalTipLines(emp.name, t, totalsRules.graceMinutes) : []
                          return TOTAL_KEYS.map((k) => {
                            const active =
                              t &&
                              (k === 'normal' ? t.normal > 0 : k === 'overtime' ? t.overtime > 0 : t.weekendDays > 0)
                            return (
                              <td
                                key={k}
                                style={totalStyle(k)}
                                tabIndex={t ? 0 : undefined}
                                aria-label={t ? tip.join('. ') : undefined}
                                role={t ? 'button' : undefined}
                                onClick={t ? (e) => showHoverTip(e, tip, true) : undefined}
                                onKeyDown={
                                  t
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          showHoverTip(e as unknown as React.FocusEvent<HTMLElement>, tip, true)
                                        }
                                      }
                                    : undefined
                                }
                                onMouseLeave={t ? hideHoverTipNow : undefined}
                                onBlur={t ? hideHoverTipNow : undefined}
                                className={cn(
                                  'sticky z-10 border-b border-border px-2 py-0 text-right tabular-nums text-ink',
                                  t && 'cursor-pointer',
                                  k === 'normal'
                                    ? 'border-l shadow-[-2px_0_0_0_var(--border)]'
                                    : 'border-l border-l-border/60',
                                  active && k === 'overtime'
                                    ? 'bg-warning-soft'
                                    : active && k === 'weekend'
                                      ? 'bg-info-soft'
                                      : 'bg-surface group-hover:bg-subtle'
                                )}
                              >
                                {!t ? null : !active ? (
                                  <span className={cn(totalMainText, 'text-ink-muted')}>–</span>
                                ) : (
                                  <span className="flex flex-col items-end leading-tight">
                                    <span className={cn(totalMainText, 'font-semibold')}>
                                      {k === 'normal'
                                        ? hoursDecimal(t.normal)
                                        : k === 'overtime'
                                          ? hoursDecimal(t.overtime)
                                          : `${t.weekendDays} nap`}
                                    </span>
                                    {k === 'normal' ? (
                                      <span className={cn(totalSubText, 'text-ink-secondary')}>{t.days} nap</span>
                                    ) : k === 'weekend' ? (
                                      <span className={cn(totalSubText, 'text-ink-secondary')}>
                                        {hoursDecimal(t.weekendMinutes)} ó
                                      </span>
                                    ) : null}
                                  </span>
                                )}
                              </td>
                            )
                          })
                        })()}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.employees.length > 0 && (view === 'calendar' || focusMode) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 print:hidden">
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
          <LegendSwatch className={DEVIATION_CLASS.short} label="Kevesebb a műszaknál">
            <ArrowDown className="size-3" aria-hidden />
          </LegendSwatch>
          <LegendSwatch className={DEVIATION_CLASS.long} label="Több a műszaknál">
            <ArrowUp className="size-3" aria-hidden />
          </LegendSwatch>
          <span className="text-[12px] text-ink-secondary">Számítás: kattints az összesítőre</span>
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
          <LegendSwatch
            className="relative bg-success-soft pr-2 text-success-ink"
            label="Kézi bevitel"
          >
            <span className={MANUAL_TIME_CLASS}>8</span>
            <PencilLine className="absolute right-0 top-0 size-2" aria-hidden />
          </LegendSwatch>
        </div>
      ) : null}

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
                  <div className="min-h-5" aria-live="polite">
                    <TimeSourceTag source={arrivalLiveSource} />
                  </div>
                </FormField>
                <FormField label="Távozás" htmlFor="dep" required>
                  <Input
                    id="dep"
                    type="time"
                    value={departure}
                    onChange={(e) => setDeparture(e.target.value)}
                  />
                  <div className="min-h-5" aria-live="polite">
                    <TimeSourceTag source={departureLiveSource} />
                  </div>
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
