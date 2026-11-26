import { normalizeTime } from '@/lib/jelenlet/hours'

const TZ = 'Europe/Budapest'

export type ScanBase = 'arrival' | 'departure'
export type ScanSource = 'rfid' | 'pin'
export type TimeSource = 'rfid' | 'pin' | 'manual' | 'import'

export type ParsedScanTime = {
  /** Budapest naptári nap */
  workDate: string
  /** Budapest falióra HH:MM */
  hm: string
  /** Budapest falióra HH:MM:SS */
  hms: string
  utcIso: string
}

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

function budapestParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map(x => [x.type, x.value]))
  return {
    y: Number(p.year),
    mo: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
    s: Number(p.second)
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function fromDate(d: Date): ParsedScanTime {
  const p = budapestParts(d)
  return {
    workDate: `${p.y}-${pad(p.mo)}-${pad(p.d)}`,
    hm: `${pad(p.h)}:${pad(p.mi)}`,
    hms: `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`,
    utcIso: d.toISOString()
  }
}

/** Budapest falióra → UTC (DST-biztos, két iteráció). */
export function budapestWallToUtc(y: number, mo: number, d: number, h: number, mi: number, s = 0): Date {
  const wallMs = Date.UTC(y, mo - 1, d, h, mi, s)
  let utc = wallMs
  for (let i = 0; i < 2; i++) {
    const p = budapestParts(new Date(utc))
    const asWall = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)
    utc += wallMs - asWall
  }
  return new Date(utc)
}

/**
 * Pi scan idő: naiv ISO (`2026-11-09T07:58:12`) = Budapest falióra;
 * Z / offset esetén abszolút idő.
 */
export function parseScanTime(raw: unknown): ParsedScanTime | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi, sec, zone] = m
  if (zone) {
    const date = new Date(s.replace(' ', 'T'))
    return Number.isNaN(date.getTime()) ? null : fromDate(date)
  }
  const nums = [y, mo, d, h, mi, sec ?? '0'].map(Number)
  if (nums[1]! < 1 || nums[1]! > 12 || nums[2]! < 1 || nums[2]! > 31 || nums[3]! > 23 || nums[4]! > 59) {
    return null
  }
  const utc = budapestWallToUtc(nums[0]!, nums[1]!, nums[2]!, nums[3]!, nums[4]!, nums[5]!)
  const parsed = fromDate(utc)
  if (parsed.workDate !== `${y}-${mo}-${d}`) return null
  return parsed
}

/** `arrival` | `arrival_pin` | `departure` | `departure_pin` */
export function parseScanType(raw: unknown): { base: ScanBase; pin: boolean } | null {
  if (typeof raw !== 'string') return null
  const m = /^(arrival|departure)(_pin)?$/.exec(raw.trim())
  if (!m) return null
  return { base: m[1] as ScanBase, pin: Boolean(m[2]) }
}

export type DayEvent = {
  scan_type: ScanBase
  scan_source: ScanSource
  /** Budapest HH:MM */
  hm: string
}

export type ExistingDay = {
  arrival_time: string | null
  departure_time: string | null
  arrival_source: string | null
  departure_source: string | null
} | null

export type ComputedDay = {
  arrival_time: string | null
  departure_time: string | null
  arrival_source: TimeSource | null
  departure_source: TimeSource | null
}

function isLocked(source: string | null | undefined): boolean {
  return source === 'manual' || source === 'import'
}

/**
 * Napi sor a terminál eseményekből: első érkezés, utolsó távozás.
 * Kézi / import mező nem íródik felül (a kézi nyer).
 */
export function computeDayFromEvents(existing: ExistingDay, events: DayEvent[]): ComputedDay {
  const all = [...events]
  // Korábbi terminál idők (régi /scan út, esemény nélkül) mindig jelöltek maradnak.
  for (const [field, type] of [['arrival', 'arrival'], ['departure', 'departure']] as const) {
    const hm = normalizeTime(existing?.[`${field}_time`])
    const src = existing?.[`${field}_source`]
    if (hm && (src === 'rfid' || src === 'pin')) {
      all.push({ scan_type: type, scan_source: src, hm })
    }
  }
  const sorted = all.sort((a, b) => a.hm.localeCompare(b.hm))
  const firstArrival = sorted.find(e => e.scan_type === 'arrival') ?? null
  const lastDeparture = [...sorted].reverse().find(e => e.scan_type === 'departure') ?? null

  let arrival_time: string | null
  let arrival_source: TimeSource | null
  if (existing && isLocked(existing.arrival_source)) {
    arrival_time = normalizeTime(existing.arrival_time)
    arrival_source = existing.arrival_source as TimeSource
  } else if (firstArrival) {
    arrival_time = firstArrival.hm
    arrival_source = firstArrival.scan_source
  } else {
    arrival_time = null
    arrival_source = null
  }

  let departure_time: string | null
  let departure_source: TimeSource | null
  if (existing && isLocked(existing.departure_source)) {
    departure_time = normalizeTime(existing.departure_time)
    departure_source = existing.departure_source as TimeSource
  } else if (lastDeparture && (!arrival_time || lastDeparture.hm > arrival_time)) {
    departure_time = lastDeparture.hm
    departure_source = lastDeparture.scan_source
  } else {
    departure_time = null
    departure_source = null
  }

  return { arrival_time, departure_time, arrival_source, departure_source }
}

export type TerminalLogRow = {
  employee_id: string
  scan_time: string
  scan_type: string
  manually_edited: boolean
}

/**
 * Pi `_resolve_next_scan_from_logs` formátum: terminál események + kézi mezők
 * `manually_edited: true` sorként (mindkettő kézi → Pi zárol).
 */
export function buildTerminalLogs(
  workDate: string,
  events: Array<{ employee_id: string; scan_time_hms: string; scan_type: ScanBase; scan_source: ScanSource }>,
  days: Array<{
    employee_id: string
    arrival_time: string | null
    departure_time: string | null
    arrival_source: string | null
    departure_source: string | null
  }>
): TerminalLogRow[] {
  const rows: TerminalLogRow[] = events.map(e => ({
    employee_id: e.employee_id,
    scan_time: `${workDate}T${e.scan_time_hms}`,
    scan_type: e.scan_source === 'pin' ? `${e.scan_type}_pin` : e.scan_type,
    manually_edited: false
  }))
  for (const d of days) {
    const a = normalizeTime(d.arrival_time)
    const dep = normalizeTime(d.departure_time)
    for (const [hm, type, src] of [
      [a, 'arrival', d.arrival_source],
      [dep, 'departure', d.departure_source]
    ] as const) {
      if (!hm) continue
      if (isLocked(src)) {
        rows.push({ employee_id: d.employee_id, scan_time: `${workDate}T${hm}:00`, scan_type: type, manually_edited: true })
        continue
      }
      // Esemény nélküli terminál idő (régi /scan út) — a Pi-nek látnia kell a következő típushoz.
      const covered = events.some(
        e => e.employee_id === d.employee_id && e.scan_type === type && e.scan_time_hms.slice(0, 5) === hm
      )
      if (!covered && (src === 'rfid' || src === 'pin')) {
        rows.push({
          employee_id: d.employee_id,
          scan_time: `${workDate}T${hm}:00`,
          scan_type: src === 'pin' ? `${type}_pin` : type,
          manually_edited: false
        })
      }
    }
  }
  return rows.sort((x, y) => x.scan_time.localeCompare(y.scan_time))
}
