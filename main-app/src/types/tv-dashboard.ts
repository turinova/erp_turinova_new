export type TvAttendanceStatus =
  | 'in'
  | 'left'
  | 'holiday'
  | 'sick'
  | 'none'
  | 'odd'
  | 'late'

export type TvAttendanceRow = {
  id: string
  name: string
  arrival: string | null
  departure: string | null
  status: TvAttendanceStatus
  statusLabel: string
  holidayName: string | null
  shiftStart: string | null
  isLate: boolean
}

export type TvAttendanceBlock = {
  dateLabel: string
  counts: {
    in: number
    left: number
    holiday: number
    none: number
    odd: number
    late: number
  }
  employees: TvAttendanceRow[]
}

export type TvBacklogBlock = {
  before: string
  cuttingM: number
  cuttingOrderCount: number
  edgeM: number
  edgeOrderCount: number
}

export type TvTodayProductionBlock = {
  cuttingTotalM: number
  cuttingDoneM: number
  cuttingRemainingM: number
  edgeTotalM: number
  edgeDoneM: number
  edgeRemainingM: number
  edgeCapacityM: number
  /** Ma élzárás / napi kapacitás (0–100+), null ha nincs mai nap */
  edgeCapacityPct: number | null
}

export type TvMachineLimit = {
  name: string
  limitM: number
}

export type TvMachineSeriesItem = {
  name: string
  data: number[]
}

export type TvDaySeries = {
  categories: string[]
  done: number[]
  remaining: number[]
  totals: number[]
  todayIndex: number | null
  weekStart: string
  weekEnd: string
  /** Per-machine (cutting) or per-material (edge) breakdown — same as /home charts */
  series: TvMachineSeriesItem[]
  /** Cutting chart only — daily meter limit per machine series */
  machineLimits?: TvMachineLimit[]
}

export type TvEdgeSeries = TvDaySeries & {
  capacityPerDay: number[]
}

export type TvFootcounterMood = 'no_baseline' | 'typical' | 'busy' | 'quiet'

export type TvFootcounterHeatmap = {
  dayLabels: string[]
  hours: number[]
  /** ECharts heatmap tuples: [hourCol, dayRow, value] */
  data: Array<[number, number, number]>
}

export type TvFootcounterBlock = {
  todayIn: number
  todayOut: number
  mood: TvFootcounterMood
  moodLabel: string
  moodSubtitle: string | null
  online: boolean
  hourlyOpen: number[]
  hourLabels: number[]
  heatmap: TvFootcounterHeatmap | null
  avgIn: number | null
}

/** Legacy — PosGaugeCard only (not used on TV dashboard) */
export type TvPosBlock = {
  todayCount: number
  monthCount: number
  todayGross: number
  monthGross: number
  goalDay: number
  goalMonth: number
}

export type TvDashboardPayload = {
  generatedAt: string
  todayProduction: TvTodayProductionBlock
  backlog: TvBacklogBlock
  weeklyCutting: TvDaySeries
  weeklyEdge: TvEdgeSeries
  attendance: TvAttendanceBlock
  footcounter: TvFootcounterBlock | null
}
