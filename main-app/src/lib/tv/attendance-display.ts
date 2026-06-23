import type { TvAttendanceRow, TvAttendanceStatus } from '@/types/tv-dashboard'

const DETAILED_RANK: Record<TvAttendanceStatus, number> = {
  in: 0,
  late: 0,
  left: 1,
  holiday: 3,
  sick: 4,
  none: 5,
  odd: 6
}

const COMPACT_RANK: Record<TvAttendanceStatus, number> = {
  holiday: 0,
  sick: 1,
  none: 2,
  odd: 3,
  in: 4,
  late: 5,
  left: 6
}

export function splitAttendance(employees: TvAttendanceRow[]) {
  const detailed = employees.filter(e => e.arrival != null)
  const compact = employees.filter(e => e.arrival == null)
  return { detailed, compact }
}

export function sortDetailed(employees: TvAttendanceRow[]) {
  return [...employees].sort((a, b) => {
    const ra = DETAILED_RANK[a.status]
    const rb = DETAILED_RANK[b.status]
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, 'hu')
  })
}

export function sortCompact(employees: TvAttendanceRow[]) {
  return [...employees].sort((a, b) => {
    const ra = COMPACT_RANK[a.status]
    const rb = COMPACT_RANK[b.status]
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, 'hu')
  })
}

export function compactStatusLabel(row: TvAttendanceRow): string {
  if (row.status === 'none') return 'Nem jelent meg'
  if (row.status === 'sick') return 'Betegszabadság'
  if (row.status === 'holiday') {
    return row.holidayName ? `Szabadság (${row.holidayName})` : 'Szabadság'
  }
  if (row.status === 'odd') return 'Ellenőrizendő'
  return row.statusLabel
}

export function detailedStatusLabel(row: TvAttendanceRow): string {
  if (row.status === 'left') return 'Távozott'
  return 'Bent'
}

export type AttendanceSummaryCounts = {
  in: number
  left: number
  holiday: number
  sick: number
  none: number
  late: number
  odd: number
}

export function summarizeAttendance(employees: TvAttendanceRow[]): AttendanceSummaryCounts {
  const present = employees.filter(e => e.status === 'in' || e.status === 'late')
  return {
    in: present.length,
    left: employees.filter(e => e.status === 'left').length,
    holiday: employees.filter(e => e.status === 'holiday').length,
    sick: employees.filter(e => e.status === 'sick').length,
    none: employees.filter(e => e.status === 'none').length,
    late: present.filter(e => e.isLate).length,
    odd: employees.filter(e => e.status === 'odd').length
  }
}

/** TV jelenlét: kötőjeles névnél törés a kötőjel után, sima névnél vezetéknév / keresztnév */
export function splitAttendanceNameLines(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return ['']

  const hyphenIdx = trimmed.indexOf('-')
  if (hyphenIdx >= 0 && hyphenIdx < trimmed.length - 1) {
    const line1 = trimmed.slice(0, hyphenIdx + 1)
    const line2 = trimmed.slice(hyphenIdx + 1).trim()
    return line2 ? [line1, line2] : [line1]
  }

  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx > 0) {
    const line1 = trimmed.slice(0, spaceIdx)
    const line2 = trimmed.slice(spaceIdx + 1).trim()
    return line2 ? [line1, line2] : [line1]
  }

  return [trimmed]
}
