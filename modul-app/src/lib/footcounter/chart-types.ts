export type FootcounterTodayHourBar = {
  hour: number
  inCount: number
  outCount: number
  pending?: boolean
  running?: boolean
}

export type FootcounterMonthDayBar = {
  day: number
  inCount: number
  closed: boolean
  /** Csúcs / kiemelt nap. */
  highlight?: boolean
}

export type FootcounterWeekdayBar = {
  weekday: number
  label: string
  avgIn: number
  closed: boolean
}

export type FootcounterSeasonBar = {
  key: string
  label: string
  totalIn: number
  selected?: boolean
}

export type FootcounterHeatmapCell = {
  hour: number
  value: number
  closed: boolean
}

export type FootcounterHeatmapRow = {
  weekday: number
  label: string
  cells: FootcounterHeatmapCell[]
  total: number
  closed: boolean
}

export type FootcounterTodayPanelData = {
  label: string
  todayIn: number
  todayOut: number
  occupancy: number
  peakHour: number | null
  peakHourIn: number
  weekdayAvg: number | null
  weekdayAvgLabel: string
  hourly: FootcounterTodayHourBar[]
  live: boolean
}
