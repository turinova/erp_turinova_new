/** Tenant Belépők nyitvatartás — display/KPI only (sync raw marad). */

export type FootcounterOpenHours = {
  weekdayOpen: number
  weekdayClose: number
  /** null = szombat zárva */
  saturdayOpen: number | null
  saturdayClose: number | null
}

export const DEFAULT_FOOTCOUNTER_OPEN_HOURS: FootcounterOpenHours = {
  weekdayOpen: 8,
  weekdayClose: 17,
  saturdayOpen: 8,
  saturdayClose: 12
}

export function hourLabelsForRange(open: number, close: number): string[] {
  const out: string[] = []
  for (let h = open; h <= close; h++) out.push(String(h))
  return out
}

/** Inclusive hour range sum from length-24 array. */
export function sumHourSlice(
  hourly: number[],
  open: number,
  close: number
): number {
  let s = 0
  for (let h = open; h <= close; h++) s += hourly[h] ?? 0
  return s
}

export function peakHourInRange(
  hourly: number[],
  open: number,
  close: number
): { hour: number | null; count: number } {
  let hour: number | null = null
  let count = 0
  for (let h = open; h <= close; h++) {
    const c = hourly[h] ?? 0
    if (c > count) {
      count = c
      hour = h
    }
  }
  return { hour: count > 0 ? hour : null, count }
}

/**
 * weekday: 0 = hétfő … 6 = vasárnap (iso).
 * hour closed for chart cells.
 */
export function isHourClosed(
  weekday: number,
  hour: number,
  hours: FootcounterOpenHours
): boolean {
  if (weekday === 6) return true
  if (weekday === 5) {
    if (hours.saturdayOpen == null || hours.saturdayClose == null) return true
    return hour < hours.saturdayOpen || hour > hours.saturdayClose
  }
  return hour < hours.weekdayOpen || hour > hours.weekdayClose
}

/** Today (any weekday) display window for home / today chart. */
export function todayDisplayRange(
  hours: FootcounterOpenHours,
  weekday: number
): { open: number; close: number; closed: boolean } {
  if (weekday === 6) {
    return { open: hours.weekdayOpen, close: hours.weekdayClose, closed: true }
  }
  if (weekday === 5) {
    if (hours.saturdayOpen == null || hours.saturdayClose == null) {
      return { open: hours.weekdayOpen, close: hours.weekdayClose, closed: true }
    }
    return {
      open: hours.saturdayOpen,
      close: hours.saturdayClose,
      closed: false
    }
  }
  return {
    open: hours.weekdayOpen,
    close: hours.weekdayClose,
    closed: false
  }
}

export function formatHoursLabel(open: number, close: number): string {
  return `${open}–${close}`
}
