import type { TodayScanEvent } from '@/lib/jelenlet/today-queries'

export type TodayStatus = 'in' | 'left' | 'late' | 'not_yet' | 'away' | 'off'

export type TodayFlag = 'double_arrival' | 'departure_without_arrival'

export const TODAY_STATUS_LABEL: Record<TodayStatus, string> = {
  in: 'Bent',
  left: 'Távozott',
  late: 'Késik / nem jött',
  not_yet: 'Még nem érkezett',
  away: 'Távol',
  off: 'Szabadnap'
}

export const TODAY_FLAG_LABEL: Record<TodayFlag, string> = {
  double_arrival: 'Dupla érkezés',
  departure_without_arrival: 'Távozás érkezés nélkül'
}

/** Lista sorrend: ami beavatkozást kér, felül. */
export const TODAY_STATUS_ORDER: TodayStatus[] = ['late', 'in', 'not_yet', 'left', 'away', 'off']

const LATE_GRACE_MIN = 10

function hmToMin(hm: string | null | undefined): number | null {
  if (!hm) return null
  const [h, m] = hm.slice(0, 5).split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : null
}

export function classifyToday(input: {
  arrival: string | null
  departure: string | null
  absent: boolean
  expected: boolean
  shiftStart: string | null
  nowHm: string
  events: TodayScanEvent[]
}): { status: TodayStatus; flags: TodayFlag[] } {
  const flags: TodayFlag[] = []
  let open = false
  for (const e of [...input.events].sort((a, b) => a.hm.localeCompare(b.hm))) {
    if (e.type === 'arrival') {
      if (open && !flags.includes('double_arrival')) flags.push('double_arrival')
      open = true
    } else {
      if (!open && !input.arrival && !flags.includes('departure_without_arrival')) {
        flags.push('departure_without_arrival')
      }
      open = false
    }
  }

  if (input.absent) return { status: 'away', flags }
  if (input.arrival && input.departure) return { status: 'left', flags }
  if (input.arrival) return { status: 'in', flags }
  if (input.departure) return { status: 'left', flags }
  if (!input.expected) return { status: 'off', flags }

  const start = hmToMin(input.shiftStart) ?? hmToMin('08:00')!
  const now = hmToMin(input.nowHm) ?? 0
  return { status: now > start + LATE_GRACE_MIN ? 'late' : 'not_yet', flags }
}

/** Eddig bent töltött perc (folyamatban lévő napnál a mostig). */
export function minutesSoFar(arrival: string | null, departure: string | null, nowHm: string): number {
  const a = hmToMin(arrival)
  if (a == null) return 0
  const d = hmToMin(departure) ?? hmToMin(nowHm) ?? a
  return Math.max(0, d - a)
}
