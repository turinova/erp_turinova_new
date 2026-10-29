import { DEFAULT_FOOTCOUNTER_OPEN_HOURS } from '@/lib/footcounter/open-hours'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'
import type {
  BacklogMeters,
  WeeklyCuttingData,
  WeeklyEdgeData,
  YearlyMachineAvgData
} from '@/lib/home/chart-queries'
import type { HomeKpiBundle, SalesDayPoint } from '@/lib/home/kpi-queries'

/** Marketing home mock — minden add-on ON, kitalált de hihető számok. */

const LAST_7: SalesDayPoint[] = [
  { ymd: '2026-03-25', label: 'Sze 25', gross: 2_180_000, count: 68 },
  { ymd: '2026-03-26', label: 'Cs 26', gross: 1_945_000, count: 54 },
  { ymd: '2026-03-27', label: 'P 27', gross: 3_620_000, count: 97 },
  { ymd: '2026-03-28', label: 'Szo 28', gross: 1_280_000, count: 41 },
  { ymd: '2026-03-29', label: 'V 29', gross: 0, count: 0 },
  { ymd: '2026-03-30', label: 'H 30', gross: 2_890_000, count: 82 },
  { ymd: '2026-03-31', label: 'K 31', gross: 4_286_500, count: 125 }
]

const LAPSZAB_7: SalesDayPoint[] = [
  { ymd: '2026-03-25', label: 'Sze 25', gross: 420_000, count: 2 },
  { ymd: '2026-03-26', label: 'Cs 26', gross: 0, count: 0 },
  { ymd: '2026-03-27', label: 'P 27', gross: 910_000, count: 3 },
  { ymd: '2026-03-28', label: 'Szo 28', gross: 180_000, count: 1 },
  { ymd: '2026-03-29', label: 'V 29', gross: 0, count: 0 },
  { ymd: '2026-03-30', label: 'H 30', gross: 650_000, count: 2 },
  { ymd: '2026-03-31', label: 'K 31', gross: 1_842_000, count: 7 }
]

function hourlyIn(): number[] {
  const h = Array.from({ length: 24 }, () => 0)
  // Nyitvatartás 8–17, csúcs 10–11
  const vals: Record<number, number> = {
    8: 6,
    9: 14,
    10: 28,
    11: 31,
    12: 18,
    13: 22,
    14: 19,
    15: 15,
    16: 9,
    17: 4
  }
  for (const [k, v] of Object.entries(vals)) h[Number(k)] = v
  return h
}

function hourlyOut(): number[] {
  const h = Array.from({ length: 24 }, () => 0)
  const vals: Record<number, number> = {
    8: 2,
    9: 8,
    10: 16,
    11: 24,
    12: 21,
    13: 18,
    14: 20,
    15: 17,
    16: 12,
    17: 4
  }
  for (const [k, v] of Object.entries(vals)) h[Number(k)] = v
  return h
}

export const HOME_DASHBOARD_FIXTURE = {
  companyName: 'Minta Kft.',
  kpis: {
    sales: {
      todayGross: 4_286_500,
      todaySaleCount: 125,
      monthGross: 48_200_000,
      monthSaleCount: 1_840,
      priorMonthGross: 41_500_000,
      monthLabel: 'Március',
      todayReturnCount: 2,
      todayReturnGross: 42_000,
      openDue: 1_240_000,
      openInvoiceGross: 2_100_000,
      openInvoiceCount: 11,
      last7Days: LAST_7
    },
    jelenlet: {
      present: 8,
      expectedToday: 11,
      late: 2,
      vacation: 1,
      sick: 1,
      otherAway: 0,
      missingDayCount: 2,
      awayNames: ['Nagy Péter'],
      lateNames: ['Kovács Anna', 'Szabó Gábor']
    },
    lapszabaszat: {
      todayGross: 1_842_000,
      todayCount: 7,
      last7Days: LAPSZAB_7,
      openDue: 680_000,
      openOrderGross: 1_150_000,
      openOrderCount: 4
    }
  } satisfies HomeKpiBundle,

  footcounter: {
    todayIn: 166,
    todayOut: 142,
    hourlyIn: hourlyIn(),
    hourlyOut: hourlyOut(),
    lastEventAt: '2026-03-31T14:22:00+02:00',
    deviceLastSeen: '2026-03-31T14:22:00+02:00',
    liveStatus: 'live' as const,
    openHours: DEFAULT_FOOTCOUNTER_OPEN_HOURS
  } satisfies FootcounterHomeSlim,

  backlog: {
    cuttingM: 48.2,
    edgeM: 126.5,
    orderCount: 3,
    staleOrderCount: 0
  } satisfies BacklogMeters,

  cutting: {
    categories: ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'],
    series: [
      { name: 'Homag 1', data: [42, 38, 55, 48, 61] },
      { name: 'SCM', data: [28, 31, 22, 35, 40] }
    ],
    machineLimits: [
      { machineId: 'm1', machineName: 'Homag 1', limit: 80 },
      { machineId: 'm2', machineName: 'SCM', limit: 50 }
    ],
    dailyTotals: [70, 69, 77, 83, 101],
    doneTotals: [52, 48, 40, 30, 18],
    remainingTotals: [18, 21, 37, 53, 83],
    weekStart: '2026-03-30',
    weekEnd: '2026-04-03',
    weekOffset: 0,
    orderCount: 14,
    unit: 'm' as const
  } satisfies WeeklyCuttingData,

  edge: {
    categories: ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek'],
    series: [{ name: 'Élzáró', data: [420, 380, 510, 460, 580] }],
    dailyTotals: [420, 380, 510, 460, 580],
    capacityPerDayM: 700,
    weekStart: '2026-03-30',
    weekEnd: '2026-04-03',
    weekOffset: 0,
    orderCount: 14,
    unit: 'm' as const
  } satisfies WeeklyEdgeData,

  yearlyAvg: {
    year: 2026,
    categories: ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún'],
    series: [
      {
        machineId: 'm1',
        name: 'Homag 1',
        dailyLimitM: 80,
        data: [52, 58, 61, 0, 0, 0]
      },
      {
        machineId: 'm2',
        name: 'SCM',
        dailyLimitM: 50,
        data: [34, 38, 41, 0, 0, 0]
      }
    ]
  } satisfies YearlyMachineAvgData
} as const
