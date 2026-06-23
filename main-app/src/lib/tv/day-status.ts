import type { TvDashboardPayload } from '@/types/tv-dashboard'

export type TvDayStatus = 'ok' | 'caution' | 'critical'

export type TvTomorrowLoad = {
  cuttingM: number
  edgeM: number
}

const STATUS_LABEL: Record<TvDayStatus, string> = {
  ok: 'Rendben',
  caution: 'Figyelem',
  critical: 'Kritikus'
}

export function dayStatusLabel(status: TvDayStatus): string {
  return STATUS_LABEL[status]
}

/** Összefoglaló napi állapot a vezetői fejléc chiphez — null hétvégén */
export function computeDayStatus(data: TvDashboardPayload): TvDayStatus | null {
  const today = data.todayProduction
  if (today.edgeCapacityPct == null) return null

  const hasBacklog = data.backlog.cuttingM > 0 || data.backlog.edgeM > 0
  const cuttingHighRemain =
    today.cuttingTotalM > 0 && today.cuttingRemainingM / today.cuttingTotalM > 0.5
  const edgeOverCapacity = today.edgeCapacityPct > 100
  const staffMissing = data.attendance.counts.none > 0

  if (hasBacklog && (cuttingHighRemain || edgeOverCapacity)) return 'critical'
  if ([hasBacklog, cuttingHighRemain, edgeOverCapacity, staffMissing].filter(Boolean).length >= 2) {
    return 'critical'
  }
  if (hasBacklog || cuttingHighRemain || edgeOverCapacity || staffMissing) return 'caution'
  return 'ok'
}

export function getTomorrowLoad(data: TvDashboardPayload): TvTomorrowLoad | null {
  const idx = data.weeklyCutting.todayIndex
  if (idx == null) return null

  const tomorrowIdx = idx + 1
  if (tomorrowIdx >= data.weeklyCutting.totals.length) return null

  const cuttingM = data.weeklyCutting.totals[tomorrowIdx] ?? 0
  const edgeM = data.weeklyEdge.totals[tomorrowIdx] ?? 0
  if (cuttingM <= 0 && edgeM <= 0) return null

  return { cuttingM, edgeM }
}
