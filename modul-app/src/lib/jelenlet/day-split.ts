import { timeToMinutes } from '@/lib/jelenlet/hours'
import {
  afterShiftOvertimeMinutes,
  earlyOvertimeMinutes,
  paidMinutesWithGrace,
  workedMinutes,
  type SheetEmployee
} from '@/lib/jelenlet/sheet-engine'

export const NORMAL_DAY_MINUTES = 480

export type DaySplit = {
  /** Hétköznapi rendes perc (max 8 óra). */
  normal: number
  /** 8 óra feletti műszakon belüli perc + bekapcsolt műszakon kívüli túlóra. */
  overtime: number
  /** Szombati / vasárnapi munka perce — külön, nem rendes és nem túlóra. */
  weekend: number
}

/**
 * Hétköznap: csak a műszakon belüli idő számít (± türelmi idő a műszak széléhez
 * igazít), ebéd levonva; 8 óráig rendes, felette túlóra. Műszakon kívüli idő csak
 * a dolgozónál bekapcsolt túlóra-szabállyal számít. Hétvégén a bent töltött idő külön.
 */
export function computeDaySplit(input: {
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  weekend: boolean
  graceMinutes: number
  employee: Pick<SheetEmployee, 'shiftStart' | 'shiftEnd' | 'overtime' | 'earlyOvertime'>
}): DaySplit {
  const { employee: emp } = input
  if (input.weekend) {
    return {
      normal: 0,
      overtime: 0,
      weekend: workedMinutes(input.arrival, input.departure, input.lunchStart, input.lunchEnd)
    }
  }
  const paid = paidMinutesWithGrace({
    arrival: input.arrival,
    departure: input.departure,
    lunchStart: input.lunchStart,
    lunchEnd: input.lunchEnd,
    shiftStart: emp.shiftStart,
    shiftEnd: emp.shiftEnd,
    graceMinutes: input.graceMinutes
  })
  const normal = Math.min(paid, NORMAL_DAY_MINUTES)
  const outsideShift = paid > 0
    ? afterShiftOvertimeMinutes(input.departure, emp.shiftStart, emp.shiftEnd, emp.overtime) +
      earlyOvertimeMinutes(input.arrival, emp.shiftStart, emp.earlyOvertime)
    : 0
  return { normal, overtime: paid - normal + outsideShift, weekend: 0 }
}

export type ShiftDeviationKind = 'ok' | 'short' | 'long' | 'mixed'

export type ShiftDeviation = {
  kind: ShiftDeviationKind
  lateMin: number
  earlyLeaveMin: number
  earlyArriveMin: number
  stayLateMin: number
  /** Bent töltött idő − műszak (perc, + több / − kevesebb). */
  netMin: number
}

/** Érkezés / távozás eltérése a műszaktól; a türelmi időn belüli eltérés nem számít. */
export function classifyShiftDeviation(input: {
  arrival: string | null
  departure: string | null
  shiftStart: string | null
  shiftEnd: string | null
  graceMinutes: number
}): ShiftDeviation | null {
  const a = timeToMinutes(input.arrival)
  const d = timeToMinutes(input.departure)
  const s0 = timeToMinutes(input.shiftStart)
  const s1 = timeToMinutes(input.shiftEnd)
  if (a == null || d == null || s0 == null || s1 == null || d <= a || s1 <= s0) return null
  const g = Math.max(0, Math.floor(input.graceMinutes))
  const beyond = (diff: number) => (diff > g ? diff : 0)
  const lateMin = beyond(a - s0)
  const earlyArriveMin = beyond(s0 - a)
  const earlyLeaveMin = beyond(s1 - d)
  const stayLateMin = beyond(d - s1)
  const shorter = lateMin + earlyLeaveMin
  const longer = earlyArriveMin + stayLateMin
  const kind: ShiftDeviationKind =
    shorter > 0 && longer > 0 ? 'mixed' : shorter > 0 ? 'short' : longer > 0 ? 'long' : 'ok'
  return { kind, lateMin, earlyLeaveMin, earlyArriveMin, stayLateMin, netMin: longer - shorter }
}
